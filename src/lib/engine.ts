// MOTOR DE RECOMENDAÇÃO
// Dá uma nota para cada Brawler disponível somando estes fatores:
//   base (meta + modo) + mapa + counter + sinergia + composição - risco + histórico pessoal + conforto
//
// De onde vêm os confrontos (counters e sinergias), do mais confiável para o menos:
//   1. correções do administrador ........... painel do admin (tabela "overrides" no Supabase)
//   2. partidas reais do coletor ............ src/lib/collector.ts
//   3. lista feita à mão .................... src/data/meta.json
//   4. regras gerais por classe ............. BEATS, logo abaixo
// A força no mapa vem do meta do topbrawl (src/data/maps.ts e o meta ao vivo).

import meta from "@/data/meta.json";
import type { Collected } from "./collector";
import { STR, className, modeName, type Lang } from "./i18n";
import type { HistoryEntry, Personal } from "./storage";
import type { Brawler, GameMap, Recommendation, Tier } from "./types";

export type Side = "mine" | "enemy";

/** Quanto vale cada tier (0 a 10). */
const TIER_VALUE: Record<Tier, number> = { "S+": 10, S: 9, A: 7.5, B: 6, C: 4.5, D: 3 };

/** Bônus por estar entre os 10 mais fortes do mapa (do 1º ao 10º). */
const TOP_BONUS = [4, 3.5, 3, 2.6, 2.2, 1.9, 1.6, 1.3, 1.1, 0.9];

/** O quanto cada classe costuma render em cada modo (0 a 10). */
const MODE_FIT: Record<string, Record<string, number>> = {
  "Gem Grab": { Controller: 8, Support: 8, "Damage Dealer": 7, Marksman: 6, Tank: 6, Artillery: 6, Assassin: 5 },
  "Brawl Ball": { Tank: 8, "Damage Dealer": 7, Controller: 7, Assassin: 7, Support: 7, Artillery: 5, Marksman: 4 },
  Heist: { "Damage Dealer": 9, Tank: 6, Assassin: 6, Artillery: 6, Marksman: 6, Controller: 5, Support: 4 },
  "Hot Zone": { Controller: 8, Artillery: 8, Tank: 7, "Damage Dealer": 7, Support: 7, Assassin: 5, Marksman: 4 },
  Bounty: { Marksman: 9, Artillery: 6, Controller: 6, "Damage Dealer": 6, Support: 6, Assassin: 5, Tank: 3 },
  Knockout: { Marksman: 8, Controller: 7, "Damage Dealer": 7, Artillery: 6, Support: 6, Assassin: 6, Tank: 4 },
};

/** BEATS[a][b] = vantagem da classe "a" contra a classe "b" (1 = leve, 2 = forte). */
const BEATS: Record<string, Record<string, number>> = {
  Assassin: { Marksman: 2, Artillery: 2, Support: 1 },
  Tank: { Assassin: 2, Artillery: 1 },
  "Damage Dealer": { Tank: 2, Assassin: 1 },
  Marksman: { "Damage Dealer": 1, Controller: 1, Support: 1 },
  Artillery: { "Damage Dealer": 1, Controller: 1 },
  Controller: { Assassin: 1, Tank: 1 },
  Support: {},
};

// ----- Dados que chegam depois que o site abre -----

let COLLECTED: Collected | null = null;
/** Recebe as contas do coletor. */
export function setCollected(c: Collected | null) {
  COLLECTED = c;
}

/** Correções feitas pelo administrador no painel. Valem mais que tudo. */
export type Overrides = {
  counters: { strong: string; weak: string; value: number }[];
  synergies: { a: string; b: string; value: number }[];
  tips: Record<string, string>; // dica de cada mapa, pelo número do mapa no jogo
};
let OVERRIDES: Overrides = { counters: [], synergies: [], tips: {} };
export function setOverrides(o: Overrides | null) {
  OVERRIDES = o ?? { counters: [], synergies: [], tips: {} };
}
export function mapTip(map: GameMap): string | null {
  return OVERRIDES.tips[String(map.gameId)] || null;
}

/**
 * Vantagem calculada das partidas reais, de -2 a +2, encolhida quando há poucas
 * partidas (com 12 partidas vale pouco; com 100 ou mais, quase o valor inteiro).
 */
