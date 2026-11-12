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
  /** % de vitórias no Ranked (meta ao vivo). Fica sem valor quando não temos o dado. */
  winRate?: number;
};

export type GameMap = {
  id: number;
  name: string;
  /** Modo em inglês (Gem Grab, Brawl Ball...). */
  mode: string;
  /** Os Brawlers mais fortes neste mapa, do melhor para o pior (até 10). */
  top: string[];
  /** Número do mapa no jogo (15000007...). Usado para a foto e para o meta ao vivo. */
  gameId: number;
  /** % de vitórias de cada Brawler de "top", na mesma ordem (meta ao vivo). */
  topRates?: number[];
  /** Foto do mapa (vista de cima). */
  imageUrl: string | null;
};

/** Um item do ranking de recomendações. */
export type Recommendation = {
  brawler: Brawler;
  score: number;
  /** Pontuação separada por fator, para mostrar de onde veio a nota. */
  parts: {
    base: number;
    map: number;
    counter: number;
    synergy: number;
    comp: number;
    risk: number;
    personal: number;
    comfort: number;
  };
  /** Frases curtas explicando a recomendação. */
  reasons: string[];
  /** Alerta de armadilha: nome de um counter forte dele que o inimigo ainda pode pegar. */
  trap?: string;
};
