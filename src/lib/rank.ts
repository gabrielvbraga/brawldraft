// RANKS DO RANKED
// A API manda o rank como número, começando do zero:
// 0-2 Bronze I-III, 3-5 Prata, 6-8 Ouro, 9-11 Diamante, 12-14 Mítico,
// 15-17 Lendário, 18-20 Mestre, 21 Pro. (Ex.: 13 = Mítico II.)

import type { Lang } from "./i18n";

const TIERS: { pt: string; en: string; color: string }[] = [
  { pt: "Bronze", en: "Bronze", color: "#b8763e" },
  { pt: "Prata", en: "Silver", color: "#8f9bb0" },
  { pt: "Ouro", en: "Gold", color: "#e0a91b" },
  { pt: "Diamante", en: "Diamond", color: "#3b9dea" },
  { pt: "Mítico", en: "Mythic", color: "#a855f7" },
  { pt: "Lendário", en: "Legendary", color: "#ef4444" },
  { pt: "Mestre", en: "Masters", color: "#f59e0b" },
];
const PRO = { pt: "Pro", en: "Pro", color: "#10b981" };
export const MAX_RANK = 21;

export function validRank(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_RANK;
}

/** "Mítico II" / "Mythic II" */
export function rankName(lang: Lang, n: number): string {
  if (n >= MAX_RANK) return PRO[lang];
  const tier = TIERS[Math.floor(n / 3)];
  return `${tier[lang]} ${["I", "II", "III"][n % 3]}`;
}

export function rankColor(n: number): string {
  return n >= MAX_RANK ? PRO.color : TIERS[Math.floor(n / 3)].color;
}

/** Faixa larga (para o meta por rank do coletor). */
export const RANK_BANDS = ["bronze", "silver", "gold", "diamond", "mythic", "legendary", "masters"] as const;
export function rankBand(n: number): string {
  return RANK_BANDS[Math.min(6, Math.floor(Math.max(0, Math.round(n)) / 3))];
}
