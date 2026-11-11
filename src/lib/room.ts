// SALA DE DRAFT EM TRIO
// Guarda o estado do draft numa tabela do Supabase, para os três do time verem a
// mesma coisa. Cada celular lê a sala a cada 1,5 segundo e envia suas mudanças.
// Usa só "fetch" (sem biblioteca extra), pela API REST que o Supabase já oferece.
//
// Configuração do Supabase: veja src/lib/supabase.ts. Tabela "rooms": veja supabase.sql.

import { SB_URL as URL_BASE, SUPABASE_ON, sbHeaders } from "./supabase";

export type RoomState = {
  mapId: number; // id do mapa na nossa lista (MAPS)
  first: "mine" | "enemy";
  bans: number[];
  mine: number[];
  enemies: number[];
  bansDone: boolean;
};

/** O draft em trio só aparece no site quando o Supabase está configurado. */
export const ROOMS_ENABLED = SUPABASE_ON;

const headers = () => sbHeaders();

/** Código curto e fácil de ditar no Discord (sem letras que confundem, como O e 0). */
export function newRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createRoom(code: string, state: RoomState): Promise<boolean> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rooms`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ code, state, version: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function readRoom(code: string): Promise<{ state: RoomState; version: number } | null> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rooms?code=eq.${encodeURIComponent(code)}&select=state,version`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { state: RoomState; version: number }[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function writeRoom(code: string, state: RoomState, version: number): Promise<boolean> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rooms?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ state, version, updated_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
