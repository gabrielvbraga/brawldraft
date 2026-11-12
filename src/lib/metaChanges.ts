// QUEM SUBIU E QUEM CAIU NO META (conta feita em cima das cópias diárias do coletor).

/** Uma cópia diária do ranking geral do topbrawl (guardada pelo coletor). */
export type MetaDay = { day: string; overall: { name: string; wins: number; use: number }[] };

/** Quem subiu e quem caiu entre a cópia mais nova e uma de "days" dias atrás. */
export function metaChanges(history: MetaDay[], days = 7) {
  if (history.length < 2) return null;
  const now = history[0];
  const target = new Date(new Date(now.day).getTime() - days * 86400000).toISOString().slice(0, 10);
  const before = history.find((h) => h.day <= target) ?? history[history.length - 1];
  if (before.day === now.day) return null;
  const old = new Map(before.overall.map((r, i) => [r.name, { ...r, rank: i }]));
  const cur = new Map(now.overall.map((r, i) => [r.name, { ...r, rank: i }]));
  const moves = now.overall
    .filter((r) => old.has(r.name))
    .map((r) => ({ name: r.name, delta: Math.round((r.wins - (old.get(r.name)?.wins ?? r.wins)) * 10) / 10 }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => b.delta - a.delta);
  return {
    from: before.day,
    to: now.day,
    up: moves.filter((m) => m.delta > 0).slice(0, 5),
    down: moves.filter((m) => m.delta < 0).reverse().slice(0, 5),
    entered: now.overall.filter((r) => !old.has(r.name)).map((r) => r.name),
    left: before.overall.filter((r) => !cur.has(r.name)).map((r) => r.name),
  };
}
