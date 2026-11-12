// PERFIL DO JOGADOR PELA API OFICIAL (lado do servidor)

import { scApi } from "./supercell";

type RawBrawler = {
  id?: number;
  power?: number;
  trophies?: number;
  highestTrophies?: number;
  gadgets?: unknown[];
  starPowers?: unknown[];
  gears?: unknown[];
  hyperCharges?: unknown[];
};

type RawPlayer = {
  name?: string;
  nameColor?: string;
  icon?: { id?: number };
  expLevel?: number;
  trophies?: number;
  highestTrophies?: number;
  "3vs3Victories"?: number;
  soloVictories?: number;
  duoVictories?: number;
  club?: { tag?: string; name?: string };
  brawlers?: RawBrawler[];
};

export type PlayerBrawler = {
  id: number;
  power: number;
  trophies: number;
  highestTrophies: number;
  gadgets: number;
  starPowers: number;
  gears: number;
  hypercharges: number;
};

export type Player = {
  tag: string;
  name: string;
  nameColor: string | null;
  iconId: number | null;
  expLevel: number;
  trophies: number;
  highestTrophies: number;
  victories3v3: number;
  soloVictories: number;
  duoVictories: number;
  club: { tag: string; name: string } | null;
  brawlers: PlayerBrawler[];
};

const len = (x: unknown[] | undefined) => (Array.isArray(x) ? x.length : 0);

/** Busca o perfil. Devolve o jogador ou o código do erro ("not-found", "api"). */
export async function fetchPlayer(tag: string): Promise<Player | "not-found" | "api"> {
  const r = await scApi<RawPlayer>(`/players/%23${tag}`);
  if (r.status === 404) return "not-found";
  if (!r.data) return "api";
  const p = r.data;
  // A cor do nome vem como "0xffRRGGBB".
  const color = typeof p.nameColor === "string" && /^0x[0-9a-f]{8}$/i.test(p.nameColor) ? `#${p.nameColor.slice(4)}` : null;
  return {
    tag,
    name: p.name ?? "",
    nameColor: color,
    iconId: typeof p.icon?.id === "number" ? p.icon.id : null,
    expLevel: p.expLevel ?? 0,
    trophies: p.trophies ?? 0,
    highestTrophies: p.highestTrophies ?? 0,
    victories3v3: p["3vs3Victories"] ?? 0,
    soloVictories: p.soloVictories ?? 0,
    duoVictories: p.duoVictories ?? 0,
    club: p.club?.tag && p.club.name ? { tag: p.club.tag, name: p.club.name } : null,
    brawlers: (p.brawlers ?? [])
      .filter((b) => typeof b.id === "number")
      .map((b) => ({
        id: b.id as number,
        power: b.power ?? 1,
        trophies: b.trophies ?? 0,
        highestTrophies: b.highestTrophies ?? b.trophies ?? 0,
        gadgets: len(b.gadgets),
        starPowers: len(b.starPowers),
        gears: len(b.gears),
        hypercharges: len(b.hyperCharges),
      })),
  };
}
