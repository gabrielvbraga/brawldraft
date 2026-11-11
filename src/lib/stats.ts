// LÊ AS CONTAS DO COLETOR (no servidor), guardando por 1 hora.

import { cacheLife } from "next/cache";
import { slim, type Collected, type StoredStats } from "./collector";
import { keyHeaders } from "./supabase";

export async function getCollected(): Promise<Collected | null> {
  "use cache";
  cacheLife({ stale: 60 * 10, revalidate: 60 * 60, expire: 60 * 60 * 24 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/stats?id=eq.ranked&select=data`, {
      headers: keyHeaders(key),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { data: StoredStats }[];
    return rows[0]?.data ? slim(rows[0].data) : null;
  } catch {
    return null;
  }
}
