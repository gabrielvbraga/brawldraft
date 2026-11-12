// MAPAS DO RANKED
// Cada linha: [modo, nome do mapa, os Brawlers mais fortes nele, do melhor para o pior].
// Estes são os dados SALVOS, usados só quando a leitura ao vivo do topbrawl.com
// falha (veja src/lib/livemeta.ts). Com ela funcionando, a lista de destaques de
// cada mapa é trocada pela atual a cada 8 horas.
// A foto de cada mapa vem do CDN da Brawlify, pelo número do mapa no jogo (MAP_IDS).
// Quando a temporada mudar os mapas, é este arquivo que a gente atualiza.

import type { GameMap } from "@/lib/types";

const ROWS: [string, string, string[]][] = [
  ["Gem Grab", "Double Swoosh", ["Amber", "Bolt", "Emz", "Bo", "Tara"]],
  ["Gem Grab", "Gem Fort", ["Bolt", "Shade", "Wendy", "Amber", "Ash"]],
  ["Gem Grab", "Hard Rock Mine", ["Mr. P", "Bo", "Ollie", "Rico", "Bibi", "Damian", "Edgar", "Rosa", "Sandy", "Tara"]],
  ["Gem Grab", "Undermine", ["Wendy", "Amber", "Gus", "Shade", "Tara"]],

  ["Brawl Ball", "Center Stage", ["Shade", "Amber", "Emz", "Ash", "Rico"]],
  ["Brawl Ball", "Pinball Dreams", ["Shade", "Amber", "Ash", "Gus", "Bibi"]],
  ["Brawl Ball", "Sneaky Fields", ["Amber", "Shade", "Emz", "Rico", "El Primo"]],
  ["Brawl Ball", "Triple Dribble", ["Shade", "Amber", "Willow", "Gus", "Emz"]],

  ["Heist", "Bridge Too Far", ["Wendy", "8-Bit", "Nori", "Colt", "Shade"]],
  ["Heist", "Hot Potato", ["Shade", "Nori", "Bibi", "Nita", "Colette"]],
  ["Heist", "Kaboom Canyon", ["Nori", "Colette", "Amber", "Shade", "Wendy"]],
  ["Heist", "Safe Zone", ["Shade", "Nori", "Amber", "Wendy", "Colette"]],

  ["Hot Zone", "Dueling Beetles", ["Amber", "Wendy", "Gus", "Bo", "Emz"]],
  ["Hot Zone", "Open Business", ["Amber", "Wendy", "Ash", "Emz", "Shade"]],
  ["Hot Zone", "Parallel Plays", ["Juju", "Shade", "Bibi", "Chuck", "Gus"]],
  ["Hot Zone", "Ring of Fire", ["Wendy", "Amber", "Bo", "Gus", "Ash"]],

  ["Bounty", "Dry Season", ["Wendy", "Bolt", "Amber", "Gus", "Brock"]],
  ["Bounty", "Hideout", ["Wendy", "Amber", "Gus", "Max", "Bolt"]],
  ["Bounty", "Layer Cake", ["Shade", "Bolt", "Brock", "Amber", "Mortis"]],
  ["Bounty", "Shooting Star", ["Wendy", "Amber", "Sprout", "Bolt", "Gus"]],

  ["Knockout", "Belle's Rock", ["Brock", "Sprout", "Gray", "Gus", "Shade"]],
  ["Knockout", "Flaring Phoenix", ["Brock", "Edgar", "Doug", "Pearl", "Wendy"]],
  ["Knockout", "Flowing Springs", ["Wendy", "Brock", "Najia", "Angelo", "Piper"]],
  ["Knockout", "Goldarm Gulch", ["Brock", "Wendy", "Pearl", "Rico", "Gus"]],
  ["Knockout", "New Horizons", ["Wendy", "Brock", "Sprout", "Hank", "Gus"]],
  ["Knockout", "Out in the Open", ["Brock", "Wendy", "Pearl", "Ollie", "Amber"]],
];

/** Número de cada mapa no jogo (o arquivo da foto tem esse número). */
const MAP_IDS: Record<string, number> = {
  "Double Swoosh": 15000115,
  "Gem Fort": 15000010,
  "Hard Rock Mine": 15000007,
  "Undermine": 15000011,
  "Center Stage": 15000132,
  "Pinball Dreams": 15000118,
  "Sneaky Fields": 15000050,
  "Triple Dribble": 15000025,
  "Bridge Too Far": 15000072,
  "Hot Potato": 15000053,
  "Kaboom Canyon": 15000018,
  "Safe Zone": 15000019,
  "Dueling Beetles": 15000306,
  "Open Business": 15000292,
  "Parallel Plays": 15000293,
  "Ring of Fire": 15000300,
  "Dry Season": 15000083,
  "Hideout": 15000022,
  "Layer Cake": 15000082,
  "Shooting Star": 15000005,
  "Belle's Rock": 15000368,
  "Flaring Phoenix": 15000440,
  "Flowing Springs": 15000502,
  "Goldarm Gulch": 15000367,
  "New Horizons": 15000703,
  "Out in the Open": 15000548,
};

export const MAPS: GameMap[] = ROWS.map(([mode, name, top], i) => ({
  id: i + 1,
  name,
  mode,
  top,
  gameId: MAP_IDS[name] ?? 0,
  imageUrl: MAP_IDS[name] ? `https://cdn.brawlify.com/maps/regular/${MAP_IDS[name]}.png` : null,
}));
