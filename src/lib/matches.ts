// JUNTA OS ROUNDS EM PARTIDAS
// No Ranked cada partida é melhor de 3, e a API registra CADA ROUND separado.
// Aqui juntamos os rounds seguidos no mesmo mapa, com os mesmos 6 Brawlers, numa partida só.

export type Round = {
  date: string; // hora do round (ISO)
  mapGameId: number;
  mapName: string;
  win: boolean;
  played: number;
  playedPower: number;
  team: number[];
  enemies: number[];
};

export type Match = Round & {
  /** [rounds vencidos, rounds perdidos] */
  rounds: [number, number];
  /** Hora do último round visto. */
  lastRound: string;
  /** A partida já terminou? (alguém fez 2 rounds, ou o último round foi há mais de 8 minutos) */
  done: boolean;
};

const ROUND_GAP = 10 * 60 * 1000; // rounds da mesma partida ficam a poucos minutos um do outro
const STALE = 8 * 60 * 1000;

const sideKey = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");
const matchKey = (r: Round) => `${r.mapGameId}|${sideKey(r.team)}|${sideKey(r.enemies)}`;

/** Recebe os rounds (em qualquer ordem) e devolve as partidas, da mais nova para a mais velha. */
export function groupRounds(rounds: Round[], now = Date.now()): Match[] {
  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date));
  const out: Match[] = [];
  for (const r of sorted) {
    const cur = out[out.length - 1];
    const sameMatch =
      cur &&
      matchKey(cur) === matchKey(r) &&
      Date.parse(r.date) - Date.parse(cur.lastRound) <= ROUND_GAP &&
      Math.max(...cur.rounds) < 2;
    if (sameMatch) {
      cur.rounds[r.win ? 0 : 1]++;
      cur.lastRound = r.date;
      cur.played = r.played;
      cur.playedPower = Math.max(cur.playedPower, r.playedPower);
      cur.win = r.win; // provisório: a conta final é feita abaixo
    } else {
      out.push({ ...r, rounds: r.win ? [1, 0] : [0, 1], lastRound: r.date, done: false });
    }
  }
  for (const m of out) {
    const [w, l] = m.rounds;
    if (w !== l) m.win = w > l; // empate (1-1 sem 3º round visto): fica o resultado do último round
    m.done = Math.max(w, l) >= 2 || now - Date.parse(m.lastRound) > STALE;
  }
  return out.reverse();
}
