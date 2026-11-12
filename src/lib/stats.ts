// LÊ AS CONTAS DO COLETOR (no servidor), guardando por 1 hora.

import { cacheLife } from "next/cache";
import { emptyStats, slim, type Collected, type StoredStats } from "./collector";
import type { MetaDay } from "./metaChanges";
import { keyHeaders } from "./supabase";

export async function getCollected(): Promise<Collected | null> {
  "use cache";
  cacheLife({ stale: 60 * 10, revalidate: 60 * 60, expire: 60 * 60 * 24 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    // Pede só as partes usadas no site (sem a lista de partidas já vistas, que é grande).
    const fields = ["updatedAt", "battles", "maps", "vs", "with", "byRank", "recentMaps", "mapInfo"]
      .map((f) => `${f}:data->${f}`)
      .join(",");
    const res = await fetch(`${url}/rest/v1/stats?id=eq.ranked&select=${fields}`, {
      headers: keyHeaders(key),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Partial<StoredStats>[];
    const row = rows[0];
    if (!row) return null;
    return slim({ ...emptyStats(), ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) } as StoredStats);
  } catch {
    return null;
  }
}

/** As últimas cópias diárias do meta, da mais nova para a mais velha. Guarda por 1 hora. */
export async function getMetaHistory(): Promise<MetaDay[]> {
  "use cache";
  cacheLife({ stale: 60 * 10, revalidate: 60 * 60, expire: 60 * 60 * 24 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/meta_history?select=day,overall&order=day.desc&limit=10`, {
      headers: keyHeaders(key),
    });
    return res.ok ? ((await res.json()) as MetaDay[]) : [];
  } catch {
    return [];
  }
}