function realEdge(table: Record<string, [number, number]> | undefined, key: string): number | null {
  const p = table?.[key];
  if (!p || p[1] < 12) return null;
  const wr = p[0] / p[1];
  return clamp((wr - 0.5) * 8 * (p[1] / (p[1] + 15)), -2, 2);
}

/** % de vitórias (de 0 a 1) de uma chave, se tiver partidas suficientes. */
function rate(table: Record<string, [number, number]> | undefined, key: string, minGames: number): number | null {
  const p = table?.[key];
  return p && p[1] >= minGames ? p[0] / p[1] : null;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Momento do pick: o primeiro do time, os do meio, ou o último. */
export type PickStage = "first" | "middle" | "last";

// Pesos de cada fator. Mexer aqui muda o "jeito de pensar" do sistema.
const W = { tier: 0.6, mode: 0.4, counter: 1.5, synergy: 1, risk: 0.4 };

/** Procura um par numa lista de counters ("strong" vence "weak"). */
function fromList(list: { strong: string; weak: string; value: number }[], a: Brawler, b: Brawler): number | null {
  for (const c of list) {
    if (c.strong === a.name && c.weak === b.name) return c.value;
    if (c.strong === b.name && c.weak === a.name) return -c.value;
  }
  return null;
}

/**
 * Vantagem de "a" sobre "b", de -2 (perde feio) a +2 (vence fácil), e se ela vem
 * de um dado específico do par (admin, partidas reais, lista própria) ou só da classe.
 */
export function matchupInfo(a: Brawler, b: Brawler): { value: number; specific: boolean } {
  const admin = fromList(OVERRIDES.counters, a, b);
  if (admin !== null) return { value: admin, specific: true };
  const real = realEdge(COLLECTED?.vs, `${a.id}:${b.id}`);
  if (real !== null) return { value: real, specific: true };
  const hand = fromList(meta.counters, a, b);
  if (hand !== null) return { value: hand, specific: true };
  return { value: (BEATS[a.class]?.[b.class] ?? 0) - (BEATS[b.class]?.[a.class] ?? 0), specific: false };
}

/** Vantagem de "a" sobre "b", de -2 (perde feio) a +2 (vence fácil). */
export function matchup(a: Brawler, b: Brawler): number {
  return matchupInfo(a, b).value;
}

/** O quanto "a" e "b" combinam no mesmo time, de 0 a 2. */
export function synergy(a: Brawler, b: Brawler): number {
  for (const s of OVERRIDES.synergies) {
    if ((s.a === a.name && s.b === b.name) || (s.a === b.name && s.b === a.name)) return s.value;
  }
  const [x, y] = [a.id, b.id].sort((p, q) => p - q);
  const real = realEdge(COLLECTED?.with, `${x}+${y}`);
  if (real !== null) return Math.max(0, real);
  for (const s of meta.synergies) {
    if ((s.a === a.name && s.b === b.name) || (s.a === b.name && s.b === a.name)) return s.value;
  }
  return 0;
}

/** Quantas classes levam vantagem sobre esta (quanto maior, mais fácil de counterar). */
function vulnerability(cls: string): number {
  let total = 0;
  for (const other of Object.keys(BEATS)) total += BEATS[other][cls] ?? 0;
  return total;
}

/** Força do Brawler no mapa, sem olhar para os picks: base (meta + modo) e bônus do mapa. */
export function mapStrength(b: Brawler, map: GameMap) {
  const base = TIER_VALUE[b.tier] * W.tier + (MODE_FIT[map.mode]?.[b.class] ?? 5) * W.mode;
  const pos = map.top.slice(0, TOP_BONUS.length).indexOf(b.name); // -1 quando não está entre os 10
  let bonus = pos >= 0 ? TOP_BONUS[pos] : 0;
  // Partidas reais neste mapa (pelo menos 20) ajustam o bônus para cima ou para baixo.
  const real = rate(COLLECTED?.maps[String(map.gameId)], String(b.id), 20);
  if (real !== null) bonus += clamp((real - 0.5) * 12, -1.5, 2);
  return { base, bonus, pos, real };
}

/**
 * De quem é a vez de escolher, seguindo a ordem do Ranked (1-2-2-1).
 * Devolve null quando os 6 picks já foram feitos.
 */
export function nextTurn(first: Side, mineCount: number, enemyCount: number): Side | null {
  const other: Side = first === "mine" ? "enemy" : "mine";
  const order: Side[] = [first, other, other, first, first, other];
  let m = 0;
  let e = 0;
  for (const side of order) {
    if (side === "mine") {
      if (m < mineCount) m++;
      else return "mine";
    } else {
      if (e < enemyCount) e++;
      else return "enemy";
    }
  }
  return null;
}

/** Sugestões de ban: os Brawlers mais fortes neste mapa que ainda não foram banidos. */
export function suggestBans(brawlers: Brawler[], map: GameMap, bans: number[], amount = 6): Brawler[] {
  return brawlers
    .filter((b) => !bans.includes(b.id))
    .map((b) => {
      const s = mapStrength(b, map);
      return { b, value: s.base + s.bonus };
    })
    .sort((x, y) => y.value - x.value)
    .slice(0, amount)
    .map((x) => x.b);
}

type DraftState = {
  brawlers: Brawler[];
  map: GameMap;
  bans: number[];
  mine: number[];
  enemies: number[];
  /** Se informado, só recomenda Brawlers desta lista (os que o jogador tem). */
  allowed?: Set<number>;
  /** Vitórias e derrotas do jogador com cada Brawler (vem do histórico). */
  personal?: Personal;
  /** Bônus de conforto de cada Brawler (pelos troféus do jogador), de 0 a 1,5. */
  comfort?: Record<number, number>;
  /** Idioma das frases de explicação. */
  lang?: Lang;
  /** Momento do pick: muda o peso do counter (vale mais no último pick). */
  stage?: PickStage;
};

/** Calcula o ranking completo, do melhor para o pior. */
export function recommend(state: DraftState): Recommendation[] {
  const { brawlers, map, bans, mine, enemies, allowed, personal, comfort } = state;
  const lang = state.lang ?? "pt";
  const t = STR[lang];
  const byId = new Map(brawlers.map((b) => [b.id, b]));
  const pick = (ids: number[]) => ids.map((id) => byId.get(id)).filter((b): b is Brawler => !!b);

  const allies = pick(mine);
  const foes = pick(enemies);
  const used = new Set([...bans, ...mine, ...enemies]);
  const enemyPicksLeft = 3 - foes.length; // quantos picks o inimigo ainda tem para responder
  // No primeiro pick quase não há inimigos para counterar; no último, o counter é o principal.
  const counterWeight = W.counter * (state.stage === "last" ? 1.6 : state.stage === "first" ? 0.7 : 1);
  // Brawlers que o inimigo ainda pode escolher (para o alerta de armadilha).
  const free = brawlers.filter((x) => !used.has(x.id));

  const result: Recommendation[] = [];

  for (const b of brawlers) {
    if (used.has(b.id)) continue;
    if (allowed && !allowed.has(b.id)) continue;
    const reasons: string[] = [];

    // 1) BASE (meta atual + modo) e 2) MAPA
    const s = mapStrength(b, map);
    if (s.pos >= 0) reasons.push(t.rTop(s.pos + 1, map.name));
    if (s.real !== null) reasons.push(t.rRealMap(Math.round(s.real * 100)));
    if (b.tier === "S+" || b.tier === "S") reasons.push(t.rTier(b.tier));
    else if (b.tier === "D") reasons.push(t.rWeak);
    if (s.pos < 0 && (MODE_FIT[map.mode]?.[b.class] ?? 5) <= 4) reasons.push(t.rBadMode(modeName(lang, map.mode)));

    // 3) COUNTER
    let counter = 0;
    const good: string[] = [];
    const bad: string[] = [];
    for (const f of foes) {
      const v = matchup(b, f);
      counter += v;
      if (v > 0) good.push(f.name);
      if (v < 0) bad.push(f.name);
    }
    if (good.length) reasons.push(t.rCounters(good.join(", ")));
    if (bad.length) reasons.push(t.rSuffers(bad.join(", ")));

    // 4) SINERGIA
    let syn = 0;
    const partners: string[] = [];
    for (const a of allies) {
      const v = synergy(b, a);
      syn += v;
      if (v > 0) partners.push(a.name);
    }
    if (partners.length) reasons.push(t.rSynergy(partners.join(", ")));

    // 5) COMPOSIÇÃO (evitar classe repetida no time)
    let comp = 0;
    if (allies.length > 0) {
      const repeated = allies.filter((a) => a.class === b.class).length;
      if (repeated > 0) {
        comp = -1.5 * repeated;
        reasons.push(t.rRepeated);
      } else {
        comp = 1;
        reasons.push(t.rBrings(className(lang, b.class)));
      }
    }

    // 6) RISCO (pesa mais quando o inimigo ainda tem muitos picks para responder)
    const vuln = vulnerability(b.class);
    const risk = vuln * W.risk * (enemyPicksLeft / 3);
    if (enemyPicksLeft >= 2 && vuln >= 4) reasons.push(t.rRisky);

    // 7) HISTÓRICO PESSOAL (só conta a partir de 3 partidas com o Brawler)
    let own = 0;
    const record = personal?.[b.name];
    if (record && record.w + record.l >= 3) {
      const games = record.w + record.l;
      const r = record.w / games;
      own = (r - 0.5) * 4; // de -2 (0% de vitórias) a +2 (100%)
      reasons.push(t.rPersonal(Math.round(r * 100), games));
    }

    // 8) CONFORTO (os Brawlers com mais troféus do jogador)
    const comf = comfort?.[b.id] ?? 0;
    if (comf >= 0.5) reasons.push(t.rComfort);

    // ALERTA DE ARMADILHA: um counter forte dele ainda está livre e o inimigo ainda escolhe.
    let trap: string | undefined;
    if (enemyPicksLeft > 0) {
      let worst = 1.5; // só avisa de counter forte
      for (const c of free) {
        if (c.id === b.id) continue;
        const v = matchup(c, b);
        if (v >= worst) {
          worst = v;
          trap = c.name;
        }
      }
    }

    const parts = {
      base: s.base,
      map: s.bonus,
      counter: counter * counterWeight,
      synergy: syn * W.synergy,
      comp,
      risk: -risk,
      personal: own,
      comfort: comf,
    };
    const score =
      parts.base + parts.map + parts.counter + parts.synergy + parts.comp + parts.risk + parts.personal + parts.comfort;
    result.push({ brawler: b, score, parts, reasons, trap });
  }

  return result.sort((x, y) => y.score - x.score);
}

// ======================= FERRAMENTAS EXTRAS =======================

/**
 * Quem vence "target" (counters) e quem perde para ele. Os confrontos com dado
 * específico do par vêm primeiro; os que só seguem a regra da classe vêm depois.
 */
export function countersOf(target: Brawler, brawlers: Brawler[]) {
  const all = brawlers
    .filter((b) => b.id !== target.id)
    .map((b) => ({ brawler: b, ...matchupInfo(b, target) }));
  const order = (x: { value: number; specific: boolean }, y: { value: number; specific: boolean }) =>
    Number(y.specific) - Number(x.specific) || Math.abs(y.value) - Math.abs(x.value);
  return {
    beatIt: all.filter((x) => x.value > 0).sort(order),
    losesToIt: all.filter((x) => x.value < 0).sort(order),
  };
}

/** Força de um time completo no mapa (para a nota final do draft). */
function teamPower(team: Brawler[], foes: Brawler[], map: GameMap) {
  let total = 0;
  for (const b of team) {
    const s = mapStrength(b, map);
    total += s.base + s.bonus;
    for (const f of foes) total += matchup(b, f) * 0.8;
  }
  for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) total += synergy(team[i], team[j]);
  const classes = new Set(team.map((b) => b.class));
  total += (classes.size - team.length) * 1.2; // classes repetidas pesam contra
  return total;
}

