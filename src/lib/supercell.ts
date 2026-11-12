// CONVERSA COM A API OFICIAL DA SUPERCELL (só no servidor)
// A chave só aceita pedidos de IPs cadastrados, e a Vercel não tem IP fixo.
// Por isso os pedidos passam pelo intermediário gratuito da RoyaleAPI, que tem o
// IP fixo 45.79.218.79 (o mesmo cadastrado na chave BRAWL_API_KEY).

const API = "https://bsproxy.royaleapi.dev/v1";

/** Limpa a tag: aceita com ou sem "#", espaços e letra O no lugar de zero. */
export function cleanTag(raw: string): string | null {
  const tag = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0");
  return tag.length >= 3 && tag.length <= 14 ? tag : null;
}

/** Faz um pedido à API. Devolve o status e o corpo (ou null). */
export async function scApi<T>(path: string): Promise<{ status: number; data: T | null }> {
  const key = process.env.BRAWL_API_KEY;
  if (!key) return { status: 500, data: null };
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
  } catch {
    return { status: 502, data: null };
  }
}
