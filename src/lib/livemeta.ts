// META AO VIVO
// Lê as páginas de Ranked do topbrawl.com (a geral e uma por mapa) e extrai a
// lista dos melhores Brawlers de cada uma. Roda no SERVIDOR do site (Vercel).
//
// A atualização automática vem do "revalidate": a Vercel guarda o resultado e,
// depois de 12 horas, busca tudo de novo na próxima visita. Ninguém precisa fazer nada.
//
// Se o topbrawl mudar o layout ou ficar fora do ar, a leitura falha e o site
// usa os dados salvos nos arquivos de src/data (o site nunca quebra por causa disso).

export const TWELVE_HOURS = 60 * 60 * 12;

const BASE = "https://topbrawl.com/rankeds";

/** Uma linha da tabela: nome do Brawler, % de vitórias e % de uso. */
export type MetaRow = { name: string; wins: number; use: number };

export type LiveMeta = {
  /** Ranking geral do Ranked (todos os mapas). */
  overall: MetaRow[];
  /** Ranking de cada mapa, pelo número do mapa no jogo (15000007...). */
  maps: Record<number, MetaRow[]>;
  /** Quando os dados foram buscados (texto ISO). */
  updatedAt: string;
};

/** Deixa o texto só com letras e números minúsculos, para comparar nomes. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Lê o HTML de uma página do topbrawl e devolve as linhas da tabela, na ordem.
 * Cada linha da tabela tem um link para "/brawlers/<nome>" seguido de três
 * números com duas casas decimais (vitórias, uso e pontuação).
 */
export function parseTable(html: string, knownNames: string[]): MetaRow[] {
  const byKey = new Map(knownNames.map((n) => [normalize(n), n]));
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

  // Acha todos os links de Brawler e onde cada um começa no texto.
  const links = [...clean.matchAll(/<a[^>]+href="[^"]*\/brawlers\/([a-z0-9-]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)];

  const rows: MetaRow[] = [];
  const seen = new Set<string>();
  links.forEach((link, i) => {
    // Nome: tenta pelo endereço do link e, se não achar, pelo texto do link.
    const slugKey = normalize(link[1]);
    const textKey = normalize(link[2].replace(/<[^>]+>/g, " "));
    const name = byKey.get(slugKey) ?? byKey.get(textKey);
    if (!name || seen.has(name)) return;

    // Texto entre este link e o próximo: é onde ficam os números da linha.
    const start = (link.index ?? 0) + link[0].length;
    const end = i + 1 < links.length ? (links[i + 1].index ?? clean.length) : clean.length;
    const between = clean.slice(start, end).replace(/<[^>]+>/g, " ");
    const nums = [...between.matchAll(/(\d{1,3}\.\d{2})/g)].map((m) => Number(m[1]));
    if (nums.length < 2) return; // sem números: não é uma linha da tabela (ex.: medalhas do topo)

    seen.add(name);
    rows.push({ name, wins: nums[0], use: nums[1] });
  });
  return rows;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BrawlDraft (site de fã, atualiza a cada 12h)" },
      next: { revalidate: TWELVE_HOURS },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * Busca o meta geral e o de cada mapa. Devolve null se a página geral falhar
 * (aí o site usa os dados salvos). Um mapa que falhar fica só sem dados novos.
 */
export async function getLiveMeta(mapIds: number[], knownNames: string[]): Promise<LiveMeta | null> {
  const overallHtml = await fetchPage(BASE);
  const overall = overallHtml ? parseTable(overallHtml, knownNames) : [];
  if (overall.length < 5) return null;

  const maps: Record<number, MetaRow[]> = {};
  const pages = await Promise.all(mapIds.map((id) => fetchPage(`${BASE}/${id}`)));
  pages.forEach((html, i) => {
    const rows = html ? parseTable(html, knownNames) : [];
    if (rows.length >= 3) maps[mapIds[i]] = rows;
  });

  return { overall, maps, updatedAt: new Date().toISOString() };
}
