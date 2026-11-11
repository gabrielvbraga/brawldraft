// Guarda e lê dados no próprio navegador (ficam salvos mesmo fechando o site).

/** Uma partida salva no histórico. */
export type HistoryEntry = {
  date: string; // data e hora em que foi salva
  map: string;
  mode: string;
  played: string; // Brawler que o jogador usou
  team: string[];
  enemies: string[];
  win: boolean;
};

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
