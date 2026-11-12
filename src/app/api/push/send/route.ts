// ROTA /api/push/send?key=CRON_SECRET  (o GitHub chama de hora em hora, logo depois do coletor)
// Para cada aparelho com avisos ligados:
//   - se um mapa em que a pessoa joga bem está no Ranked agora (e ela não foi avisada
//     dele nos últimos 7 dias), avisa;
//   - se o meta mudou muito desde a cópia de ontem, avisa uma vez por dia.

import { MAPS } from "@/data/maps";
import { mapName } from "@/lib/i18n";
import type { MetaDay } from "@/lib/metaChanges";
import { pushDb, type PushSub } from "@/lib/pushdb";
import { PUSH_ON, sendPush } from "@/lib/webpush";

export const maxDuration = 60;

const WEEK = 7 * 24 * 3600 * 1000;
const BIG_MOVE = 2; // pontos de % de vitórias de um dia para o outro

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace("Bearer ", "") ?? new URL(request.url).searchParams.get("key");
  if (!secret || given !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!PUSH_ON) return Response.json({ error: "faltam as chaves VAPID" }, { status: 503 });

  // Mapas do Ranked agora (vistos pelo coletor nas últimas 36 horas) e seus nomes.
  const stats = await pushDb<{ recentMaps: Record<string, string> | null; mapInfo: Record<string, { name: string }> | null }[]>(
    "stats?id=eq.ranked&select=recentMaps:data->recentMaps,mapInfo:data->mapInfo",
  );
  const recent = stats?.[0]?.recentMaps ?? {};
  const info = stats?.[0]?.mapInfo ?? {};
  const limit = Date.now() - 36 * 3600 * 1000;
  const active = new Set(Object.entries(recent).filter(([, when]) => new Date(when).getTime() >= limit).map(([id]) => Number(id)));
  const nameOf = (id: number) => MAPS.find((m) => m.gameId === id)?.name ?? info[String(id)]?.name ?? `#${id}`;

  // Quem mais subiu ou caiu entre as duas cópias diárias mais novas do meta.
  const days = (await pushDb<MetaDay[]>("meta_history?select=day,overall&order=day.desc&limit=2")) ?? [];
  let metaDay: string | null = null;
  let moves: { name: string; delta: number }[] = [];
  if (days.length === 2) {
    const old = new Map(days[1].overall.map((r) => [r.name, r.wins]));
    moves = days[0].overall
      .filter((r) => old.has(r.name))
      .map((r) => ({ name: r.name, delta: Math.round((r.wins - (old.get(r.name) ?? r.wins)) * 10) / 10 }))
      .filter((m) => Math.abs(m.delta) >= BIG_MOVE)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
    if (moves.length > 0) metaDay = days[0].day;
  }

  const subs = (await pushDb<PushSub[]>("push_subs?select=endpoint,maps,lang,notified,meta_day&limit=2000")) ?? [];
  const now = Date.now();
  let sent = 0;
  let removed = 0;

  async function handle(sub: PushSub) {
    const en = sub.lang === "en";
    const notified = { ...(sub.notified ?? {}) };
    const hits = sub.maps.filter((id) => active.has(id) && (!notified[id] || now - new Date(notified[id]).getTime() > WEEK));
    const metaNews = metaDay && sub.meta_day !== metaDay ? moves : [];
    if (hits.length === 0 && metaNews.length === 0) return;

    const fmt = (m: { name: string; delta: number }) => `${m.name} ${m.delta > 0 ? "+" : ""}${String(m.delta).replace(".", en ? "." : ",")}%`;
    const names = hits.map((id) => mapName(en ? "en" : "pt", nameOf(id))).slice(0, 3).join(", ");
    let message: { title: string; body: string; url: string };
    if (hits.length > 0) {
      message = {
        title: en ? "Your map is in Ranked!" : "Seu mapa está no Ranked!",
        body:
          (en ? `${names}: you play well there. Tap to draft.` : `${names}: você joga bem aí. Toque para o draft.`) +
          (metaNews.length > 0 ? (en ? ` Meta moved: ${metaNews.map(fmt).join(", ")}.` : ` O meta mudou: ${metaNews.map(fmt).join(", ")}.`) : ""),
        url: "/",
      };
    } else {
      message = {
        title: en ? "The meta changed" : "O meta mudou",
        body: (en ? "Since yesterday: " : "Desde ontem: ") + metaNews.map(fmt).join(", "),
        url: "/",
      };
    }
    for (const id of hits) notified[id] = new Date(now).toISOString();
    await pushDb(`push_subs?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
      method: "PATCH",
      body: JSON.stringify({ message, notified, meta_day: metaNews.length > 0 ? metaDay : sub.meta_day }),
    });
    const status = await sendPush(sub.endpoint);
    if (status === 404 || status === 410) {
      await pushDb(`push_subs?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
      removed++;
    } else if (status >= 200 && status < 300) sent++;
  }

  for (let i = 0; i < subs.length; i += 20) await Promise.all(subs.slice(i, i + 20).map(handle));
  return Response.json({ subs: subs.length, active: active.size, sent, removed });
}
