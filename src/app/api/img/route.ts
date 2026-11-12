// ROTA /api/img?b=16000000 (Brawler) ou ?m=15000007 (mapa)
// Repassa a foto da Brawlify pelo nosso próprio site. Isso é preciso para o card de
// compartilhar: o navegador só deixa transformar o desenho em imagem se as fotos
// vierem do mesmo site. Só aceita números nas faixas certas (não serve para outra coisa).

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const b = Number(q.get("b"));
  const m = Number(q.get("m"));
  let url: string | null = null;
  if (Number.isInteger(b) && b >= 16000000 && b < 16001000) url = `https://cdn.brawlify.com/brawlers/borderless/${b}.png`;
  else if (Number.isInteger(m) && m >= 15000000 && m < 15010000) url = `https://cdn.brawlify.com/maps/regular/${m}.png`;
  if (!url) return new Response("pedido inválido", { status: 400 });

  try {
    const res = await fetch(url);
    if (!res.ok) return new Response("sem foto", { status: 404 });
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > 3_000_000) return new Response("foto grande demais", { status: 502 });
    return new Response(bytes, {
      headers: {
        "Content-Type": res.headers.get("content-type")?.startsWith("image/") ? (res.headers.get("content-type") as string) : "image/png",
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      },
    });
  } catch {
    return new Response("sem foto", { status: 502 });
  }
}
