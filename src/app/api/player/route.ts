// ROTA /api/player?tag=XXXX
// Perfil do jogador pela API oficial: nome, troféus e cada Brawler com nível e troféus.

import { cleanTag, scApi } from "@/lib/supercell";

type RawPlayer = {
  name?: string;
  trophies?: number;
  highestTrophies?: number;
  "3vs3Victories"?: number;
  brawlers?: { id?: number; power?: number; trophies?: number }[];
};

export async function GET(request: Request) {
  if (!process.env.BRAWL_API_KEY) return Response.json({ error: "no-key" }, { status: 500 });
  const tag = cleanTag(new URL(request.url).searchParams.get("tag") ?? "");
  if (!tag) return Response.json({ error: "bad-tag" }, { status: 400 });

  const r = await scApi<RawPlayer>(`/players/%23${tag}`);
  if (r.status === 404) return Response.json({ error: "not-found" }, { status: 404 });
  if (!r.data) return Response.json({ error: "api", status: r.status }, { status: 502 });

  const p = r.data;
  return Response.json({
    tag,
    name: p.name ?? "",
    trophies: p.trophies ?? 0,
    highestTrophies: p.highestTrophies ?? 0,
    victories3v3: p["3vs3Victories"] ?? 0,
    brawlers: (p.brawlers ?? [])
      .filter((b) => typeof b.id === "number")
      .map((b) => ({ id: b.id as number, power: b.power ?? 1, trophies: b.trophies ?? 0 })),
  });
}
