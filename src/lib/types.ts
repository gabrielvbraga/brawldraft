// Tipos básicos usados no projeto inteiro.

export type Tier = "S+" | "S" | "A" | "B" | "C" | "D";

export type Brawler = {
  id: number;
  name: string;
  /** Classe em inglês (Tank, Assassin, Marksman...). */
  class: string;
  /** Força geral no Ranked, segundo os dados de partidas. */
  tier: Tier;
  /** Endereço do ícone. Fica null quando não temos a imagem. */
  imageUrl: string | null;
};

export type GameMap = {
  id: number;
  name: string;
  /** Modo em inglês (Gem Grab, Brawl Ball...). */
  mode: string;
  /** Os 5 Brawlers mais fortes neste mapa, do melhor para o quinto. */
  top: string[];
};

/** Um item do ranking de recomendações. */
export type Recommendation = {
  brawler: Brawler;
  score: number;
  /** Pontuação separada por fator, para mostrar de onde veio a nota. */
  parts: { base: number; map: number; counter: number; synergy: number; comp: number; risk: number; personal: number };
  /** Frases curtas explicando a recomendação. */
  reasons: string[];
};
