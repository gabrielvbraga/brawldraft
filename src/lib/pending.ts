// DRAFT ESPERANDO O RESULTADO
// Quando um draft ao vivo termina, guardamos o que é preciso para achar a partida
// depois (mapa, seu time, a hora) e se cada pick seu era uma das 3 primeiras sugestões.
// Assim, mesmo que o site seja fechado durante a partida, o resultado é ligado ao draft.

import type { Match } from "./matches";

export type PendingDraft = {
  mapGameId: number;
  mine: number[];
  at: number; // quando o draft terminou (ms)
  followed: Record<number, boolean>;
};

/** A partida (já terminada) que corresponde ao draft: mesmo mapa, depois do draft, com o seu time. */
export function findDraftMatch(items: Match[], p: PendingDraft): Match | null {
  const candidates = items.filter(
    (m) =>
      m.done &&
      m.mapGameId === p.mapGameId &&
      Date.parse(m.date) >= p.at - 3 * 60 * 1000 &&
      Date.parse(m.date) <= p.at + 2 * 3600 * 1000,
  );
  const overlap = (m: Match) => m.team.filter((id) => p.mine.includes(id)).length;
  candidates.sort((a, b) => overlap(b) - overlap(a) || a.date.localeCompare(b.date));
  const best = candidates[0];
  return best && (overlap(best) >= 2 || p.mine.length < 2) ? best : null;
}

/** Igual, mas também devolve a partida ainda em andamento (para mostrar o placar parcial). */
export function findLiveMatch(items: Match[], p: PendingDraft): Match | null {
  const list = items.filter(
    (m) => m.mapGameId === p.mapGameId && Date.parse(m.date) >= p.at - 3 * 60 * 1000 && m.team.filter((id) => p.mine.includes(id)).length >= 2,
  );
  return list.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}
