// ROTA /api/push/message?e=<endpoint>
// O service worker do celular pergunta aqui o texto do aviso que acabou de chegar.

import { pushDb, type PushSub } from "@/lib/pushdb";
import { validEndpoint } from "@/lib/webpush";

export async function GET(request: Request) {
  const e = new URL(request.url).searchParams.get("e");
  const fallback = { title: "BrawlDraft", body: "Novidades no Ranked.", url: "/" };
  if (!validEndpoint(e)) return Response.json(fallback);
  const rows = await pushDb<Pick<PushSub, "message">[]>(`push_subs?endpoint=eq.${encodeURIComponent(e)}&select=message`);
  return Response.json(rows?.[0]?.message ?? fallback, { headers: { "Cache-Control": "no-store" } });
}
