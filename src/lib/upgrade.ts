// QUAL BRAWLER UPAR PRO NÍVEL 11
// Olha os Brawlers que a pessoa tem abaixo do nível 11 (e que não são dos 6 grátis)
// e dá uma nota para cada um: força nos mapas do Ranked de agora (os da rotação,
// ou todos se a rotação não estiver disponível), % de vitórias no meta, quanto a
// pessoa já joga com ele (troféus) e quanto falta para chegar no 11.

import { mapStrength } from "./engine";
import type { RosterItem } from "./storage";
import type { Brawler, GameMap } from "./types";

export type UpgradeTip = {
  brawler: Brawler;
  power: number;
  trophies: number;
  /** Em quantos mapas do conjunto ele fica no tier A ou melhor. */
  good: number;
  total: number;
  /** Os 3 mapas em que ele é mais forte. */
  bestMaps: string[];
  score: number;
};

export function upgradeAdvice(
  brawlers: Brawler[],
  roster: RosterItem[],
  free6: number[],
  maps: GameMap[],
  rotation: Set<number> | null,
  comfort: Record<number, number>,
  limit = 5,
): UpgradeTip[] {
  const today = rotation ? maps.filter((m) => rotation.has(m.gameId)) : [];
  const pool = today.length >= 3 ? today : maps;
  if (pool.length === 0) return [];
  const byId = new Map(brawlers.map((b) => [b.id, b]));

  const tips: UpgradeTip[] = [];
  for (const r of roster) {
    if (r.power >= 11 || free6.includes(r.id)) continue;
    const b = byId.get(r.id);
    if (!b) continue;
    const values = pool
      .map((m) => {
        const s = mapStrength(b, m);
        return { map: m.name, v: s.base + s.bonus };
      })
      .sort((x, y) => y.v - x.v);
    const good = values.filter((x) => x.v >= 8).length;
    const top = values.slice(0, Math.min(5, values.length));
    const avgTop = top.reduce((sum, x) => sum + x.v, 0) / top.length;
    const meta = b.winRate !== undefined ? (b.winRate - 50) * 0.35 : 0;
    const comfy = (comfort[b.id] ?? 0) * 1.2;
    const closeness = (r.power - 1) / 10; // nível 10 já está quase lá
    tips.push({
      brawler: b,
      power: r.power,
      trophies: r.trophies,
      good,
      total: pool.length,
      bestMaps: values.slice(0, 3).map((x) => x.map),
      score: avgTop + (good / pool.length) * 3 + meta + comfy + closeness * 0.6,
    });
  }
  return tips.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Mapas em que a pessoa joga bem (para os avisos no celular):
 * pelo histórico (3+ partidas e 55%+ de vitórias) e, para quem tem pouco histórico,
 * os mapas em que os 3 Brawlers com mais troféus dela estão no top 5.
 */
export function goodMaps(
  history: { map: string; win: boolean }[],
  roster: RosterItem[],
  brawlers: Brawler[],
  maps: GameMap[],
): number[] {
  const out = new Set<number>();
  const byMap = new Map<string, { g: number; w: number }>();
  for (const h of history) {
    const s = byMap.get(h.map) ?? { g: 0, w: 0 };
    s.g++;
    if (h.win) s.w++;
    byMap.set(h.map, s);
  }
  for (const m of maps) {
    const s = byMap.get(m.name);
    if (s && s.g >= 3 && s.w / s.g >= 0.55) out.add(m.gameId);
  }
  if (out.size < 3) {
    const names = new Map(brawlers.map((b) => [b.id, b.name]));
    const fav = [...roster]
      .sort((a, b) => b.trophies - a.trophies)
      .slice(0, 3)
      .map((r) => names.get(r.id))
      .filter((n): n is string => !!n);
    for (const m of maps) if (fav.some((n) => m.top.slice(0, 5).includes(n))) out.add(m.gameId);
  }
  return [...out].slice(0, 40);
}
