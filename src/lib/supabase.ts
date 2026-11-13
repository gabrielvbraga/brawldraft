// CONEXÃO COM O SUPABASE (banco de dados e contas)
// Usa só "fetch", pela API REST que o Supabase já oferece, sem biblioteca extra.
//
// Variáveis na Vercel (Settings > Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL       -> "Project URL" do Supabase
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  -> chave "publishable" (sb_publishable_...) ou a antiga "anon"
//   SUPABASE_SERVICE_ROLE_KEY      -> chave "secret" (sb_secret_...) ou a antiga "service_role" (SECRETA)

import type { Overrides } from "./engine";
import type { RosterItem } from "./storage";

export const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** O que depende do Supabase (trio, contas, placar...) só aparece com ele configurado. */
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

/** Pedido genérico à API REST. Devolve o corpo em JSON, ou null se falhar. */
async function rest<T>(path: string, init: RequestInit & { token?: string; prefer?: string } = {}): Promise<T | null> {
  if (!SUPABASE_ON) return null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      ...init,
      headers: sbHeaders(init.token, init.prefer ? { Prefer: init.prefer } : {}),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return (text ? JSON.parse(text) : true) as T;
  } catch {
    return null;
  }
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

// ============== ESQUECI MINHA SENHA ==============

/** Manda o e-mail com o link para criar uma senha nova. */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<string | null> {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ email }),
    });
    if (res.ok) return null;
    const r = (await res.json().catch(() => ({}))) as AuthReply;
    return r.error_description ?? r.msg ?? r.message ?? "erro";
  } catch {
    return "rede";
  }
}

/** Quem clicou no link do e-mail volta com a sessão no endereço (#access_token=...&type=recovery). */
export async function sessionFromLink(hash: string): Promise<{ session: Session; type: string } | null> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const access = q.get("access_token");
  const refresh = q.get("refresh_token");
  if (!access || !refresh) return null;
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: sbHeaders(access) });
    if (!res.ok) return null;
    const u = (await res.json()) as { id: string; email: string };
    return {
      type: q.get("type") ?? "",
      session: {
        access_token: access,
        refresh_token: refresh,
        expires_at: Math.floor(Date.now() / 1000) + Number(q.get("expires_in") ?? 3600),
        user: { id: u.id, email: u.email },
      },
    };
  } catch {
    return null;
  }
}

/** Troca a senha de quem está logado (ou veio pelo link do e-mail). */
export async function updatePassword(s: Session, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, { method: "PUT", headers: sbHeaders(s.access_token), body: JSON.stringify({ password }) });
    if (res.ok) return null;
    const r = (await res.json().catch(() => ({}))) as AuthReply;
    return r.error_description ?? r.msg ?? r.message ?? "erro";
  } catch {
    return "rede";
  }
}

// ============== VERIFICAÇÃO EM 2 ETAPAS (app autenticador) ==============

export type Factor = { id: string; factor_type: string; status: string };

/** Fatores de 2 etapas da conta (só os "verified" valem). */
export async function listFactors(s: Session): Promise<Factor[]> {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: sbHeaders(s.access_token), cache: "no-store" });
    if (!res.ok) return [];
    const u = (await res.json()) as { factors?: Factor[] };
    return (u.factors ?? []).filter((f) => f.factor_type === "totp");
  } catch {
    return [];
  }
}

/** Começa a ativação: devolve o QR code para escanear no app autenticador. */
export async function enrollTotp(s: Session): Promise<{ id: string; qr: string; secret: string } | string> {
  try {
    // Fatores começados e não terminados atrapalham: apaga antes.
    for (const f of await listFactors(s)) if (f.status !== "verified") await unenrollFactor(s, f.id);
    const res = await fetch(`${SB_URL}/auth/v1/factors`, {
      method: "POST",
      headers: sbHeaders(s.access_token),
      body: JSON.stringify({ factor_type: "totp", friendly_name: `BrawlDraft ${Date.now()}`, issuer: "BrawlDraft" }),
    });
    const r = (await res.json()) as { id?: string; totp?: { qr_code?: string; secret?: string } } & AuthReply;
    if (!res.ok || !r.id || !r.totp?.qr_code) return r.error_description ?? r.msg ?? r.message ?? "erro";
    return { id: r.id, qr: r.totp.qr_code, secret: r.totp.secret ?? "" };
  } catch {
    return "rede";
  }
}

/** Confere o código de 6 dígitos. Se der certo, devolve a sessão nova (com as 2 etapas). */
export async function verifyTotp(s: Session, factorId: string, code: string): Promise<{ session: Session | null; error: string | null }> {
  try {
    const ch = await fetch(`${SB_URL}/auth/v1/factors/${factorId}/challenge`, { method: "POST", headers: sbHeaders(s.access_token), body: "{}" });
    const c = (await ch.json()) as { id?: string } & AuthReply;
    if (!ch.ok || !c.id) return { session: null, error: c.error_description ?? c.msg ?? c.message ?? "erro" };
    const res = await fetch(`${SB_URL}/auth/v1/factors/${factorId}/verify`, {
      method: "POST",
      headers: sbHeaders(s.access_token),
      body: JSON.stringify({ challenge_id: c.id, code }),
    });
    const r = (await res.json()) as AuthReply;
    if (!res.ok) return { session: null, error: r.error_description ?? r.msg ?? r.message ?? "erro" };
    return { session: toSession(r), error: null };
  } catch {
    return { session: null, error: "rede" };
  }
}

