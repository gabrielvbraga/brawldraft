// Guarda e lê dados no próprio navegador (ficam salvos mesmo fechando o site),
// e as contas feitas em cima do histórico (relatório semanal, metas de treino).

/** Uma partida salva no histórico. */
export type HistoryEntry = {
  date: string; // data e hora da partida (ISO). Também identifica a partida.
  map: string;
  mode: string;
  played: string; // Brawler que o jogador usou
  team: string[];
  enemies: string[];
  win: boolean;
  /** "auto" = veio sozinha pela tag; "manual" = marcada no fim de um draft. */
  source?: "auto" | "manual";
  /** Marcada no fim do draft: o Brawler jogado era uma das 3 primeiras sugestões do site? */
  followed?: boolean;
  /** Placar em rounds [vencidos, perdidos] (o Ranked é melhor de 3). */
  rounds?: [number, number];
};

/** Um Brawler do jogador, como vem da importação pela tag. */
export type RosterItem = { id: number; power: number; trophies: number };

/** Vitórias e derrotas por Brawler: { "Shelly": { w: 3, l: 1 } }. */
export type Personal = Record<string, { w: number; l: number }>;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Navegador sem permissão para salvar: segue sem guardar.
  }
}

/** Soma vitórias e derrotas de cada Brawler jogado. */
export function personalStats(history: HistoryEntry[]): Personal {
  const out: Personal = {};
  for (const h of history) {
    const s = (out[h.played] ??= { w: 0, l: 0 });
    if (h.win) s.w++;
    else s.l++;
  }
  return out;
}

/** Junta dois históricos sem repetir partidas (a data identifica cada uma). */
export function mergeHistory(a: HistoryEntry[], b: HistoryEntry[]): HistoryEntry[] {
  const byDate = new Map<string, HistoryEntry>();
  for (const h of [...a, ...b]) {
    const old = byDate.get(h.date);
    // A versão mais nova vale, mas sem perder o "seguiu a sugestão" da antiga.
    byDate.set(h.date, old ? { ...old, ...h, followed: h.followed ?? old.followed } : h);
  }
  return cleanHistory([...byDate.values()]);
}

const sideKey = (names: string[]) => [...names].sort().join(",");
const ROUND_GAP = 20 * 60 * 1000;
const MANUAL_GAP = 45 * 60 * 1000;

/**
 * Arruma o histórico:
 *  1) rounds da mesma partida (mesmo mapa, mesmos 6 Brawlers, poucos minutos de diferença)
 *     viram uma partida só — o Ranked é melhor de 3 e a API manda cada round separado;
 *  2) um resultado marcado na mão no fim do draft some quando a partida de verdade chega
 *     pela tag (o "seguiu a sugestão" passa para ela).
 */
export function cleanHistory(list: HistoryEntry[]): HistoryEntry[] {
  const sorted = [...list].sort((x, y) => x.date.localeCompare(y.date));
  const autos: HistoryEntry[] = [];
  const manuals: HistoryEntry[] = [];
  for (const h of sorted) {
    if (h.source !== "auto") {
      manuals.push(h);
      continue;
    }
    const cur = autos[autos.length - 1];
    const same =
      cur &&
      cur.map === h.map &&
      sideKey(cur.team) === sideKey(h.team) &&
      sideKey(cur.enemies) === sideKey(h.enemies) &&
      Date.parse(h.date) - Date.parse(cur.date) <= ROUND_GAP;
    if (!same) {
      autos.push({ ...h });
      continue;
    }
    const a: [number, number] = cur.rounds ?? (cur.win ? [1, 0] : [0, 1]);
    const b: [number, number] = h.rounds ?? (h.win ? [1, 0] : [0, 1]);
    // Rounds soltos (versão antiga do histórico) somam; partidas já juntadas: fica a mais completa.
    const rounds: [number, number] =
      !cur.rounds || !h.rounds ? [a[0] + b[0], a[1] + b[1]] : a[0] + a[1] >= b[0] + b[1] ? a : b;
    cur.rounds = rounds;
    cur.win = rounds[0] !== rounds[1] ? rounds[0] > rounds[1] : h.win;
    cur.played = h.played;
    cur.followed = cur.followed ?? h.followed;
  }
  const keptManual: HistoryEntry[] = [];
  for (const m of manuals) {
    const t = Date.parse(m.date);
    const real = autos.find((h) => h.map === m.map && h.played === m.played && Math.abs(Date.parse(h.date) - t) <= MANUAL_GAP);
    if (real) real.followed = real.followed ?? m.followed;
    else keptManual.push(m);
  }
  return [...autos, ...keptManual].sort((x, y) => x.date.localeCompare(y.date));
}

/** Quem conta como "seu" no Ranked: nível 11 (pela tag) + os 6 grátis da temporada. */
export function rankedOwned(roster: RosterItem[], free6: number[]): number[] {
  return [...new Set([...roster.filter((r) => r.power >= 11).map((r) => r.id), ...free6])];
}

/**
 * Conforto: Brawlers com mais troféus pesam mais na recomendação (de 0 a 1,5).
 * Só os 15 com mais troféus ganham bônus, e o maior bônus vai para o 1º.
 */
export function comfortScores(roster: RosterItem[]): Record<number, number> {
  const sorted = [...roster].filter((r) => r.trophies > 0).sort((a, b) => b.trophies - a.trophies);
  const out: Record<number, number> = {};
  sorted.slice(0, 15).forEach((r, i) => {
    out[r.id] = Math.round((1.5 - i * 0.1) * 100) / 100;
  });
  return out;
}

/** Partidas dos últimos N dias. */
export function lastDays(history: HistoryEntry[], days: number, now = Date.now()) {
  const from = now - days * 24 * 60 * 60 * 1000;
  return history.filter((h) => new Date(h.date).getTime() >= from);
}

/** Agrupa partidas e conta vitórias, do grupo com mais partidas para o com menos. */
export function groupBy(history: HistoryEntry[], key: (h: HistoryEntry) => string) {
  const stats = new Map<string, { games: number; wins: number }>();
  for (const h of history) {
    const s = stats.get(key(h)) ?? { games: 0, wins: 0 };
    s.games++;
    if (h.win) s.wins++;
    stats.set(key(h), s);
  }
  return [...stats.entries()].sort((a, b) => b[1].games - a[1].games);
}
