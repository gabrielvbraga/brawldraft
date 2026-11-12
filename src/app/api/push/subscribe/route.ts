// ROTA /api/push/subscribe
// POST { endpoint, maps, lang }  -> liga (ou atualiza) os avisos deste aparelho.
// DELETE { endpoint }            -> desliga.
// "maps" = números dos mapas em que a pessoa joga bem (calculados no próprio site).

import { pushDb } from "@/lib/pushdb";
import { PUSH_ON, validEndpoint } from "@/lib/webpush";

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > 4000) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  if (!PUSH_ON) return Response.json({ error: "off" }, { status: 503 });
  const b = await body(request);
  if (!validEndpoint(b.endpoint)) return Response.json({ error: "endpoint" }, { status: 400 });
  const maps = Array.isArray(b.maps)
    ? [...new Set(b.maps.filter((m): m is number => Number.isInteger(m) && m >= 15000000 && m < 15010000))].slice(0, 40)
    : [];
  const lang = b.lang === "en" ? "en" : "pt";
  const ok = await pushDb("push_subs?on_conflict=endpoint", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: JSON.stringify({ endpoint: b.endpoint, maps, lang }),
  });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "db" }, { status: 500 });
}

export async function DELETE(request: Request) {
  const b = await body(request);
  if (!validEndpoint(b.endpoint)) return Response.json({ error: "endpoint" }, { status: 400 });
  await pushDb(`push_subs?endpoint=eq.${encodeURIComponent(b.endpoint)}`, { method: "DELETE" });
  return Response.json({ ok: true });
}
