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
 * Tier pela posição no ranking ao vivo, que já vem ordenado por % DE VITÓRIAS
 * (o 1º é sempre quem mais vence). Quem não aparece no ranking lido mantém o
 * tier salvo, mas sem passar de A (S+ e S ficam só para quem está no topo agora).
 */
function tierFromRank(rank: number, saved: Tier): Tier {
  if (rank < 0) return saved === "S+" || saved === "S" ? "A" : saved;
  if (rank < 3) return "S+";
  if (rank < 7) return "S";
  return "A";
}

export function applyLive(live: LiveMeta | null) {
  if (!live || live.updatedAt === appliedAt) return;
  appliedAt = live.updatedAt;

  // live.overall já vem do maior para o menor % de vitórias.
  const order = live.overall.map((r) => r.name);
  for (const b of BRAWLERS) {
    const rank = order.indexOf(b.name);
    b.tier = tierFromRank(rank, SAVED_TIER.get(b.id) ?? b.tier);
    b.winRate = rank >= 0 ? live.overall[rank].wins : undefined;
  }

  for (const m of MAPS) {
    const rows = live.maps[m.gameId];
    if (rows && rows.length > 0) {
      m.top = rows.slice(0, 10).map((r) => r.name);
      m.topRates = rows.slice(0, 10).map((r) => r.wins);
    } else {
      m.top = SAVED_TOP.get(m.id) ?? m.top;
      m.topRates = undefined;
    }
  }
}
