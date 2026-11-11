// MAPAS DO RANKED
// Cada linha: [modo, nome do mapa, os 5 Brawlers mais fortes nele].
// Lista e destaques tirados dos dados de Ranked do seemeta.com (11/11/2026).
// Quando a temporada mudar os mapas, é este arquivo que a gente atualiza.

import type { GameMap } from "@/lib/types";

const ROWS: [string, string, string[]][] = [
  ["Gem Grab", "Double Swoosh", ["Amber", "Bolt", "Emz", "Bo", "Tara"]],
  ["Gem Grab", "Gem Fort", ["Bolt", "Shade", "Wendy", "Amber", "Ash"]],
  ["Gem Grab", "Hard Rock Mine", ["Shade", "Ash", "Rico", "Amber", "Gus"]],
  ["Gem Grab", "Undermine", ["Wendy", "Amber", "Gus", "Shade", "Tara"]],

  ["Brawl Ball", "Center Stage", ["Shade", "Amber", "Emz", "Ash", "Rico"]],
  ["Brawl Ball", "Pinball Dreams", ["Shade", "Amber", "Ash", "Gus", "Bibi"]],
  ["Brawl Ball", "Sneaky Fields", ["Amber", "Shade", "Emz", "Rico", "El Primo"]],
  ["Brawl Ball", "Spiraling Out", ["Amber", "Ash", "El Primo", "Shade", "Gus"]],
  ["Brawl Ball", "Triple Dribble", ["Shade", "Amber", "Willow", "Gus", "Emz"]],

  ["Heist", "Bridge Too Far", ["Wendy", "8-Bit", "Nori", "Colt", "Shade"]],
  ["Heist", "Hot Potato", ["Shade", "Nori", "Bibi", "Nita", "Colette"]],
  ["Heist", "Kaboom Canyon", ["Nori", "Colette", "Amber", "Shade", "Wendy"]],
  ["Heist", "Pit Stop", ["Edgar", "Bibi", "Nori", "Shade", "Mico"]],
  ["Heist", "Safe Zone", ["Shade", "Nori", "Amber", "Wendy", "Colette"]],

  ["Hot Zone", "Dueling Beetles", ["Amber", "Wendy", "Gus", "Bo", "Emz"]],
  ["Hot Zone", "In the Liminal", ["Amber", "Wendy", "Ash", "Bo", "Griff"]],
  ["Hot Zone", "Open Business", ["Amber", "Wendy", "Ash", "Emz", "Shade"]],
  ["Hot Zone", "Parallel Plays", ["Juju", "Shade", "Bibi", "Chuck", "Gus"]],
  ["Hot Zone", "Quick Travel", ["Nita", "Ash", "Shade", "Emz", "Tara"]],
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

export const MAPS: GameMap[] = ROWS.map(([mode, name, top], i) => ({ id: i + 1, name, mode, top }));
