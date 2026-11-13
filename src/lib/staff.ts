// QUEM É ADMIN OU MODERADOR (lado do servidor)
// Confere o login da pessoa pelo token dela e o cargo pela chave secreta.

import { keyHeaders } from "./supabase";
import { pushDb } from "./pushdb";

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export type Role = "admin" | "mod";

/** Id da pessoa dona do token (ou null). */
export async function userFromToken(token: string): Promise<string | null> {
  if (!SB || !token) return null;
  try {
    const res = await fetch(`${SB}/auth/v1/user`, { headers: keyHeaders(ANON, token), cache: "no-store" });
    if (!res.ok) return null;
    const u = (await res.json()) as { id?: string };
    return u.id ?? null;
  } catch {
    return null;
  }
}

export async function roleOf(userId: string): Promise<Role | null> {
  const [a, m] = await Promise.all([
    pushDb<unknown[]>(`admins?user_id=eq.${userId}&select=user_id`),
    pushDb<unknown[]>(`moderators?user_id=eq.${userId}&select=user_id`),
  ]);
  if (a && a.length) return "admin";
  if (m && m.length) return "mod";
  return null;
}

/** Chamada às rotas de administração do login (lista e bane contas). */
export async function authAdmin<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; data: T | null }> {
  if (!SB || !SECRET) return { ok: false, data: null };
  try {
    const headers: Record<string, string> = { ...keyHeaders(SECRET), "Content-Type": "application/json" };
    // A API de login também aceita a chave secreta no Authorization.
    if (!headers.Authorization) headers.Authorization = `Bearer ${SECRET}`;
    const res = await fetch(`${SB}/auth/v1/admin/${path}`, { ...init, headers, cache: "no-store" });
    const text = await res.text();
    return { ok: res.ok, data: text ? (JSON.parse(text) as T) : null };
  } catch {
    return { ok: false, data: null };
  }
}
