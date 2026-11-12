// ROTA /api/battles?tag=XXXX
// As últimas partidas de RANKED do jogador (a API guarda só as 25 mais recentes de
// todos os modos). Usada no histórico automático, na comparação de amigos e no relatório.

import { cleanTag, scApi } from "@/lib/supercell";

type RawItem = {
  battleTime?: string; // formato da API: 20261111T190000.000Z
  event?: { id?: number; mode?: string; map?: string };
  battle?: {
    type?: string;
    result?: string;
    teams?: { tag?: string; brawler?: { id?: number; name?: string; power?: number } }[][];
  };
};

/** "20261111T190000.000Z" -> "2026-11-11T19:00:00.000Z" */
function isoTime(t: string): string {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : t;
}

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
    return Response.json({ ranked, last: types });
  }

  const me = `#${tag}`;
  const items = [];
  for (const it of r.data.items ?? []) {
    const b = it.battle;
    if (!b || b.type !== "soloRanked" || !b.teams || b.teams.length !== 2) continue;
    if (b.result !== "victory" && b.result !== "defeat") continue;
    const mine = b.teams.findIndex((team) => team.some((p) => p.tag === me));
    if (mine < 0) continue;
    const ids = (team: { brawler?: { id?: number } }[]) =>
      team.map((p) => p.brawler?.id).filter((x): x is number => typeof x === "number");
    const meInBattle = b.teams[mine].find((p) => p.tag === me)?.brawler;
    const played = meInBattle?.id;
    if (typeof played !== "number") continue;
    items.push({
      date: isoTime(it.battleTime ?? ""),
      mapGameId: it.event?.id ?? 0,
      mapName: it.event?.map ?? "",
      win: b.result === "victory",
      played,
      // Nível usado na partida. No Ranked, os 6 grátis da temporada aparecem como nível 11.
      playedPower: meInBattle?.power ?? 0,
      team: ids(b.teams[mine]),
      enemies: ids(b.teams[1 - mine]),
    });
  }
  return Response.json({ tag, items });
}
