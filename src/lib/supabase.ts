// CONEXÃO COM O SUPABASE (banco de dados e contas)
// Usa só "fetch", pela API REST que o Supabase já oferece, sem biblioteca extra.
//
// Variáveis na Vercel (Settings > Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL       -> "Project URL" do Supabase
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  -> chave "publishable" (sb_publishable_...) ou a antiga "anon"
//   SUPABASE_SERVICE_ROLE_KEY      -> chave "secret" (sb_secret_...) ou a antiga "service_role" (SECRETA)

export const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** O que depende do Supabase (trio, contas, coletor) só aparece com ele configurado. */
export const SUPABASE_ON = SB_URL !== "" && SB_ANON !== "";

/**
 * Cabeçalhos de um pedido ao Supabase. "token" = sessão do usuário logado, se houver.
 * As chaves novas (sb_publishable_... e sb_secret_...) vão só no "apikey";
 * as antigas (anon e service_role) também vão no "Authorization".
 */
export function keyHeaders(key: string, token?: string): Record<string, string> {
  const h: Record<string, string> = { apikey: key };
  if (token) h.Authorization = `Bearer ${token}`;
  else if (!key.startsWith("sb_")) h.Authorization = `Bearer ${key}`;
  return h;
}

export function sbHeaders(token?: string, extra: Record<string, string> = {}) {
  return { ...keyHeaders(SB_ANON, token), "Content-Type": "application/json", ...extra };
}

// ======================= CONTAS =======================

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // segundos desde 1970
  user: { id: string; email: string };
};

type AuthReply = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email: string };
  msg?: string;
  error_description?: string;
  message?: string;
};

function toSession(r: AuthReply): Session | null {
  if (!r.access_token || !r.refresh_token || !r.user) return null;
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600),
    user: { id: r.user.id, email: r.user.email },
  };
}

async function auth(path: string, body: unknown): Promise<{ session: Session | null; error: string | null; needsConfirm: boolean }> {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/${path}`, { method: "POST", headers: sbHeaders(), body: JSON.stringify(body) });
    const r = (await res.json()) as AuthReply;
    if (!res.ok) return { session: null, error: r.error_description ?? r.msg ?? r.message ?? "erro", needsConfirm: false };
    const session = toSession(r);
    // Cadastro sem sessão = o Supabase está pedindo para confirmar o e-mail.
    return { session, error: null, needsConfirm: !session };
  } catch {
    return { session: null, error: "rede", needsConfirm: false };
  }
}

export const signUp = (email: string, password: string) => auth("signup", { email, password });
export const signIn = (email: string, password: string) => auth("token?grant_type=password", { email, password });

/** Renova a sessão se ela estiver para vencer. Devolve null se não der mais. */
export async function freshSession(s: Session | null): Promise<Session | null> {
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  const r = await auth("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
  return r.session;
}

// ============== DADOS DO USUÁRIO (histórico e Brawlers) ==============

export type UserData = { history: unknown[]; owned: number[] };

export async function loadUserData(s: Session): Promise<UserData | null> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/user_data?user_id=eq.${s.user.id}&select=history,owned`, {
      headers: sbHeaders(s.access_token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as UserData[];
    return rows[0] ?? { history: [], owned: [] };
  } catch {
    return null;
  }
}

export async function saveUserData(s: Session, data: UserData): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/user_data`, {
      method: "POST",
      // "merge-duplicates" = se a linha já existe, atualiza em vez de dar erro.
      headers: sbHeaders(s.access_token, { Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ user_id: s.user.id, ...data, updated_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