/** Os papéis que um time cobre (para apontar o que está faltando). */
function roles(team: Brawler[]) {
  const has = (c: string[]) => team.some((b) => c.includes(b.class));
  return {
    front: has(["Tank"]),
    control: has(["Controller", "Artillery"]),
    range: has(["Marksman", "Artillery"]),
    burst: has(["Assassin", "Damage Dealer"]),
  };
}

/** Nota final do draft: chance estimada de vitória do seu time e os motivos. */
export function draftGrade(mine: Brawler[], enemies: Brawler[], map: GameMap, lang: Lang) {
  const t = STR[lang];
  const my = teamPower(mine, enemies, map);
  const their = teamPower(enemies, mine, map);
  // Curva suave: 3 pontos de diferença ≈ 70% de chance.
  const chance = Math.round((1 / (1 + Math.exp(-(my - their) / 3.5))) * 100);
  const reasons: { good: boolean; text: string }[] = [];

  let myCounters = 0;
  let theirCounters = 0;
  for (const a of mine) for (const b of enemies) {
    const v = matchup(a, b);
    if (v >= 1) myCounters++;
    if (v <= -1) theirCounters++;
  }
  if (myCounters > 0) reasons.push({ good: true, text: t.gCounters(myCounters) });
  if (theirCounters > 0) reasons.push({ good: false, text: t.gCountered(theirCounters) });

  const topHere = (team: Brawler[]) => team.filter((b) => mapStrength(b, map).pos >= 0).length;
  const mt = topHere(mine);
  const et = topHere(enemies);
  if (mt > et) reasons.push({ good: true, text: t.gMap(mt) });
  if (et > mt) reasons.push({ good: false, text: t.gMapEnemy(et) });

  const r = roles(mine);
  if (!r.front) reasons.push({ good: false, text: t.gNoTank });
  if (!r.control) reasons.push({ good: false, text: t.gNoControl });
  if (new Set(mine.map((b) => b.class)).size === mine.length && mine.length === 3)
    reasons.push({ good: true, text: t.gBalanced });

  const letter = chance >= 65 ? "A" : chance >= 55 ? "B" : chance >= 45 ? "C" : chance >= 35 ? "D" : "E";
  return { chance, letter, reasons };
}

