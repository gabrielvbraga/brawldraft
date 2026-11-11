// MOTOR DE RECOMENDAÇÃO
// Dá uma nota para cada Brawler disponível somando 6 fatores:
//   base (meta + modo) + mapa + counter + sinergia + composição - risco + histórico pessoal
// Dados usados:
//   - tier de cada Brawler no Ranked ......... src/data/brawlers.ts
//   - os 5 mais fortes de cada mapa .......... src/data/maps.ts
//   - counters e sinergias específicos ....... src/data/meta.json
//   - regras gerais por classe (abaixo), quando não há dado específico

import meta from "@/data/meta.json";
import { STR, className, modeName, type Lang } from "./i18n";
import type { Personal } from "./storage";
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

// Pesos de cada fator. Mexer aqui muda o "jeito de pensar" do sistema.
const W = { tier: 0.6, mode: 0.4, counter: 1.5, synergy: 1, risk: 0.4 };

/** Vantagem de um Brawler sobre outro (dado específico tem prioridade sobre a classe). */
function matchup(a: Brawler, b: Brawler): number {
  for (const c of meta.counters) {
    if (c.strong === a.name && c.weak === b.name) return c.value;
    if (c.strong === b.name && c.weak === a.name) return -c.value;
  }
  return (BEATS[a.class]?.[b.class] ?? 0) - (BEATS[b.class]?.[a.class] ?? 0);
}

function synergy(a: Brawler, b: Brawler): number {
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
  return { base, bonus: pos >= 0 ? TOP_BONUS[pos] : 0, pos };
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
  /** Idioma das frases de explicação. */
  lang?: Lang;
};

/** Calcula o ranking completo, do melhor para o pior. */
export function recommend(state: DraftState): Recommendation[] {
  const { brawlers, map, bans, mine, enemies, allowed, personal } = state;
  const lang = state.lang ?? "pt";
  const t = STR[lang];
  const byId = new Map(brawlers.map((b) => [b.id, b]));
  const pick = (ids: number[]) => ids.map((id) => byId.get(id)).filter((b): b is Brawler => !!b);

  const allies = pick(mine);
  const foes = pick(enemies);
  const used = new Set([...bans, ...mine, ...enemies]);
  const enemyPicksLeft = 3 - foes.length; // quantos picks o inimigo ainda tem para responder

  const result: Recommendation[] = [];

  for (const b of brawlers) {
    if (used.has(b.id)) continue;
    if (allowed && !allowed.has(b.id)) continue;
    const reasons: string[] = [];

    // 1) BASE (meta atual + modo) e 2) MAPA
    const s = mapStrength(b, map);
    if (s.pos >= 0) reasons.push(t.rTop(s.pos + 1, map.name));
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
      const rate = record.w / games;
      own = (rate - 0.5) * 4; // de -2 (0% de vitórias) a +2 (100%)
      reasons.push(t.rPersonal(Math.round(rate * 100), games));
    }

    const parts = {
      base: s.base,
      map: s.bonus,
      counter: counter * W.counter,
      synergy: syn * W.synergy,
      comp,
      risk: -risk,
      personal: own,
    };
    const score = parts.base + parts.map + parts.counter + parts.synergy + parts.comp + parts.risk + parts.personal;
    result.push({ brawler: b, score, parts, reasons });
  }

  return result.sort((x, y) => y.score - x.score);
}
