// ROTA /api/rotation
// Quais mapas de Ranked estão ativos hoje: os mapas que apareceram em partidas de
// RANKED nas últimas 36 horas, segundo o coletor (que lê partidas reais dos melhores
// jogadores). A rotação de eventos da API oficial não é usada porque ela mostra os
// mapas do modo normal, que não são os mesmos do Ranked.

import { keyHeaders } from "@/lib/supabase";

export async function GET(request: Request) {
  void request; // ler o pedido mantém esta rota sempre atualizada (nunca vira página fixa)
  const active: number[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/stats?id=eq.ranked&select=data->recentMaps`, {
        headers: keyHeaders(key),
        cache: "no-store",
      });
      const rows = res.ok ? ((await res.json()) as { recentMaps?: Record<string, string> | null }[]) : [];
      const recent = rows[0]?.recentMaps ?? {};
      const limit = Date.now() - 36 * 60 * 60 * 1000;
      for (const [id, when] of Object.entries(recent)) if (new Date(when).getTime() >= limit) active.push(Number(id));
    } catch {
      // sem o coletor: a tela mostra todos os mapas
    }
  }
  return Response.json({ active }, { headers: { "Cache-Control": "s-maxage=900" } });
}
