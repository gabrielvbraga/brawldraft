// ROTA /api/battles?tag=XXXX
// As últimas partidas de RANKED do jogador (a API guarda só as 25 mais recentes de
// todos os modos). Usada no histórico automático, na comparação de amigos e no relatório.

import { isoTime, parseBattlelog, type RawItem } from "@/lib/battlelog";
import { cleanTag, scApi } from "@/lib/supercell";

export async function GET(request: Request) {
  if (!process.env.BRAWL_API_KEY) return Response.json({ error: "no-key" }, { status: 500 });
  const tag = cleanTag(new URL(request.url).searchParams.get("tag") ?? "");
  if (!tag) return Response.json({ error: "bad-tag" }, { status: 400 });

  const r = await scApi<{ items?: RawItem[] }>(`/players/%23${tag}/battlelog`);
  if (r.status === 404) return Response.json({ error: "not-found" }, { status: 404 });
  if (!r.data) return Response.json({ error: "api", status: r.status }, { status: 502 });

  // Diagnóstico: ?raw=1 mostra uma partida de Ranked do jeito que a API manda.
  if (new URL(request.url).searchParams.get("raw") === "1") {
    const all = r.data.items ?? [];
    const ranked = all.find((it) => it.battle?.type === "soloRanked") ?? null;
    // Sem Ranked: mostra os tipos das últimas partidas, para saber o que a API está mandando.
    const types = all.map((it) => `${isoTime(it.battleTime ?? "").slice(0, 16)} ${it.battle?.type ?? "?"} ${it.event?.mode ?? "?"}`);
    return Response.json({ ranked, last: types, sample: ranked ? undefined : all[0] });
  }

  const { matches, rank } = parseBattlelog(r.data.items ?? [], tag);
  // Cada round vira uma linha na API; aqui eles viram partidas (melhor de 3).
  return Response.json({ tag, items: matches, rank }, { headers: { "Cache-Control": "no-store" } });
}
