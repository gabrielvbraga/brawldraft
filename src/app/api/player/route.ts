// ROTA /api/player?tag=XXXX
// Busca o perfil do jogador na API oficial da Supercell e devolve os Brawlers
// que ele tem e o nível de cada um. Roda no SERVIDOR: a chave fica escondida aqui.
//
// A chave da Supercell só aceita pedidos de IPs cadastrados, e a Vercel não tem IP fixo.
// Por isso o pedido passa pelo intermediário gratuito da RoyaleAPI, que tem o IP fixo
// 45.79.218.79 (o mesmo cadastrado na chave).
//
// A chave fica na Vercel, em Settings > Environment Variables, com o nome BRAWL_API_KEY.

const API = "https://bsproxy.royaleapi.dev/v1";

type RawPlayer = {
  name?: string;
  brawlers?: { id?: number; name?: string; power?: number }[];
};

export async function GET(request: Request) {
  const key = process.env.BRAWL_API_KEY;
  if (!key) return Response.json({ error: "no-key" }, { status: 500 });

  // A tag pode vir com ou sem "#", com espaços ou letras minúsculas.
  const raw = new URL(request.url).searchParams.get("tag") ?? "";
  const tag = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0");
  if (tag.length < 3 || tag.length > 14) return Response.json({ error: "bad-tag" }, { status: 400 });

  try {
    const res = await fetch(`${API}/players/%23${tag}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 404) return Response.json({ error: "not-found" }, { status: 404 });
    if (!res.ok) return Response.json({ error: "api", status: res.status }, { status: 502 });

    const player = (await res.json()) as RawPlayer;
    const brawlers = (player.brawlers ?? [])
      .filter((b) => typeof b.id === "number")
      .map((b) => ({ id: b.id as number, power: b.power ?? 1 }));
    return Response.json({ name: player.name ?? "", brawlers });
  } catch {
    return Response.json({ error: "api" }, { status: 502 });
  }
}
