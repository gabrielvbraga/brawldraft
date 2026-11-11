// JUNTA O META AO VIVO COM OS DADOS SALVOS
// Recebe o que foi lido do topbrawl.com e atualiza, no lugar, as listas de
// Brawlers e de mapas que o resto do site usa.

import type { LiveMeta } from "@/lib/livemeta";
import type { Tier } from "@/lib/types";
import { BRAWLERS } from "./brawlers";
import { MAPS } from "./maps";

// Tier de cada Brawler nos dados salvos, guardado antes de qualquer mudança.
const SAVED_TIER = new Map(BRAWLERS.map((b) => [b.id, b.tier]));
const SAVED_TOP = new Map(MAPS.map((m) => [m.id, m.top]));

let appliedAt: string | null = null;

/**
 * Tier a partir da posição no ranking geral ao vivo.
 * Quem está fora do ranking lido mantém o tier salvo, mas sem passar de A
 * (S+ e S ficam só para quem está no topo agora).
 */
function tierFromRank(rank: number, total: number, saved: Tier): Tier {
  if (rank < 0) return saved === "S+" || saved === "S" ? "A" : saved;
  const share = rank / Math.max(total, 1);
  if (rank < 5) return "S+";
  if (rank < 12) return "S";
  if (share < 0.3) return "A";
  if (share < 0.55) return "B";
  if (share < 0.8) return "C";
  return "D";
}

export function applyLive(live: LiveMeta | null) {
  if (!live || live.updatedAt === appliedAt) return;
  appliedAt = live.updatedAt;

  const order = live.overall.map((r) => r.name);
  for (const b of BRAWLERS) {
    const saved = SAVED_TIER.get(b.id) ?? b.tier;
    b.tier = tierFromRank(order.indexOf(b.name), order.length, saved);
  }

  for (const m of MAPS) {
    const rows = live.maps[m.gameId];
    m.top = rows && rows.length > 0 ? rows.slice(0, 10).map((r) => r.name) : (SAVED_TOP.get(m.id) ?? m.top);
  }
}
