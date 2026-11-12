// BRAWLER DO DIA (jogo de adivinhar, no estilo do Wordle)
// Todo mundo tem o mesmo Brawler no mesmo dia (horário de Brasília). Cada palpite
// mostra 5 pistas comparando com a resposta: classe, tier no Ranked, lançamento,
// % de vitórias e a letra inicial do nome.

import type { Brawler, Tier } from "./types";

export const MAX_GUESSES = 6;
const TIER_ORDER: Tier[] = ["D", "C", "B", "A", "S", "S+"];

/** "2026-11-12" no horário de Brasília. */
export function dayKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA já sai como AAAA-MM-DD
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** O Brawler do dia (sempre o mesmo para a mesma data). */
export function answerFor(day: string, brawlers: Brawler[]): Brawler {
  const list = [...brawlers].sort((a, b) => a.id - b.id);
  return list[hash(`brawldraft-${day}`) % list.length];
}

export type Clue = "same" | "up" | "down" | "no" | "unknown";
export type Clues = { cls: Clue; tier: Clue; release: Clue; winRate: Clue; letter: Clue };

/** "up" = a resposta é maior/mais nova/depois no alfabeto; "down" = o contrário. */
export function compare(guess: Brawler, answer: Brawler): Clues {
  const cmp = (a: number, b: number): Clue => (a === b ? "same" : b > a ? "up" : "down");
  const wr = (b: Brawler) => (b.winRate === undefined ? null : Math.round(b.winRate));
  const gw = wr(guess);
  const aw = wr(answer);
  const first = (b: Brawler) => b.name.charAt(0).toUpperCase();
  return {
    cls: guess.class === answer.class ? "same" : "no",
    tier: cmp(TIER_ORDER.indexOf(guess.tier), TIER_ORDER.indexOf(answer.tier)),
    release: cmp(guess.id, answer.id),
    winRate: gw === null || aw === null ? "unknown" : Math.abs(gw - aw) <= 0 ? "same" : aw > gw ? "up" : "down",
    letter: first(guess) === first(answer) ? "same" : first(answer) > first(guess) ? "up" : "down",
  };
}

const EMOJI: Record<Clue, string> = { same: "🟩", up: "⬆️", down: "⬇️", no: "🟥", unknown: "⬜" };

/** Texto para compartilhar (sem revelar o Brawler). */
export function shareText(dayLabel: string, guesses: Clues[], won: boolean, title: string, url: string): string {
  const rows = guesses.map((c) => [c.cls, c.tier, c.release, c.winRate, c.letter].map((x) => EMOJI[x]).join(""));
  return `${title} ${dayLabel} · ${won ? guesses.length : "X"}/${MAX_GUESSES}\n${rows.join("\n")}\n${url}`;
}

export type DailyState = { day: string; guesses: number[]; done: boolean; won: boolean };
export type DailyStats = { played: number; wins: number; streak: number; best: number; lastWinDay: string | null };

/** Atualiza a sequência ao terminar o dia. */
export function finishDay(stats: DailyStats, day: string, won: boolean): DailyStats {
  const yesterday = dayKey(new Date(Date.parse(`${day}T12:00:00-03:00`) - 86400000));
  const streak = won ? (stats.lastWinDay === yesterday ? stats.streak + 1 : 1) : 0;
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
    lastWinDay: won ? day : stats.lastWinDay,
  };
}
