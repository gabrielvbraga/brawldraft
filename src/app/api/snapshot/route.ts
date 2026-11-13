// ROTA /api/snapshot?key=CRON_SECRET  (o GitHub chama de hora em hora)
// Guarda os troféus de cada tag ligada a uma conta do site, para o gráfico de evolução.

import { fetchPlayer } from "@/lib/player";
import { pushDb } from "@/lib/pushdb";
import { cleanTag } from "@/lib/supercell";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace("Bearer ", "") ?? new URL(request.url).searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = (await pushDb<{ tag: string | null }[]>("user_data?select=tag&tag=not.is.null&limit=1000")) ?? [];
  const tags = [...new Set(rows.map((r) => cleanTag(r.tag ?? "")).filter(Boolean))].slice(0, 400);
  let saved = 0;
  const start = Date.now();
  for (let i = 0; i < tags.length && Date.now() - start < 45_000; i += 20) {
    await Promise.all(
      tags.slice(i, i + 20).map(async (tag) => {
        const p = await fetchPlayer(tag);
        if (typeof p === "string") return;
        const ok = await pushDb("rpc/note_trophies", { method: "POST", body: JSON.stringify({ p_tag: tag, p_trophies: p.trophies }) });
        if (ok) saved++;
      }),
    );
  }
  return Response.json({ tags: tags.length, saved });
}