/** Melhores duplas (você + amigo) para um momento do draft. */
export function bestPairs(
  recs: Recommendation[],
  mineAllowed: Set<number> | null,
  friendAllowed: Set<number> | null,
  amount = 5,
) {
  const mineList = recs.filter((r) => !mineAllowed || mineAllowed.has(r.brawler.id)).slice(0, 12);
  const friendList = recs.filter((r) => !friendAllowed || friendAllowed.has(r.brawler.id)).slice(0, 12);
  const pairs: { me: Recommendation; friend: Recommendation; score: number }[] = [];
  const seen = new Set<string>(); // a mesma dupla com os papéis trocados conta uma vez só
  for (const a of mineList)
    for (const b of friendList) {
      if (a.brawler.id === b.brawler.id) continue;
      const key = [a.brawler.id, b.brawler.id].sort((x, y) => x - y).join("+");
      if (seen.has(key)) continue;
      seen.add(key);
      const same = a.brawler.class === b.brawler.class ? -1.5 : 0.5;
      pairs.push({ me: a, friend: b, score: a.score + b.score + synergy(a.brawler, b.brawler) + same });
    }
  return pairs.sort((x, y) => y.score - x.score).slice(0, amount);
}

/** O que pesou numa derrota (para a análise do histórico). */
export function lossReasons(entry: HistoryEntry, brawlers: Brawler[], map: GameMap | undefined, lang: Lang): string[] {
  const t = STR[lang];
  const byName = new Map(brawlers.map((b) => [b.name, b]));
  const me = byName.get(entry.played);
  const team = entry.team.map((n) => byName.get(n)).filter((b): b is Brawler => !!b);
  const foes = entry.enemies.map((n) => byName.get(n)).filter((b): b is Brawler => !!b);
  const out: string[] = [];
  if (me) {
    const counters = foes.filter((f) => matchup(f, me) >= 1).map((f) => f.name);
    if (counters.length) out.push(t.lCountered(me.name, counters.join(", ")));
    if (map && mapStrength(me, map).pos < 0 && me.tier !== "S+" && me.tier !== "S") out.push(t.lWeakPick(me.name));
  }
  if (team.length === 3) {
    const r = roles(team);
    if (!r.front) out.push(t.gNoTank);
    if (!r.control) out.push(t.gNoControl);
    if (new Set(team.map((b) => b.class)).size < team.length) out.push(t.lRepeated);
  }
  if (map && foes.length && team.length) {
    const theirTop = foes.filter((f) => mapStrength(f, map).pos >= 0).length;
    const ourTop = team.filter((f) => mapStrength(f, map).pos >= 0).length;
    if (theirTop > ourTop) out.push(t.gMapEnemy(theirTop));
  }
  if (out.length === 0) out.push(t.lNoClear);
  return out;
}
