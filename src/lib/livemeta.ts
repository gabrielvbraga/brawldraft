// META AO VIVO
// Lê as páginas de Ranked do topbrawl.com (a geral e uma por mapa) e extrai a
// lista dos melhores Brawlers de cada uma. Roda no SERVIDOR do site (Vercel).
//
// A atualização automática vem do "use cache" + cacheLife: o Next.js guarda o
// resultado e, depois de 12 horas, busca tudo de novo na próxima visita.
// Ninguém precisa fazer nada.
//
// Se o topbrawl mudar o layout ou ficar fora do ar, a leitura falha e o site
// usa os dados salvos nos arquivos de src/data (o site nunca quebra por causa disso).

import { cacheLife } from "next/cache";

export const REFRESH = 60 * 60 * 12; // 12 horas

const BASE = "https://topbrawl.com/rankeds";
const FULL_LIST = "https://seemeta.com/en/brawl-stars/tier-list";

/** Uma linha da tabela: nome do Brawler, % de vitórias e % de uso. */
export type MetaRow = { name: string; wins: number; use: number };

export type LiveMeta = {
  /** Ranking geral do Ranked (todos os mapas). */
  overall: MetaRow[];
  /** Ranking de cada mapa, pelo número do mapa no jogo (15000007...). */
  maps: Record<number, MetaRow[]>;
  /** Quando os dados foram buscados (texto ISO). */
  updatedAt: string;
  /** true = cópia salva no site (a leitura ao vivo falhou). */
  saved?: boolean;
  /** true = "overall" tem TODOS os Brawlers (seemeta); false = só o top 10 (topbrawl). */
  full?: boolean;
};

/** Deixa o texto só com letras e números minúsculos, para comparar nomes. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Escapa um texto para usar dentro de uma expressão regular. */
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Lê um número com vírgula ou ponto ("60,1" ou "60.10"). */
const toNumber = (t: string) => Number(t.replace(",", "."));

/**
 * JEITO 1: pelos links. Cada linha da tabela tem um link para "/brawlers/<nome>"
 * seguido dos números da linha (vitórias, uso e pontuação).
 */
function byLinks(html: string, byKey: Map<string, string>): MetaRow[] {
  const links = [...html.matchAll(/<a[^>]+href="[^"]*\/brawlers\/([a-z0-9-]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)];
  const rows: MetaRow[] = [];
  const seen = new Set<string>();
  links.forEach((link, i) => {
    const name = byKey.get(normalize(link[1])) ?? byKey.get(normalize(link[2].replace(/<[^>]+>/g, " ")));
    if (!name || seen.has(name)) return;
    const start = (link.index ?? 0) + link[0].length;
    const end = i + 1 < links.length ? (links[i + 1].index ?? html.length) : html.length;
    const between = html.slice(start, end).replace(/<[^>]+>/g, " ");
    const nums = [...between.matchAll(/(\d{1,3}[.,]\d{1,2})/g)].map((m) => toNumber(m[1]));
    if (nums.length < 2) return; // sem números: não é uma linha da tabela (ex.: medalhas do topo)
    seen.add(name);
    rows.push({ name, wins: nums[0], use: nums[1] });
  });
  return rows;
}

/**
 * JEITO 2: pelo texto. Tira todas as marcações e procura cada nome de Brawler
 * seguido de pelo menos dois números com casa decimal, sem outro nome no meio.
 * Funciona tanto no texto da página quanto nos dados escondidos em <script>.
 */
function byText(text: string, names: string[]): MetaRow[] {
  const rows: MetaRow[] = [];
  // Nomes maiores primeiro, para "Larry & Lawrie" não virar "Larry".
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const anyName = new RegExp(`(?<![A-Za-z])(${sorted.map(escapeRe).join("|")})(?![A-Za-z])`, "g");
  const hits = [...text.matchAll(anyName)];
  const seen = new Set<string>();
  hits.forEach((hit, i) => {
    const name = hit[1];
    if (seen.has(name)) return;
    const start = (hit.index ?? 0) + name.length;
    const end = Math.min(i + 1 < hits.length ? (hits[i + 1].index ?? text.length) : text.length, start + 300);
    const nums = [...text.slice(start, end).matchAll(/(?<![\d.,])(\d{1,2}[.,]\d{1,2})(?![\d])/g)].map((m) => toNumber(m[1]));
    if (nums.length < 2 || nums[0] > 100) return;
    seen.add(name);
    rows.push({ name, wins: nums[0], use: nums[1] });
  });
  return rows;
}

/**
 * Lê o HTML de uma página do topbrawl e devolve as linhas da tabela.
 * Tenta três jeitos, do mais preciso para o mais solto, e fica com o primeiro
 * que achar pelo menos 3 Brawlers. O resultado vem ordenado por % DE VITÓRIAS.
 */
export function parseTable(html: string, knownNames: string[]): MetaRow[] {
  const byKey = new Map(knownNames.map((n) => [normalize(n), n]));
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(" ");
  const page = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const pageText = page
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  // Os dados dentro de <script> costumam vir com aspas e símbolos "escapados".
  const scriptText = scripts
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ");

  for (const attempt of [() => byLinks(page, byKey), () => byText(pageText, knownNames), () => byText(scriptText, knownNames)]) {
    const rows = attempt();
    if (rows.length >= 3) return rows.sort((a, b) => b.wins - a.wins); // o 1º é quem mais vence
  }
  return [];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Cabeçalhos de um navegador comum: alguns sites recusam pedidos sem eles.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
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
/**
 * Ranking COMPLETO do Ranked (todos os Brawlers, com % de vitórias), lido do seemeta.com.
 * O topbrawl só mostra os 10 primeiros; para ordenar todos por % de vitórias, precisamos
 * da lista inteira. Devolve [] se não conseguir ler (aí o site usa o top 10 do topbrawl).
 */
export async function fullRanking(knownNames: string[]): Promise<MetaRow[]> {
  const html = await fetchPage(FULL_LIST);
  if (!html) return [];
  const rows = parseTable(html, knownNames).filter((r) => r.wins >= 30 && r.wins <= 75);
  // Só confia se achou a maior parte dos Brawlers.
  return rows.length >= knownNames.length * 0.6 ? rows : [];
}

export async function getLiveMeta(mapIds: number[], knownNames: string[]): Promise<LiveMeta | null> {
  "use cache";

  const [overallHtml, full] = await Promise.all([fetchPage(BASE), fullRanking(knownNames)]);
  const top10 = overallHtml ? parseTable(overallHtml, knownNames) : [];
  const overall = full.length > 0 ? full : top10;
  if (overall.length < 5) {
    // Falhou: guarda o "falhou" por só 2 minutos, para tentar de novo logo.
    cacheLife({ stale: 30, revalidate: 120, expire: 3600 });
    return null;
  }
  // Deu certo: guarda por 12 horas. Depois disso, a próxima visita busca de novo.
  cacheLife({ stale: 60 * 60, revalidate: REFRESH, expire: REFRESH * 14 });

  const maps: Record<number, MetaRow[]> = {};
  const pages = await Promise.all(mapIds.map((id) => fetchPage(`${BASE}/${id}`)));
  pages.forEach((html, i) => {
    const rows = html ? parseTable(html, knownNames) : [];
    if (rows.length >= 3) maps[mapIds[i]] = rows;
  });

  return { overall, maps, full: full.length > 0, updatedAt: new Date().toISOString() };
}
