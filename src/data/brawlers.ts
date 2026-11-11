// TODOS OS BRAWLERS
// Cada linha: [número no jogo, nome, classe, tier no Ranked].
// - O tier vem de dados de partidas de Ranked (seemeta.com, 11/11/2026).
// - O número e a classe vêm da BrawlAPI (api.brawlapi.com). O número também
//   serve para achar a foto do Brawler.
// Para atualizar depois de um balanceamento, basta trocar a letra do tier.

import type { Brawler, Tier } from "@/lib/types";

const ROWS: [number, string, string, Tier][] = [
  // Causadores de Dano
  [27, "8-Bit", "Damage Dealer", "A"], [25, "Carl", "Damage Dealer", "B"],
  [63, "Chester", "Damage Dealer", "B"], [73, "Chuck", "Controller", "S"],
  [83, "Clancy", "Damage Dealer", "C"], [39, "Colette", "Damage Dealer", "B"],
  [1, "Colt", "Damage Dealer", "B"], [56, "Eve", "Damage Dealer", "A"],
  [53, "Lola", "Damage Dealer", "C"], [91, "Lumi", "Damage Dealer", "D"],
  [97, "Mina", "Damage Dealer", "B"], [84, "Moe", "Damage Dealer", "C"],
  [103, "Najia", "Damage Dealer", "A"], [8, "Nita", "Damage Dealer", "A"],
  [72, "Pearl", "Damage Dealer", "A"], [66, "R-T", "Damage Dealer", "B"],
  [4, "Rico", "Damage Dealer", "A"], [0, "Shelly", "Damage Dealer", "A"],
  [5, "Spike", "Damage Dealer", "A"], [38, "Surge", "Damage Dealer", "A"],
  [17, "Tara", "Damage Dealer", "S"], [110, "Vince", "Damage Dealer", "C"],
  // Tanques
  [51, "Ash", "Tank", "S"], [26, "Bibi", "Tank", "S+"], [106, "Bolt", "Tank", "S+"],
  [2, "Bull", "Tank", "B"], [62, "Buster", "Tank", "B"], [104, "Damian", "Tank", "B"],
  [18, "Darryl", "Tank", "B"], [80, "Draco", "Tank", "C"], [10, "El Primo", "Tank", "S"],
  [20, "Frank", "Tank", "B"], [69, "Hank", "Tank", "S+"], [34, "Jacky", "Tank", "A"],
  [52, "Meg", "Tank", "D"], [90, "Ollie", "Tank", "A"], [24, "Rosa", "Tank", "A"],
  [96, "Trunk", "Tank", "S"],
  // Atiradores de Elite
  [79, "Angelo", "Marksman", "S"], [29, "Bea", "Marksman", "C"], [46, "Belle", "Marksman", "C"],
  [58, "Bonnie", "Marksman", "B"], [3, "Brock", "Marksman", "A"], [57, "Janet", "Marksman", "C"],
  [68, "Maisie", "Marksman", "C"], [65, "Mandy", "Marksman", "C"], [36, "Nani", "Marksman", "C"],
  [99, "Pierce", "Marksman", "D"], [15, "Piper", "Marksman", "A"],
  // Artilharia
  [6, "Barley", "Artillery", "B"], [9, "Dynamike", "Artillery", "D"], [48, "Grom", "Artillery", "B"],
  [87, "Juju", "Artillery", "S+"], [77, "Larry & Lawrie", "Artillery", "A"],
  [19, "Penny", "Controller", "C"], [37, "Sprout", "Artillery", "A"], [22, "Tick", "Artillery", "C"],
  // Controladores
  [40, "Amber", "Controller", "S"], [14, "Bo", "Controller", "S"], [74, "Charlie", "Controller", "D"],
  [109, "Cosmo", "Controller", "C"], [30, "Emz", "Controller", "S"], [92, "Finx", "Controller", "B"],
  [35, "Gale", "Controller", "B"], [21, "Gene", "Controller", "C"], [50, "Griff", "Controller", "C"],
  [7, "Jessie", "Controller", "B"], [41, "Lou", "Controller", "A"], [89, "Meeple", "Controller", "C"],
  [31, "Mr. P", "Controller", "S+"], [59, "Otis", "Controller", "C"], [28, "Sandy", "Controller", "B"],
  [102, "Sirius", "Controller", "B"], [47, "Squeak", "Controller", "C"],
  [67, "Willow", "Controller", "A"], [98, "Ziggy", "Controller", "C"],
  // Assassinos
  [95, "Alli", "Assassin", "B"], [49, "Buzz", "Assassin", "C"], [70, "Cordelius", "Assassin", "D"],
  [12, "Crow", "Assassin", "D"], [43, "Edgar", "Assassin", "S"], [54, "Fang", "Assassin", "C"],
  [100, "Gigi", "Assassin", "D"], [94, "Kaze", "Assassin", "B"], [85, "Kenji", "Assassin", "B"],
  [23, "Leon", "Assassin", "B"], [81, "Lily", "Assassin", "C"], [78, "Melodie", "Assassin", "S"],
  [75, "Mico", "Assassin", "B"], [11, "Mortis", "Assassin", "B"], [107, "Nori", "Assassin", "A"],
  [60, "Sam", "Assassin", "A"], [86, "Shade", "Assassin", "D"], [105, "Starr Nova", "Assassin", "B"],
  [45, "Stu", "Assassin", "B"],
  // Suportes
  [82, "Berry", "Support", "D"], [42, "Byron", "Support", "D"], [71, "Doug", "Support", "A"],
  [101, "Glowy", "Support", "C"], [64, "Gray", "Support", "A"], [61, "Gus", "Support", "C"],
  [93, "Jae-Yong", "Support", "D"], [76, "Kit", "Support", "D"], [32, "Max", "Support", "D"],
  [16, "Pam", "Support", "D"], [13, "Poco", "Support", "C"], [44, "Ruffs", "Support", "D"],
  [108, "Wendy", "Support", "C"],
];

export const BRAWLERS: Brawler[] = ROWS.map(([n, name, cls, tier]) => ({
  id: 16000000 + n,
  name,
  class: cls,
  tier,
  imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${16000000 + n}.png`,
})).sort((a, b) => a.name.localeCompare(b.name));
