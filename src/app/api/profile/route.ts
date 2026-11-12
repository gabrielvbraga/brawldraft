// ROTA /api/profile?tag=XXXX[&view=1]
// Tudo do perfil numa chamada: dados da conta, rank do Ranked, partidas recentes
// e quantas pessoas viram o perfil. Com view=1, conta esta visita
// (cada pessoa conta 1 vez por dia, identificada por um código embaralhado — sem guardar o IP).

import { createHash } from "node:crypto";
import { parseBattlelog, type RawItem } from "@/lib/battlelog";
import { fetchPlayer } from "@/lib/player";
import { pushDb } from "@/lib/pushdb";
import type { SiteStats } from "@/lib/achievements";
import { cleanTag, scApi } from "@/lib/supercell";

async function countViews(tag: string, since?: string): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 0;
  try {
    const q = `tag=eq.${tag}${since ? `&day=gte.${since}` : ""}&select=tag`;
    const headers: Record<string, string> = { apikey: key, Prefer: "count=exact", Range: "0-0" };
    if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${url}/rest/v1/profile_views?${q}`, { headers, cache: "no-store" });
    const range = res.headers.get("content-range"); // "0-0/123"
    return Number(range?.split("/")[1] ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  if (!process.env.BRAWL_API_KEY) return Response.json({ error: "no-key" }, { status: 500 });
  const q = new URL(request.url).searchParams;
  const tag = cleanTag(q.get("tag") ?? "");
  if (!tag) return Response.json({ error: "bad-tag" }, { status: 400 });

  const [player, log] = await Promise.all([fetchPlayer(tag), scApi<{ items?: RawItem[] }>(`/players/%23${tag}/battlelog`)]);
  if (player === "not-found") return Response.json({ error: "not-found" }, { status: 404 });
  if (player === "api") return Response.json({ error: "api" }, { status: 502 });
  const { matches, summary, rank } = parseBattlelog(log.data?.items ?? [], tag);

  // Conta a visita (1 por pessoa por dia).
  const today = new Date().toISOString().slice(0, 10);
  if (q.get("view") === "1") {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ua = request.headers.get("user-agent") ?? "";
    const viewer = createHash("sha256").update(`${ip}|${ua}|${process.env.CRON_SECRET ?? "bd"}`).digest("hex").slice(0, 20);
    await pushDb("profile_views?on_conflict=tag,viewer,day", {
      method: "POST",
      prefer: "resolution=ignore-duplicates",
      body: JSON.stringify({ tag, viewer, day: today }),
    });
  }
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [total, week, bestRank, stats] = await Promise.all([
    countViews(tag),
    countViews(tag, weekAgo),
    // Maior rank já visto: guarda o de agora e devolve o maior.
    rank !== null
      ? pushDb<number>("rpc/note_rank", { method: "POST", body: JSON.stringify({ p_tag: tag, p_rank: rank }) })
      : pushDb<{ best: number }[]>(`rank_best?tag=eq.${tag}&select=best`).then((r) => r?.[0]?.best ?? null),
    // Números do site (para as conquistas): só se UMA conta tiver essa tag.
    pushDb<{ stats: SiteStats }[]>(`user_data?tag=in.(${tag},${encodeURIComponent("#" + tag)})&select=stats`).then((r) =>
      r && r.length === 1 ? r[0].stats : null,
    ),
  ]);

  return Response.json(
    { player, rank, bestRank: typeof bestRank === "number" ? Math.max(bestRank, rank ?? 0) : rank, matches, recent: summary, views: { total, week }, stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
