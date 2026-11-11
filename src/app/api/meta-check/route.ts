// ROTA DE DIAGNÓSTICO: /api/meta-check
// Mostra se o servidor consegue ler o topbrawl.com e quantas linhas a leitura achou.
// Serve só para conferir quando a frase "Meta salvo no site" aparecer na tela inicial.

import { BRAWLERS } from "@/data/brawlers";
import { parseTable } from "@/lib/livemeta";

export async function GET(request: Request) {
  // Página a testar: a geral, ou ?mapa=15000007 para um mapa.
  const map = new URL(request.url).searchParams.get("mapa");
  const url = `https://topbrawl.com/rankeds${map ? `/${map.replace(/\D/g, "")}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    const html = await res.text();
    const rows = parseTable(html, BRAWLERS.map((b) => b.name));
    const at = html.indexOf("/brawlers/");
    return Response.json({
      url,
      status: res.status,
      bytes: html.length,
      brawlerLinks: html.split("/brawlers/").length - 1,
      rowsParsed: rows.length,
      firstRows: rows.slice(0, 5),
      sample: at >= 0 ? html.slice(Math.max(0, at - 300), at + 900) : html.slice(0, 1200),
    });
  } catch (e) {
    return Response.json({ url, error: String(e) }, { status: 500 });
  }
}
