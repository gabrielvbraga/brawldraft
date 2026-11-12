// COLETOR DE PARTIDAS (a parte que faz as contas)
// Recebe partidas de Ranked da API oficial e soma, para cada Brawler:
//   - vitórias e partidas em cada mapa ............ "maps"
//   - vitórias contra cada outro Brawler .......... "vs"   (chave "A:B" = A contra B)
//   - vitórias jogando junto com outro Brawler .... "with" (chave "A+B", menor id primeiro)
//   - vitórias por faixa de Ranked (Bronze...) .... "byRank"
//   - quando cada mapa apareceu pela última vez ... "recentMaps" (para a rotação de hoje)
// Os números são guardados como [vitórias, partidas].

export type Pair = [number, number];

export type Collected = {
  updatedAt: string;
  battles: number; // partidas somadas no total (com o desconto do tempo)
  maps: Record<string, Record<string, Pair>>;
  vs: Record<string, Pair>;
  with: Record<string, Pair>;
  /** Faixa de Ranked -> Brawler -> [vitórias, partidas]. */
  byRank: Record<string, Record<string, Pair>>;
  /** Mapa -> data da última partida de Ranked vista nele. */
  recentMaps: Record<string, string>;
};

/** O que fica guardado no banco: as contas + controles do coletor. */
export type StoredStats = Collected & {
  seen: string[]; // partidas já contadas (para não contar duas vezes)
  queue: string[]; // tags de jogadores achados nas partidas, para visitar depois
};

export const emptyStats = (): StoredStats => ({
  updatedAt: new Date(0).toISOString(),
  battles: 0,
  maps: {},
  vs: {},
  with: {},
  byRank: {},
  recentMaps: {},
  seen: [],
  queue: [],
});

// Formato (parcial) de uma partida no histórico da API oficial.
export type RawBattle = {
  battleTime?: string;
  event?: { id?: number };
  battle?: {
    type?: string;
    result?: string;
    teams?: { tag?: string; brawler?: { id?: number; trophies?: number } }[][];
  };
};

function bump(table: Record<string, Pair>, key: string, win: boolean) {
  const p = table[key] ?? [0, 0];
  p[0] += win ? 1 : 0;
  p[1] += 1;
  table[key] = p;
}

/**
 * Multiplica tudo por "factor" (ex.: 0,9) antes de somar partidas novas.
 * Assim as partidas antigas pesam cada vez menos e o meta acompanha as mudanças.
 */
export function decay(stats: StoredStats, factor: number) {
  const shrink = (t: Record<string, Pair>) => {
    for (const k of Object.keys(t)) {
      t[k] = [Math.round(t[k][0] * factor * 100) / 100, Math.round(t[k][1] * factor * 100) / 100];
      if (t[k][1] < 0.5) delete t[k]; // sobrou quase nada: apaga
    }
  };
  for (const m of Object.keys(stats.maps)) shrink(stats.maps[m]);
  for (const r of Object.keys(stats.byRank)) shrink(stats.byRank[r]);
  shrink(stats.vs);
  shrink(stats.with);
  stats.battles = Math.round(stats.battles * factor);
}

/**
 * Soma as partidas de Ranked do histórico de um jogador.
 * Devolve quantas partidas novas foram contadas e as tags dos outros jogadores.
 */
export function addBattles(stats: StoredStats, seen: Set<string>, ownerTag: string, log: RawBattle[]) {
  let added = 0;
  const others: string[] = [];
  for (const item of log) {
    const b = item.battle;
    if (!b || b.type !== "soloRanked" || !b.teams || b.teams.length !== 2) continue;
    if (b.result !== "victory" && b.result !== "defeat") continue; // empate não conta
    const mapId = item.event?.id;
    if (!mapId) continue;

    const tags = b.teams.flat().map((p) => p.tag ?? "");
    const key = `${item.battleTime}|${[...tags].sort().join(",")}`;
    if (seen.has(key)) continue; // a mesma partida aparece no histórico dos 6 jogadores
    seen.add(key);

    // Qual time venceu: o resultado é do ponto de vista do dono do histórico.
    const ownerTeam = b.teams.findIndex((team) => team.some((p) => p.tag === ownerTag));
    if (ownerTeam < 0) continue;
    const winner = b.result === "victory" ? ownerTeam : 1 - ownerTeam;

    const ids = b.teams.map((team) => team.map((p) => p.brawler?.id).filter((x): x is number => typeof x === "number"));

    // Faixa de Ranked: nas partidas de Ranked, o campo "trophies" do Brawler traz o rank (1 a 22).
    const ranks = b.teams.flat().map((p) => p.brawler?.trophies).filter((x): x is number => typeof x === "number");
    const avg = ranks.length ? ranks.reduce((s, x) => s + x, 0) / ranks.length : 0;
    const band = avg >= 1 && avg <= 22 ? rankBand(avg) : null;
    const rankTable = band ? (stats.byRank[band] ??= {}) : null;

    // Rotação: guarda a data mais recente em que este mapa apareceu.
    const when = isoTime(item.battleTime ?? "");
    if (when && (!stats.recentMaps[String(mapId)] || stats.recentMaps[String(mapId)] < when)) stats.recentMaps[String(mapId)] = when;
    const mapTable = (stats.maps[String(mapId)] ??= {});
    ids.forEach((team, t) => {
      const won = t === winner;
      for (const id of team) {
        bump(mapTable, String(id), won);
        if (rankTable) bump(rankTable, String(id), won);
      }
      for (let i = 0; i < team.length; i++)
        for (let j = i + 1; j < team.length; j++) {
          const [a, c] = [team[i], team[j]].sort((x, y) => x - y);
          bump(stats.with, `${a}+${c}`, won);
        }
      for (const id of team) for (const foe of ids[1 - t]) bump(stats.vs, `${id}:${foe}`, won);
    });

    stats.battles += 1;
    added += 1;
    for (const tag of tags) if (tag && tag !== ownerTag) others.push(tag);
  }
  return { added, others };
}

/** Faixas de Ranked, do rank 1 ao 22 (3 ranks por faixa; Mestre e acima juntos). */
export const RANK_BANDS = ["bronze", "silver", "gold", "diamond", "mythic", "legendary", "masters"] as const;
export function rankBand(rank: number): string {
  return RANK_BANDS[Math.min(6, Math.floor((Math.round(rank) - 1) / 3))];
}

/** "20261111T190000.000Z" -> "2026-11-11T19:00:00.000Z" */
function isoTime(t: string): string {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : "";
}

/** Versão enxuta para mandar ao navegador: tira os controles e os pares com poucas partidas. */
export function slim(stats: StoredStats): Collected {
  const keep = (t: Record<string, Pair>, min: number) =>
    Object.fromEntries(Object.entries(t).filter(([, p]) => p[1] >= min));
  const maps: Record<string, Record<string, Pair>> = {};
  for (const m of Object.keys(stats.maps)) maps[m] = keep(stats.maps[m], 5);
  const byRank: Record<string, Record<string, Pair>> = {};
  for (const r of Object.keys(stats.byRank ?? {})) byRank[r] = keep(stats.byRank[r], 5);
  return {
    updatedAt: stats.updatedAt,
    battles: stats.battles,
    maps,
    vs: keep(stats.vs, 10),
    with: keep(stats.with, 10),
    byRank,
    recentMaps: stats.recentMaps ?? {},
  };
}
