// Leitura e gravação da tabela push_subs (aparelhos com avisos ligados).
// Usa a chave secreta: só roda no servidor.

import { keyHeaders } from "./supabase";

export type PushSub = {
  endpoint: string;
  maps: number[];
  lang: string;
  message: { title: string; body: string; url: string } | null;
  notified: Record<string, string>; // mapa -> quando avisou
  meta_day: string | null;
};

export async function pushDb<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      cache: "no-store",
      headers: { ...keyHeaders(key), "Content-Type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}) },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return (text ? JSON.parse(text) : true) as T;
  } catch {
    return null;
  }
}
