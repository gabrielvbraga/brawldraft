// DUELO DE DRAFT 1 CONTRA 1
// Dois jogadores, cada um num aparelho, cada um com um time. A sala fica na mesma
// tabela "rooms" do draft em trio (o estado é só um JSON diferente).
// Ordem: bans alternados (A, B, A, B, A, B) e depois picks 1-2-2-1 (A, B, B, A, A, B).
// Ninguém vê sugestões: no fim o site mostra a nota de cada um e quem draftou melhor.

import { createRoom, readRoom, writeRoom, type RoomState } from "./room";

export type Side = "a" | "b";

export type DuelState = {
  kind: "duel";
  mapId: number;
  names: { a: string; b: string | null };
  bans: number[]; // em ordem; índices pares = A, ímpares = B
  a: number[];
  b: number[];
  /** Qualidade de cada pick (0 a 1: perto da melhor opção do momento), por lado. */
  quality: { a: number[]; b: number[] };
  /** Quem começou (na revanche, troca). */
  first: Side;
};

export const DUEL_BANS = 6;
const PICK_ORDER: Side[] = ["a", "b", "b", "a", "a", "b"];

export const other = (s: Side): Side => (s === "a" ? "b" : "a");

/** De quem é a vez e o que fazer (ou null quando acabou). */
export function duelTurn(st: DuelState): { side: Side; action: "ban" | "pick" } | null {
  const swap = (s: Side) => (st.first === "a" ? s : other(s));
  if (st.bans.length < DUEL_BANS) return { side: swap(st.bans.length % 2 === 0 ? "a" : "b"), action: "ban" };
  const i = st.a.length + st.b.length;
  if (i >= 6) return null;
  return { side: swap(PICK_ORDER[i]), action: "pick" };
}

export function newDuel(mapId: number, nameA: string, first: Side = "a"): DuelState {
  return { kind: "duel", mapId, names: { a: nameA, b: null }, bans: [], a: [], b: [], quality: { a: [], b: [] }, first };
}

// A tabela de salas guarda qualquer JSON; os tipos do trio e do duelo só mudam o formato.
export const createDuel = (code: string, st: DuelState) => createRoom(code, st as unknown as RoomState);
export async function readDuel(code: string): Promise<{ state: DuelState; version: number } | null> {
  const r = await readRoom(code);
  if (!r || (r.state as unknown as DuelState).kind !== "duel") return null;
  return { state: r.state as unknown as DuelState, version: r.version };
}
export const writeDuel = (code: string, st: DuelState, version: number) => writeRoom(code, st as unknown as RoomState, version);

/** Nota em letra a partir da média de qualidade dos picks. */
export function duelLetter(q: number[]): { score: number; letter: string } {
  const score = q.length ? Math.round((q.reduce((s, x) => s + x, 0) / q.length) * 100) : 0;
  const letter = score >= 95 ? "S" : score >= 88 ? "A" : score >= 78 ? "B" : score >= 65 ? "C" : "D";
  return { score, letter };
}

// ---- PRESENÇA: cada jogador avisa "ainda estou aqui" numa linha só dele ----
// (fica separado da sala para nunca atrapalhar os bans e picks)
export type Beat = { kind: "beat"; n: number; left: boolean };
export const beatCode = (code: string, side: Side) => `${code}-${side}`;

/** Avisa que está na sala (n sobe a cada aviso) ou que saiu (left). */
export async function sendBeat(code: string, side: Side, n: number, left = false): Promise<void> {
  const key = beatCode(code, side);
  const st = { kind: "beat", n, left } as unknown as RoomState;
  if (n === 0) await createRoom(key, st); // primeira vez: cria (se já existir, só atualiza abaixo)
  await writeRoom(key, st, n + 1);
}

export async function readBeat(code: string, side: Side): Promise<Beat | null> {
  const r = await readRoom(beatCode(code, side));
  return r ? (r.state as unknown as Beat) : null;
}
