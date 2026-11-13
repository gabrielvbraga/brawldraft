// ROTA /api/admin/users  (só administradores e moderadores)
// GET  -> lista as contas do site (e-mail, apelido, tag, cargo, banida ou não)
// POST { action, userId } -> "ban" | "unban" (admin e moderador) | "mod" | "unmod" (só admin)

import { pushDb } from "@/lib/pushdb";
import { authAdmin, roleOf, userFromToken, type Role } from "@/lib/staff";

type AuthUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  factors?: { status?: string }[];
};

async function caller(request: Request): Promise<{ id: string; role: Role } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const id = await userFromToken(token);
  if (!id) return null;
  const role = await roleOf(id);
  return role ? { id, role } : null;
}

export async function GET(request: Request) {
  const me = await caller(request);
  if (!me) return Response.json({ error: "denied" }, { status: 403 });

  const all: AuthUser[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await authAdmin<{ users?: AuthUser[] }>(`users?page=${page}&per_page=200`);
    if (!r.ok || !r.data?.users) {
      if (page === 1) return Response.json({ error: "auth-admin" }, { status: 502 });
      break;
    }
    all.push(...r.data.users);
    if (r.data.users.length < 200) break;
  }
  const [data, admins, mods] = await Promise.all([
    pushDb<{ user_id: string; nick: string | null; tag: string | null }[]>("user_data?select=user_id,nick,tag"),
    pushDb<{ user_id: string }[]>("admins?select=user_id"),
    pushDb<{ user_id: string }[]>("moderators?select=user_id"),
  ]);
  const byId = new Map((data ?? []).map((d) => [d.user_id, d]));
  const adminSet = new Set((admins ?? []).map((a) => a.user_id));
  const modSet = new Set((mods ?? []).map((m) => m.user_id));
  const now = Date.now();
  const users = all.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    createdAt: u.created_at ?? null,
    lastSignIn: u.last_sign_in_at ?? null,
    banned: !!u.banned_until && Date.parse(u.banned_until) > now,
    mfa: (u.factors ?? []).some((f) => f.status === "verified"),
    nick: byId.get(u.id)?.nick ?? null,
    tag: byId.get(u.id)?.tag ?? null,
    role: adminSet.has(u.id) ? "admin" : modSet.has(u.id) ? "mod" : null,
  }));
  users.sort((a, b) => (b.lastSignIn ?? "").localeCompare(a.lastSignIn ?? ""));
  return Response.json({ me: me.role, users }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const me = await caller(request);
  if (!me) return Response.json({ error: "denied" }, { status: 403 });
  let body: { action?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad" }, { status: 400 });
  }
  const target = body.userId ?? "";
  if (!/^[0-9a-f-]{36}$/.test(target)) return Response.json({ error: "bad" }, { status: 400 });
  if (target === me.id) return Response.json({ error: "self" }, { status: 400 });
  const targetRole = await roleOf(target);

  switch (body.action) {
    case "ban": {
      // Moderador não bane administrador nem outro moderador.
      if (targetRole === "admin" || (me.role === "mod" && targetRole)) return Response.json({ error: "denied" }, { status: 403 });
      const r = await authAdmin(`users/${target}`, { method: "PUT", body: JSON.stringify({ ban_duration: "876000h" }) });
      // Some do placar do treino.
      if (r.ok) await pushDb(`train_scores?user_id=eq.${target}`, { method: "DELETE" });
      return Response.json({ ok: r.ok });
    }
    case "unban": {
      const r = await authAdmin(`users/${target}`, { method: "PUT", body: JSON.stringify({ ban_duration: "none" }) });
      return Response.json({ ok: r.ok });
    }
    case "mod":
    case "unmod": {
      if (me.role !== "admin" || targetRole === "admin") return Response.json({ error: "denied" }, { status: 403 });
      const ok =
        body.action === "mod"
          ? await pushDb("moderators?on_conflict=user_id", { method: "POST", prefer: "resolution=ignore-duplicates", body: JSON.stringify({ user_id: target }) })
          : await pushDb(`moderators?user_id=eq.${target}`, { method: "DELETE" });
      return Response.json({ ok: !!ok });
    }
    default:
      return Response.json({ error: "bad" }, { status: 400 });
  }
}
