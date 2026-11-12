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
    // Trechos da página perto do nome "Mr. P", para ver como a tabela está escrita.
    const around = [...html.matchAll(/Mr\. ?P/g)].slice(0, 4).map((m) => html.slice(Math.max(0, (m.index ?? 0) - 250), (m.index ?? 0) + 350));
    return Response.json({
      url,
      status: res.status,
      bytes: html.length,
      anchorsToBrawlers: (html.match(/<a[^>]+\/brawlers\//g) ?? []).length,
      scriptTags: (html.match(/<script/g) ?? []).length,
      rowsParsed: rows.length,
      firstRows: rows.slice(0, 5),
      around,
    });
  } catch (e) {
    return Response.json({ url, error: String(e) }, { status: 500 });
  }
}
