// JUNTA O META AO VIVO COM OS DADOS SALVOS
// Recebe o que foi lido do topbrawl.com e atualiza, no lugar, as listas de
// Brawlers e de mapas que o resto do site usa.

import type { Collected } from "@/lib/collector";
import type { LiveMeta } from "@/lib/livemeta";
import type { Tier } from "@/lib/types";
import { BRAWLERS } from "./brawlers";
import { MAPS } from "./maps";

// Tier de cada Brawler nos dados salvos, guardado antes de qualquer mudança.
const SAVED_TIER = new Map(BRAWLERS.map((b) => [b.id, b.tier]));
const SAVED_TOP = new Map(MAPS.map((m) => [m.id, m.top]));

let appliedAt: string | null = null;

/**
 * Tier pela % DE VITÓRIAS no Ranked (o 1º é sempre quem mais vence).
 * Quem não aparece na lista lida mantém o tier salvo, mas sem passar de A.
 */
function tierFromRate(wins: number | undefined, saved: Tier): Tier {
  if (wins === undefined) return saved === "S+" || saved === "S" ? "A" : saved;
  if (wins >= 55) return "S+";
  if (wins >= 53) return "S";
  if (wins >= 51.5) return "A";
  if (wins >= 49.5) return "B";
  if (wins >= 47) return "C";
  return "D";
}

export function applyLive(live: LiveMeta | null) {
  if (!live || live.updatedAt === appliedAt) return;
  appliedAt = live.updatedAt;

  // live.overall já vem do maior para o menor % de vitórias.
  const rate = new Map(live.overall.map((r) => [r.name, r.wins]));
  for (const b of BRAWLERS) {
    b.winRate = rate.get(b.name);
    b.tier = tierFromRate(b.winRate, SAVED_TIER.get(b.id) ?? b.tier);
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

const MODES = ["Gem Grab", "Brawl Ball", "Heist", "Hot Zone", "Bounty", "Knockout"];

/** Momento da última coleta (ou o mapa visto mais recentemente). */
function refTime(collected: Collected): number {
  const times = Object.values(collected.recentMaps ?? {}).map((w) => new Date(w).getTime());
  const updated = collected.updatedAt ? new Date(collected.updatedAt).getTime() : 0;
  return Math.max(updated, ...times.filter((x) => !Number.isNaN(x)), 0);
}

/**
 * MAPAS NOVOS: se o coletor viu partidas de Ranked num mapa que o site ainda não
 * conhece (nos últimos 7 dias), o mapa entra na lista sozinho, com foto e modo.
 */
export function applyNewMaps(collected: Collected | null) {
  if (!collected?.mapInfo) return;
  // Conta a partir da última coleta (e não do relógio), para a página poder ser montada antes.
  const limit = refTime(collected) - 7 * 86400000;
  for (const [id, info] of Object.entries(collected.mapInfo)) {
    const gameId = Number(id);
    const seen = collected.recentMaps?.[id];
    if (!seen || new Date(seen).getTime() < limit) continue;
    if (!MODES.includes(info.mode) || MAPS.some((m) => m.gameId === gameId)) continue;
    MAPS.push({
      id: 1000 + MAPS.length,
      name: info.name,
      mode: info.mode,
      top: [],
      gameId,
      imageUrl: `https://cdn.brawlify.com/maps/regular/${gameId}.png`,
    });
  }
}

/** Quantos mapas apareceram no Ranked nos últimos 7 dias (null = sem dados suficientes). */
export function rankedMapCount(collected: Collected | null): number | null {
  if (!collected?.recentMaps) return null;
  // Conta a partir da última coleta (e não do relógio), para a página poder ser montada antes.
  const limit = refTime(collected) - 7 * 86400000;
  const n = Object.values(collected.recentMaps).filter((w) => new Date(w).getTime() >= limit).length;
  return n >= 10 ? n : null;
}
