// CONQUISTAS DO PERFIL
// Do jogo: conferidas pela API da Supercell (ninguém consegue inventar).
// Do site: vêm dos números salvos na conta (drafts, Brawler do dia, duelos).

import type { Lang } from "./i18n";

export type SiteStats = {
  drafts?: number; // drafts ao vivo terminados
  followedWins?: number; // vitórias jogando uma das 3 primeiras sugestões
  dailyWins?: number; // vezes que acertou o Brawler do dia
  dailyBestStreak?: number; // maior sequência de dias acertando
  duelsWon?: number; // duelos 1 contra 1 vencidos
  duelsPlayed?: number;
};

export type GameFacts = {
  bestRank: number | null;
  trophies: number;
  brawlers: number;
  totalBrawlers: number;
  maxed: number; // no nível 11
  bestStreak: number; // maior sequência de vitórias nas últimas 25
};

type Def = {
  id: string;
  icon: string;
  group: "game" | "site";
  pt: [string, string]; // nome, como ganhar
  en: [string, string];
  test: (g: GameFacts, s: SiteStats) => boolean;
};

export const ACHIEVEMENTS: Def[] = [
  { id: "rank-diamond", icon: "💎", group: "game", pt: ["Diamante", "Chegar ao Diamante no Ranked"], en: ["Diamond", "Reach Diamond in Ranked"], test: (g) => (g.bestRank ?? -1) >= 9 },
  { id: "rank-mythic", icon: "🔮", group: "game", pt: ["Mítico", "Chegar ao Mítico no Ranked"], en: ["Mythic", "Reach Mythic in Ranked"], test: (g) => (g.bestRank ?? -1) >= 12 },
  { id: "rank-legend", icon: "🔥", group: "game", pt: ["Lendário", "Chegar ao Lendário no Ranked"], en: ["Legendary", "Reach Legendary in Ranked"], test: (g) => (g.bestRank ?? -1) >= 15 },
  { id: "rank-masters", icon: "👑", group: "game", pt: ["Mestre", "Chegar ao Mestre no Ranked"], en: ["Masters", "Reach Masters in Ranked"], test: (g) => (g.bestRank ?? -1) >= 18 },
  { id: "rank-pro", icon: "🏆", group: "game", pt: ["Pro", "Chegar ao Pro no Ranked"], en: ["Pro", "Reach Pro in Ranked"], test: (g) => (g.bestRank ?? -1) >= 21 },
  { id: "trophies-50k", icon: "🥉", group: "game", pt: ["50 mil troféus", "Ter 50.000 troféus"], en: ["50k trophies", "Have 50,000 trophies"], test: (g) => g.trophies >= 50000 },
  { id: "trophies-75k", icon: "🥈", group: "game", pt: ["75 mil troféus", "Ter 75.000 troféus"], en: ["75k trophies", "Have 75,000 trophies"], test: (g) => g.trophies >= 75000 },
  { id: "trophies-100k", icon: "🥇", group: "game", pt: ["100 mil troféus", "Ter 100.000 troféus"], en: ["100k trophies", "Have 100,000 trophies"], test: (g) => g.trophies >= 100000 },
  { id: "collector", icon: "📚", group: "game", pt: ["Colecionador", "Ter todos os Brawlers"], en: ["Collector", "Own every Brawler"], test: (g) => g.totalBrawlers > 0 && g.brawlers >= g.totalBrawlers },
  { id: "maxed-25", icon: "⚡", group: "game", pt: ["Arsenal", "25 Brawlers no nível 11"], en: ["Arsenal", "25 Brawlers at level 11"], test: (g) => g.maxed >= 25 },
  { id: "maxed-50", icon: "🛡️", group: "game", pt: ["Exército", "50 Brawlers no nível 11"], en: ["Army", "50 Brawlers at level 11"], test: (g) => g.maxed >= 50 },
  { id: "streak-10", icon: "🌪️", group: "game", pt: ["Imparável", "10 vitórias seguidas nas últimas 25 partidas"], en: ["Unstoppable", "10 wins in a row in the last 25 games"], test: (g) => g.bestStreak >= 10 },
  { id: "drafts-10", icon: "📝", group: "site", pt: ["Estrategista", "Terminar 10 drafts ao vivo"], en: ["Strategist", "Finish 10 live drafts"], test: (_g, s) => (s.drafts ?? 0) >= 10 },
  { id: "drafts-100", icon: "🧠", group: "site", pt: ["Mestre do draft", "Terminar 100 drafts ao vivo"], en: ["Draft master", "Finish 100 live drafts"], test: (_g, s) => (s.drafts ?? 0) >= 100 },
  { id: "followed-10", icon: "🎯", group: "site", pt: ["Confia no site", "10 vitórias seguindo a sugestão"], en: ["Trusts the site", "10 wins following the suggestion"], test: (_g, s) => (s.followedWins ?? 0) >= 10 },
  { id: "daily-1", icon: "🔎", group: "site", pt: ["Detetive", "Acertar o Brawler do dia"], en: ["Detective", "Guess the daily Brawler"], test: (_g, s) => (s.dailyWins ?? 0) >= 1 },
  { id: "daily-7", icon: "📅", group: "site", pt: ["Uma semana certeira", "Acertar o Brawler do dia 7 dias seguidos"], en: ["Perfect week", "Guess the daily Brawler 7 days in a row"], test: (_g, s) => (s.dailyBestStreak ?? 0) >= 7 },
  { id: "duel-1", icon: "⚔️", group: "site", pt: ["Duelista", "Vencer um duelo 1 contra 1"], en: ["Duelist", "Win a 1v1 duel"], test: (_g, s) => (s.duelsWon ?? 0) >= 1 },
  { id: "duel-10", icon: "🗡️", group: "site", pt: ["Rei do duelo", "Vencer 10 duelos 1 contra 1"], en: ["Duel king", "Win 10 1v1 duels"], test: (_g, s) => (s.duelsWon ?? 0) >= 10 },
];

export type Earned = { id: string; icon: string; name: string; how: string; done: boolean; group: "game" | "site" };

export function achievements(lang: Lang, g: GameFacts, s: SiteStats | null): Earned[] {
  return ACHIEVEMENTS.map((a) => {
    const [name, how] = a[lang];
    return { id: a.id, icon: a.icon, name, how, group: a.group, done: a.test(g, s ?? {}) };
  });
}

/** Junta os números de dois lugares (aparelho e conta) ficando com o maior de cada. */
export function mergeStats(a: SiteStats, b: SiteStats): SiteStats {
  const out: SiteStats = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof SiteStats, number][]) {
    if (typeof v === "number") out[k] = Math.max(out[k] ?? 0, v);
  }
  return out;
}
