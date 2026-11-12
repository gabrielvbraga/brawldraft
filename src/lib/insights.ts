// CONTAS DO HISTÓRICO: alerta de tilt, com quem você ganha mais e o rank na temporada.

import type { HistoryEntry } from "./storage";

const sorted = (h: HistoryEntry[]) => [...h].sort((a, b) => a.date.localeCompare(b.date));

/** Derrotas seguidas mais recentes (só conta se a última foi nas últimas 3 horas). */
export function lossStreak(history: HistoryEntry[], now = Date.now()): number {
  const list = sorted(history);
  const last = list[list.length - 1];
  if (!last || last.win || now - Date.parse(last.date) > 3 * 3600 * 1000) return 0;
  let n = 0;
  for (let i = list.length - 1; i >= 0 && !list[i].win; i--) n++;
  return n;
}

export type Rate = { name: string; games: number; wins: number; rate: number };

function rates(map: Map<string, { g: number; w: number }>, min: number): Rate[] {
  return [...map.entries()]
    .filter(([, s]) => s.g >= min)
    .map(([name, s]) => ({ name, games: s.g, wins: s.w, rate: Math.round((s.w / s.g) * 100) }));
}

/** Seu Brawler com mais vitórias (3+ partidas), para sugerir no tilt. */
export function comfortBest(history: HistoryEntry[]): Rate | null {
  const m = new Map<string, { g: number; w: number }>();
  for (const h of history) {
    const s = m.get(h.played) ?? { g: 0, w: 0 };
    s.g++;
    if (h.win) s.w++;
    m.set(h.played, s);
  }
  return rates(m, 3).sort((a, b) => b.rate - a.rate || b.games - a.games)[0] ?? null;
}

/**
 * Com quem você ganha mais: aliados (do seu time, sem contar você) e inimigos.
 * Só entram Brawlers com pelo menos "min" partidas.
 */
export function alliesAndRivals(history: HistoryEntry[], min = 3) {
  const allies = new Map<string, { g: number; w: number }>();
  const foes = new Map<string, { g: number; w: number }>();
  for (const h of history) {
    for (const name of h.team) {
      if (name === h.played) continue;
      const s = allies.get(name) ?? { g: 0, w: 0 };
      s.g++;
      if (h.win) s.w++;
      allies.set(name, s);
    }
    for (const name of h.enemies) {
      const s = foes.get(name) ?? { g: 0, w: 0 };
      s.g++;
      if (h.win) s.w++;
      foes.set(name, s);
    }
  }
  const a = rates(allies, min);
  const f = rates(foes, min);
  const best = (list: Rate[]) => [...list].sort((x, y) => y.rate - x.rate || y.games - x.games).slice(0, 5);
  const worst = (list: Rate[]) => [...list].sort((x, y) => x.rate - y.rate || y.games - x.games).slice(0, 5);
  return {
    bestAllies: best(a),
    worstAllies: worst(a).filter((x) => x.rate < 50),
    easyFoes: best(f).filter((x) => x.rate > 50),
    hardFoes: worst(f).filter((x) => x.rate < 50),
    enough: a.length > 0 || f.length > 0,
  };
}

/** Rank mais recente que apareceu nas partidas. */
export function currentRank(history: HistoryEntry[]): number | null {
  const list = sorted(history).filter((h) => h.rank !== undefined);
  return list.length ? (list[list.length - 1].rank as number) : null;
}

/** Rank no fim de cada dia (só os dias com partida). */
export function rankByDay(history: HistoryEntry[]): { day: string; rank: number }[] {
  const out = new Map<string, number>();
  for (const h of sorted(history)) if (h.rank !== undefined) out.set(h.date.slice(0, 10), h.rank);
  return [...out.entries()].map(([day, rank]) => ({ day, rank }));
}
