// LEITURA DO HISTÓRICO DE PARTIDAS DA API (as 25 mais recentes, de todos os modos)
// Usado pelas rotas /api/battles e /api/profile.

import { groupRounds, type Match, type Round } from "./matches";
import { validRank } from "./rank";

export type RawItem = {
  battleTime?: string; // formato da API: 20261111T190000.000Z
  event?: { id?: number; mode?: string; map?: string };
  battle?: {
    type?: string;
    mode?: string;
    result?: string;
    rank?: number; // Combate (showdown): colocação
    trophyChange?: number;
    teams?: { tag?: string; brawler?: { id?: number; name?: string; power?: number; trophies?: number } }[][];
    players?: { tag?: string; brawler?: { id?: number; power?: number; trophies?: number } }[];
  };
};

/** "20261111T190000.000Z" -> "2026-11-11T19:00:00.000Z" */
export function isoTime(t: string): string {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : t;
}

export type RecentSummary = {
  games: number;
  wins: number;
  losses: number;
  ranked: number; // rounds de Ranked
  trophyChange: number;
  /** Brawlers mais usados nas 25 partidas: [id, vezes] */
  mostPlayed: [number, number][];
  /** Modos jogados: [modo, partidas, vitórias] */
  modes: [string, number, number][];
};

export function parseBattlelog(items: RawItem[], tag: string): { matches: Match[]; summary: RecentSummary; rank: number | null } {
  const me = `#${tag}`;
  const rounds: Round[] = [];
  let rank: number | null = null;
  let rankTime = "";
  const summary: RecentSummary = { games: 0, wins: 0, losses: 0, ranked: 0, trophyChange: 0, mostPlayed: [], modes: [] };
  const played = new Map<number, number>();
  const modes = new Map<string, [number, number]>();

  for (const it of items) {
    const b = it.battle;
    if (!b) continue;
    // Resumo de todos os modos
    const mePlayer = b.teams?.flat().find((p) => p.tag === me) ?? b.players?.find((p) => p.tag === me);
    const won = b.result === "victory" || (typeof b.rank === "number" && b.rank <= (b.players ? 4 : 2));
    const lost = b.result === "defeat" || (typeof b.rank === "number" && !won);
    summary.games++;
    if (won) summary.wins++;
    if (lost) summary.losses++;
    if (typeof b.trophyChange === "number") summary.trophyChange += b.trophyChange;
    if (b.type === "soloRanked") summary.ranked++;
    const id = mePlayer?.brawler?.id;
    if (typeof id === "number") played.set(id, (played.get(id) ?? 0) + 1);
    const mode = it.event?.mode ?? b.mode ?? "?";
    const ms = modes.get(mode) ?? [0, 0];
    ms[0]++;
    if (won) ms[1]++;
    modes.set(mode, ms);

    // Partidas de Ranked (rounds) — viram partidas melhor de 3
    if (b.type !== "soloRanked" || !b.teams || b.teams.length !== 2) continue;
    const date = isoTime(it.battleTime ?? "");
    // No Ranked, o campo "trophies" do Brawler traz o rank da pessoa (0 = Bronze I ... 13 = Mítico II).
    const r = mePlayer?.brawler?.trophies;
    if (validRank(r) && date > rankTime) {
      rank = r;
      rankTime = date;
    }
    if (b.result !== "victory" && b.result !== "defeat") continue;
    const mine = b.teams.findIndex((team) => team.some((p) => p.tag === me));
    if (mine < 0 || typeof id !== "number") continue;
    const ids = (team: { brawler?: { id?: number } }[]) => team.map((p) => p.brawler?.id).filter((x): x is number => typeof x === "number");
    rounds.push({
      date,
      mapGameId: it.event?.id ?? 0,
      mapName: it.event?.map ?? "",
      win: b.result === "victory",
      played: id,
      // Nível usado na partida. No Ranked, os 6 grátis da temporada aparecem como nível 11.
      playedPower: mePlayer?.brawler?.power ?? 0,
      team: ids(b.teams[mine]),
      enemies: ids(b.teams[1 - mine]),
      ...(validRank(r) ? { rank: r } : {}),
    });
  }
  summary.mostPlayed = [...played.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  summary.modes = [...modes.entries()].map(([m, [g, w]]) => [m, g, w] as [string, number, number]).sort((a, b) => b[1] - a[1]);
  return { matches: groupRounds(rounds), summary, rank };
}
