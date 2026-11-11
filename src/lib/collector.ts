// COLETOR DE PARTIDAS (a parte que faz as contas)
// Recebe partidas de Ranked da API oficial e soma, para cada Brawler:
//   - vitórias e partidas em cada mapa ............ "maps"
//   - vitórias contra cada outro Brawler .......... "vs"   (chave "A:B" = A contra B)
//   - vitórias jogando junto com outro Brawler .... "with" (chave "A+B", menor id primeiro)
// Os números são guardados como [vitórias, partidas].

export type Pair = [number, number];

export type Collected = {
  updatedAt: string;
  battles: number; // partidas somadas no total (com o desconto do tempo)
  maps: Record<string, Record<string, Pair>>;
  vs: Record<string, Pair>;
  with: Record<string, Pair>;
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
    teams?: { tag?: string; brawler?: { id?: number } }[][];
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
    const mapTable = (stats.maps[String(mapId)] ??= {});
    ids.forEach((team, t) => {
      const won = t === winner;
      for (const id of team) bump(mapTable, String(id), won);
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

/** Versão enxuta para mandar ao navegador: tira os controles e os pares com poucas partidas. */
export function slim(stats: StoredStats): Collected {
  const keep = (t: Record<string, Pair>, min: number) =>
    Object.fromEntries(Object.entries(t).filter(([, p]) => p[1] >= min));
  const maps: Record<string, Record<string, Pair>> = {};
  for (const m of Object.keys(stats.maps)) maps[m] = keep(stats.maps[m], 5);
  return { updatedAt: stats.updatedAt, battles: stats.battles, maps, vs: keep(stats.vs, 10), with: keep(stats.with, 10) };
}
