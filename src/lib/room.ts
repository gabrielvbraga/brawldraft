// SALA DE DRAFT EM TRIO
// Guarda o estado do draft numa tabela do Supabase, para os três do time verem a
// mesma coisa. Cada celular lê a sala a cada 1,5 segundo e envia suas mudanças.
// Usa só "fetch" (sem biblioteca extra), pela API REST que o Supabase já oferece.
//
// Precisa de duas variáveis na Vercel (Settings > Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL       -> o "Project URL" do Supabase
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  -> a chave "anon public" do Supabase
// E da tabela "rooms", criada com o arquivo supabase.sql.

export type RoomState = {
  mapId: number; // id do mapa na nossa lista (MAPS)
  first: "mine" | "enemy";
  bans: number[];
  mine: number[];
  enemies: number[];
  bansDone: boolean;
};

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** O draft em trio só aparece no site quando o Supabase está configurado. */
export const ROOMS_ENABLED = URL_BASE !== "" && KEY !== "";

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
});

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
