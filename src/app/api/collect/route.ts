// ROTA /api/collect — O COLETOR DE PARTIDAS
// Roda sozinho uma vez por dia (agendado no vercel.json). Faz assim:
//   1. pega os 200 melhores jogadores do mundo (ranking da API oficial);
//   2. lê o histórico de partidas de cada um (mais jogadores achados nas partidas da vez anterior);
//   3. soma as partidas de Ranked (src/lib/collector.ts) e guarda tudo no Supabase.
//
// Só roda com a senha certa: a Vercel manda a CRON_SECRET sozinha no agendamento.
// Para rodar na mão: abra /api/collect?key=SUA_CRON_SECRET
//
// Variáveis necessárias: BRAWL_API_KEY, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL.

import { addBattles, decay, emptyStats, type RawBattle, type StoredStats } from "@/lib/collector";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { getLiveMeta } from "@/lib/livemeta";
import { keyHeaders } from "@/lib/supabase";

export const maxDuration = 60; // segundos que a Vercel deixa esta rota rodar

const API = "https://bsproxy.royaleapi.dev/v1";
const MAX_PLAYERS = 300; // jogadores visitados por rodada
const PARALLEL = 10; // pedidos ao mesmo tempo
const TIME_LIMIT = 45_000; // para antes de estourar o tempo da Vercel

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given =
    request.headers.get("authorization")?.replace("Bearer ", "") ?? new URL(request.url).searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.BRAWL_API_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !sbUrl || !sbKey) return Response.json({ error: "missing-env" }, { status: 500 });

  const started = Date.now();
  const api = async <T,>(path: string): Promise<T | null> => {
    try {
      const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  };
  const sb = { ...keyHeaders(sbKey), "Content-Type": "application/json" };

  // 1) Lê o que já foi coletado antes.
  let stats: StoredStats = emptyStats();
  try {
    const res = await fetch(`${sbUrl}/rest/v1/stats?id=eq.ranked&select=data`, { headers: sb, cache: "no-store" });
    const rows = res.ok ? ((await res.json()) as { data: StoredStats }[]) : [];
    if (rows[0]?.data) stats = { ...emptyStats(), ...rows[0].data };
  } catch {
    // primeira vez ou banco fora do ar: começa do zero
  }

  // 2) Partidas antigas passam a valer 10% menos a cada rodada (o meta muda com o tempo).
  decay(stats, 0.9);

  // 3) Lista de jogadores: top 200 do mundo + os achados na rodada anterior.
  const ranking = await api<{ items?: { tag?: string }[] }>("/rankings/global/players?limit=200");
  const top = (ranking?.items ?? []).map((p) => p.tag ?? "").filter(Boolean);
  if (top.length === 0) return Response.json({ error: "api", hint: "confira a BRAWL_API_KEY e o IP 45.79.218.79" }, { status: 502 });
  const players = [...new Set([...top, ...stats.queue])].slice(0, MAX_PLAYERS);

  // 4) Lê os históricos, alguns de cada vez.
  const seen = new Set(stats.seen);
  const found: string[] = [];
  let visited = 0;
  let added = 0;
  for (let i = 0; i < players.length && Date.now() - started < TIME_LIMIT; i += PARALLEL) {
    const group = players.slice(i, i + PARALLEL);
    const logs = await Promise.all(
      group.map((tag) => api<{ items?: RawBattle[] }>(`/players/${encodeURIComponent(tag)}/battlelog`)),
    );
    logs.forEach((log, j) => {
      if (!log?.items) return;
      visited++;
      const r = addBattles(stats, seen, group[j], log.items);
      added += r.added;
      found.push(...r.others);
    });
  }

  // 5) Guarda: as contas, as partidas já vistas (últimas 30 mil) e a fila da próxima rodada.
  stats.updatedAt = new Date().toISOString();
  stats.seen = [...seen].slice(-30000);
  stats.queue = [...new Set(found)].filter((t) => !top.includes(t)).slice(0, 200);

  const save = await fetch(`${sbUrl}/rest/v1/stats`, {
    method: "POST",
    headers: { ...sb, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: "ranked", data: stats, updated_at: stats.updatedAt }),
  });

  // 6) Guarda o meta do topbrawl de hoje, para mostrar quem subiu e quem caiu.
  let metaSaved = false;
  const live = await getLiveMeta(
    MAPS.map((m) => m.gameId),
    BRAWLERS.map((b) => b.name),
  );
  if (live && !live.saved) {
    const day = new Date().toISOString().slice(0, 10);
    const r = await fetch(`${sbUrl}/rest/v1/meta_history`, {
      method: "POST",
      headers: { ...sb, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ day, overall: live.overall }),
    });
    metaSaved = r.ok;
  }

  return Response.json({
    ok: save.ok,
    metaSaved,
    visitedPlayers: visited,
    newRankedBattles: added,
    totalBattles: stats.battles,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