export async function unenrollFactor(s: Session, factorId: string): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/factors/${factorId}`, { method: "DELETE", headers: sbHeaders(s.access_token) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Renova a sessão se ela estiver para vencer. Devolve null se não der mais. */
export async function freshSession(s: Session | null): Promise<Session | null> {
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  const r = await auth("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
  return r.session;
}

// ============== DADOS DO USUÁRIO ==============

export type UserData = {
  history: unknown[];
  owned: number[];
  nick?: string | null;
  tag?: string | null;
  roster?: RosterItem[];
  free6?: number[];
  stats?: import("./achievements").SiteStats;
};

export async function loadUserData(s: Session): Promise<UserData | null> {
  const base = `user_data?user_id=eq.${s.user.id}&select=history,owned,nick,tag,roster,free6`;
  // "stats" só existe depois de rodar o SQL da v14; sem ela, lê o resto normalmente.
  const rows =
    (await rest<UserData[]>(`${base},stats`, { token: s.access_token })) ?? (await rest<UserData[]>(base, { token: s.access_token }));
  if (!rows) return null;
  return rows[0] ?? { history: [], owned: [] };
}

export async function saveUserData(s: Session, data: UserData): Promise<boolean> {
  const send = (d: UserData) =>
    rest<unknown>("user_data", {
      method: "POST",
      token: s.access_token,
      // "merge-duplicates" = se a linha já existe, atualiza em vez de dar erro.
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({ user_id: s.user.id, ...d, updated_at: new Date().toISOString() }),
    });
  let r = await send(data);
  // Sem a coluna "stats" (SQL da v14 ainda não rodado): salva o resto.
  if (r === null && data.stats !== undefined) {
    const { stats: _ignore, ...rest_ } = data;
    void _ignore;
    r = await send(rest_);
  }
  return r !== null;
}

// ============== ADMINISTRADOR ==============

/** É administrador? (está na tabela "admins") */
export async function isAdmin(s: Session): Promise<boolean> {
  const rows = await rest<unknown[]>(`admins?user_id=eq.${s.user.id}&select=user_id`, { token: s.access_token });
  return !!rows && rows.length > 0;
}

export async function isModerator(s: Session): Promise<boolean> {
  const rows = await rest<unknown[]>(`moderators?user_id=eq.${s.user.id}&select=user_id`, { token: s.access_token });
  return !!rows && rows.length > 0;
}

/** Correções do administrador (counters, sinergias e dicas de mapa). Qualquer um lê. */
export async function loadOverrides(): Promise<Overrides | null> {
  const rows = await rest<{ data: Overrides }[]>("overrides?id=eq.meta&select=data");
  return rows?.[0]?.data ?? null;
}

export async function saveOverrides(s: Session, data: Overrides): Promise<boolean> {
  const r = await rest<unknown>("overrides", {
    method: "POST",
    token: s.access_token,
    prefer: "resolution=merge-duplicates",
    body: JSON.stringify({ id: "meta", data, updated_at: new Date().toISOString() }),
  });
  return r !== null;
}

// ============== VISITAS ==============

/** Conta uma visita a uma tela (sem guardar nada da pessoa). */
export function logVisit(screen: string) {
  void rest<unknown>("visits", { method: "POST", body: JSON.stringify({ screen }) });
}

/** Visitas dos últimos 30 dias (só o administrador consegue ler). */
export async function loadVisits(s: Session): Promise<{ screen: string; day: string }[] | null> {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return rest(`visits?select=screen,day&day=gte.${from}&limit=50000`, { token: s.access_token });
}

// ============== PLACAR DO TREINO ==============

export type Score = { nick: string; score: number; map: string; created_at: string; user_id: string };

export async function saveScore(s: Session, nick: string, score: number, map: string): Promise<boolean> {
  const r = await rest<unknown>("train_scores", {
    method: "POST",
    token: s.access_token,
    body: JSON.stringify({ user_id: s.user.id, nick, score, map }),
  });
  return r !== null;
}

/** Melhores notas (a melhor de cada conta), da maior para a menor. */
export async function loadScores(): Promise<Score[] | null> {
  const rows = await rest<Score[]>("train_scores?select=nick,score,map,created_at,user_id&order=score.desc,created_at.asc&limit=500");
  if (!rows) return null;
  const best = new Map<string, Score>();
  for (const r of rows) if (!best.has(r.user_id)) best.set(r.user_id, r);
  return [...best.values()].slice(0, 50);
}

// ============== AS SUGESTÕES FUNCIONAM? ==============

/** Guarda (só para quem tem conta) se a pessoa seguiu a sugestão e se venceu. */
export async function saveRecResult(s: Session, r: { followed: boolean; win: boolean; map: string; brawler: string }): Promise<boolean> {
  const ok = await rest<unknown>("rec_results", {
    method: "POST",
    token: s.access_token,
    body: JSON.stringify({ user_id: s.user.id, ...r, map: r.map.slice(0, 40), brawler: r.brawler.slice(0, 30) }),
  });
  return ok !== null;
}

export type RecSummary = { followed: { games: number; wins: number }; other: { games: number; wins: number } };

/** Resumo de todo mundo: quem seguiu a sugestão x quem escolheu outro. */
export async function loadRecSummary(): Promise<RecSummary | null> {
  const rows = await rest<{ followed: boolean; games: number; wins: number }[]>("rpc/rec_summary", { method: "POST", body: "{}" });
  if (!rows || !Array.isArray(rows)) return null;
  const pick = (f: boolean) => {
    const r = rows.find((x) => x.followed === f);
    return { games: Number(r?.games ?? 0), wins: Number(r?.wins ?? 0) };
  };
  return { followed: pick(true), other: pick(false) };
}
