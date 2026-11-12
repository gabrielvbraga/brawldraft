// ROTA /api/player?tag=XXXX
// Perfil do jogador pela API oficial: nome, troféus, vitórias, clube e cada Brawler.

import { fetchPlayer } from "@/lib/player";
import { cleanTag } from "@/lib/supercell";

export async function GET(request: Request) {
  if (!process.env.BRAWL_API_KEY) return Response.json({ error: "no-key" }, { status: 500 });
  const tag = cleanTag(new URL(request.url).searchParams.get("tag") ?? "");
  if (!tag) return Response.json({ error: "bad-tag" }, { status: 400 });
  const p = await fetchPlayer(tag);
  if (p === "not-found") return Response.json({ error: "not-found" }, { status: 404 });
  if (p === "api") return Response.json({ error: "api" }, { status: 502 });
  return Response.json(p);
}
