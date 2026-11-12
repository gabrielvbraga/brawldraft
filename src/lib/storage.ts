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
  for (const h of [...a, ...b]) byDate.set(h.date, h);
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
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
