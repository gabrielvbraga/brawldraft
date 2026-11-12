"use client";
// PERFIL DO JOGADOR (por tag) e COMPARAR DOIS JOGADORES
// O perfil mostra conta, rank do Ranked, partidas recentes, Brawlers e quantas
// pessoas já viram o perfil. Link para compartilhar: /?perfil=TAG

import { useEffect, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { achievements, mergeStats, type SiteStats } from "@/lib/achievements";
import type { RecentSummary } from "@/lib/battlelog";
import { mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import type { Match } from "@/lib/matches";
import type { Player } from "@/lib/player";
import { rankName } from "@/lib/rank";
import { RankBadge } from "./insights";
import { CARD, H1, H2, INPUT, Icon, Pill, PrimaryButton, SUB, SmallButton } from "./ui";

export type ProfileData = {
  player: Player;
  rank: number | null;
  bestRank: number | null;
  stats: SiteStats | null;
  matches: Match[];
  recent: RecentSummary;
  views: { total: number; week: number };
};

const BY_ID = new Map(BRAWLERS.map((b) => [b.id, b]));
const clean = (tag: string) => tag.trim().toUpperCase().replace(/^#/, "").replace(/O/g, "0");
const pct = (w: number, g: number) => (g > 0 ? Math.round((w / g) * 100) : 0);
/** "gemGrab" -> "Gem Grab" (nome do modo como o site usa). */
const modeLabel = (mode: string) => mode.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

async function loadProfile(tag: string, countView: boolean): Promise<ProfileData | string> {
  try {
    const res = await fetch(`/api/profile?tag=${encodeURIComponent(tag)}${countView ? "&view=1" : ""}`, { cache: "no-store" });
    const json = (await res.json()) as ProfileData & { error?: string };
    if (!res.ok || json.error) return json.error ?? "api";
    return json;
  } catch {
    return "api";
  }
}

function PlayerIcon(props: { id: number | null; size: number }) {
  const [broken, setBroken] = useState(false);
  if (props.id === null || broken)
    return <span className="shrink-0 rounded-2xl bg-[var(--accent-soft)]" style={{ width: props.size, height: props.size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.brawlify.com/profile-icons/regular/${props.id}.png`}
      alt=""
      width={props.size}
      height={props.size}
      onError={() => setBroken(true)}
      className="shrink-0 rounded-2xl"
    />
  );
}

function Stat(props: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col justify-center gap-1 p-4`}>
      <span className="text-xs text-[var(--soft)]">{props.label}</span>
      <span className="text-2xl font-extrabold tracking-tight">{props.children}</span>
    </div>
  );
}

// ================= PERFIL =================

export function ProfileScreen(props: {
  t: Dict;
  lang: Lang;
  myTag: string;
  initialTag: string | null;
  onCompare: (tag: string) => void;
  /** Números do site deste aparelho (para o próprio perfil mostrar as conquistas na hora). */
  myStats: SiteStats;
  /** Maior rank que apareceu no seu histórico. */
  myBestRank: number | null;
}) {
  const { t, lang } = props;
  const [input, setInput] = useState(props.initialTag ?? props.myTag ?? "");
  const [data, setData] = useState<ProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [allBrawlers, setAllBrawlers] = useState(false);
  const nf = (n: number) => n.toLocaleString(lang === "pt" ? "pt-BR" : "en-US");

  async function open(tag: string) {
    const c = clean(tag);
    if (!c) return;
    setBusy(true);
    setError(null);
    // A própria pessoa olhando o próprio perfil não conta como visita.
    const r = await loadProfile(c, c !== clean(props.myTag || ""));
    setBusy(false);
    if (typeof r === "string") {
      setError(t.importErr(r));
      return;
    }
    setData(r);
    setInput(`#${c}`);
    window.history.replaceState(null, "", `/?perfil=${c}`);
  }

  useEffect(() => {
    const first = props.initialTag ?? props.myTag;
    if (first) open(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copy() {
    if (!data) return;
    const link = `${window.location.origin}/?perfil=${data.player.tag}`;
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => window.prompt(t.copyProfile, link),
    );
  }

  const p = data?.player;
  const ranked = data?.matches ?? [];
  const rw = ranked.filter((m) => m.done && m.win).length;
  const rl = ranked.filter((m) => m.done && !m.win).length;
  const maxed = p ? p.brawlers.filter((b) => b.power >= 11).length : 0;
  const isMe = !!p && clean(props.myTag || "") === p.tag;
  const bestRank = data
    ? Math.max(data.bestRank ?? -1, data.rank ?? -1, isMe ? (props.myBestRank ?? -1) : -1)
    : -1;
  const ach =
    p && data
      ? achievements(
          lang,
          {
            bestRank: bestRank >= 0 ? bestRank : null,
            trophies: p.trophies,
            brawlers: p.brawlers.length,
            totalBrawlers: BRAWLERS.length,
            maxed,
            bestStreak: data.recent.bestStreak ?? 0,
          },
          isMe ? mergeStats(data.stats ?? {}, props.myStats) : data.stats,
        )
      : [];
  const topBrawlers = p ? [...p.brawlers].sort((a, b) => b.trophies - a.trophies).slice(0, allBrawlers ? 200 : 12) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={H1}>{t.profileTitle}</h1>
        <p className={SUB}>{t.profileSub}</p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          open(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="#TAG" className={`${INPUT} max-w-[14rem] flex-1 uppercase`} aria-label="Tag" />
        <PrimaryButton onClick={() => open(input)} disabled={busy || !input.trim()}>
          {busy ? t.loading : t.profileSearch}
        </PrimaryButton>
        {props.myTag && clean(props.myTag) !== p?.tag && <SmallButton onClick={() => open(props.myTag)}>{t.pMine}</SmallButton>}
      </form>
      {error && <p className="text-sm font-medium text-[var(--bad)]">{error}</p>}

      {p && data && (
        <>
          {/* Cabeçalho */}
          <section className={`${CARD} flex flex-wrap items-center gap-4 p-5`}>
            <PlayerIcon id={p.iconId} size={72} />
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                {p.nameColor && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.nameColor }} />}
                <span className="truncate">{p.name}</span>
              </h2>
              <p className="text-sm text-[var(--soft)]">
                #{p.tag} · {t.levelN(p.expLevel)} · {p.club ? p.club.name : t.noClub}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <SmallButton onClick={copy}>{copied ? t.linkCopied : t.copyProfile}</SmallButton>
                <SmallButton onClick={() => props.onCompare(p.tag)}>{t.pCompare}</SmallButton>
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-right">
              <p className="flex items-center justify-end gap-1.5 text-xs font-semibold text-[var(--accent)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {t.viewsTitle}
              </p>
              <p className="text-3xl font-extrabold text-[var(--accent)]">{nf(data.views.total)}</p>
              <p className="text-xs text-[var(--soft)]">{t.viewsLine(data.views.total, data.views.week)}</p>
            </div>
          </section>

          {/* Números */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t.pRank}>{data.rank !== null ? <RankBadge lang={lang} rank={data.rank} /> : <span className="text-base text-[var(--faint)]">{t.pRankNone}</span>}</Stat>
            <Stat label={t.pBestRank}>{bestRank >= 0 ? <RankBadge lang={lang} rank={bestRank} /> : <span className="text-base text-[var(--faint)]">—</span>}</Stat>
            <Stat label={t.pTrophies}>{nf(p.trophies)}</Stat>
            <Stat label={t.pBest}>{nf(p.highestTrophies)}</Stat>
            <Stat label={t.p3v3}>{nf(p.victories3v3)}</Stat>
            <Stat label={t.pSolo}>{nf(p.soloVictories)}</Stat>
            <Stat label={t.pDuo}>{nf(p.duoVictories)}</Stat>
            <Stat label={t.pBrawlers}>
              {p.brawlers.length}
              <span className="text-base font-semibold text-[var(--faint)]">/{BRAWLERS.length}</span>
            </Stat>
            <Stat label={t.pMaxed}>{maxed}</Stat>
            <Stat label={t.achTitle}>
              {ach.filter((a) => a.done).length}
              <span className="text-base font-semibold text-[var(--faint)]">/{ach.length}</span>
            </Stat>
          </section>

          {/* Conquistas */}
          <section className={`${CARD} p-5`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className={H2}>{t.achTitle}</h2>
              <span className="text-sm text-[var(--soft)]">{t.achCount(ach.filter((a) => a.done).length, ach.length)}</span>
            </div>
            {(["game", "site"] as const).map((g) => (
              <div key={g} className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{g === "game" ? t.achGame : t.achSite}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ach
                    .filter((a) => a.group === g)
                    .sort((x, y) => Number(y.done) - Number(x.done))
                    .map((a) => (
                      <div
                        key={a.id}
                        title={a.how}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${a.done ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] opacity-45 grayscale"}`}
                      >
                        <span className="text-2xl" aria-hidden="true">
                          {a.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{a.name}</span>
                          <span className="block text-[11px] leading-tight text-[var(--soft)]">{a.how}</span>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
            {!isMe && !data.stats && <p className="mt-3 text-xs text-[var(--faint)]">{t.achSiteNote}</p>}
          </section>

          {/* Partidas recentes */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <h2 className="font-bold">{t.pRecent}</h2>
              <p className="text-sm text-[var(--soft)]">{t.pRecentLine(data.recent.wins, data.recent.games, data.recent.trophyChange)}</p>
              <p className="mt-1 text-3xl font-extrabold">{pct(data.recent.wins, data.recent.games)}%</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.recent.modes.slice(0, 6).map(([mode, g, w]) => (
                  <Pill key={mode}>
                    {modeName(lang, modeLabel(mode))} · {g} · {pct(w, g)}%
                  </Pill>
                ))}
              </div>
              {data.recent.mostPlayed.length > 0 && (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{t.pMost}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {data.recent.mostPlayed.map(([id, n]) => {
                      const b = BY_ID.get(id);
                      return b ? (
                        <span key={id} className="flex flex-col items-center gap-1 text-xs">
                          <Icon brawler={b} size={44} />
                          {n}×
                        </span>
                      ) : null;
                    })}
                  </div>
                </>
              )}
            </div>
            <div className={`${CARD} p-5`}>
              <h2 className="font-bold">{t.pRanked}</h2>
              {ranked.length === 0 ? (
                <p className="text-sm text-[var(--soft)]">{t.pRankNone}</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--soft)]">{t.pRankedLine(rw, rl)}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {ranked.slice(0, 6).map((m) => {
                      const b = BY_ID.get(m.played);
                      const map = MAPS.find((x) => x.gameId === m.mapGameId);
                      return (
                        <li key={m.date} className="flex items-center gap-3">
                          <Pill bg={m.win ? "var(--good-bg)" : "var(--bad-bg)"} color={m.win ? "var(--good)" : "var(--bad)"}>
                            {m.win ? t.win : t.loss} {m.rounds[0]}-{m.rounds[1]}
                          </Pill>
                          {b && <Icon brawler={b} size={32} />}
                          <span className="min-w-0 flex-1 truncate text-sm">{map ? mapName(lang, map.name) : m.mapName}</span>
                          {m.rank !== undefined && <span className="text-xs text-[var(--faint)]">{rankName(lang, m.rank)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </section>

          {/* Brawlers */}
          <section className={`${CARD} p-5`}>
            <h2 className={H2}>{t.pTop}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {topBrawlers.map((pb) => {
                const b = BY_ID.get(pb.id);
                if (!b) return null;
                return (
                  <div key={pb.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-2">
                    <Icon brawler={b} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{b.name}</span>
                      <span className="block text-xs text-[var(--soft)]">
                        🏆 {nf(pb.trophies)} · {t.pPower(pb.power)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            {p.brawlers.length > 12 && (
              <div className="mt-3">
                <SmallButton onClick={() => setAllBrawlers(!allBrawlers)}>{allBrawlers ? t.seeLess : t.seeMore}</SmallButton>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ================= COMPARAR =================

type Row = { label: string; get: (d: ProfileData) => number; show?: (d: ProfileData, v: number) => React.ReactNode };

export function CompareScreen(props: { t: Dict; lang: Lang; myTag: string; initialB?: string }) {
  const { t, lang } = props;
  const [tagA, setTagA] = useState(props.myTag);
  const [tagB, setTagB] = useState(props.initialB ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<[ProfileData, ProfileData] | null>(null);
  const nf = (n: number) => n.toLocaleString(lang === "pt" ? "pt-BR" : "en-US");

  async function run(a = tagA, b = tagB) {
    if (!clean(a) || !clean(b)) return;
    setBusy(true);
    setError(null);
    const [x, y] = await Promise.all([loadProfile(clean(a), false), loadProfile(clean(b), false)]);
    setBusy(false);
    if (typeof x === "string" || typeof y === "string") {
      setError(t.importErr(typeof x === "string" ? x : (y as string)));
      return;
    }
    setPair([x, y]);
  }

  useEffect(() => {
    if (props.myTag && props.initialB) run(props.myTag, props.initialB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sum = (d: ProfileData, k: "gadgets" | "starPowers" | "hypercharges") => d.player.brawlers.reduce((s, b) => s + b[k], 0);
  const rankedRate = (d: ProfileData) => {
    const done = d.matches.filter((m) => m.done);
    return done.length ? pct(done.filter((m) => m.win).length, done.length) : -1;
  };
  const rows: Row[] = [
    { label: t.cRank, get: (d) => d.rank ?? -1, show: (_d, v) => (v >= 0 ? <RankBadge lang={lang} rank={v} /> : <span className="text-[var(--faint)]">—</span>) },
    { label: t.pBestRank, get: (d) => Math.max(d.bestRank ?? -1, d.rank ?? -1), show: (_d, v) => (v >= 0 ? <RankBadge lang={lang} rank={v} /> : <span className="text-[var(--faint)]">—</span>) },
    { label: t.pTrophies, get: (d) => d.player.trophies },
    { label: t.pBest, get: (d) => d.player.highestTrophies },
    { label: t.cLevel, get: (d) => d.player.expLevel },
    { label: t.p3v3, get: (d) => d.player.victories3v3 },
    { label: t.cSolo, get: (d) => d.player.soloVictories },
    { label: t.cDuo, get: (d) => d.player.duoVictories },
    { label: t.cBrawlers, get: (d) => d.player.brawlers.length },
    { label: t.pMaxed, get: (d) => d.player.brawlers.filter((b) => b.power >= 11).length },
    { label: t.cGadgets, get: (d) => sum(d, "gadgets") },
    { label: t.cStarPowers, get: (d) => sum(d, "starPowers") },
    { label: t.cHyper, get: (d) => sum(d, "hypercharges") },
    { label: t.cRankedWr, get: rankedRate, show: (_d, v) => (v >= 0 ? `${v}%` : <span className="text-[var(--faint)]">—</span>) },
    { label: t.cRecentWr, get: (d) => pct(d.recent.wins, d.recent.games), show: (_d, v) => `${v}%` },
  ];

  let score: [number, number] = [0, 0];
  let shared: { id: number; a: number; b: number }[] = [];
  if (pair) {
    for (const r of rows) {
      const [a, b] = pair.map(r.get);
      if (a > b) score = [score[0] + 1, score[1]];
      else if (b > a) score = [score[0], score[1] + 1];
    }
    const mapB = new Map(pair[1].player.brawlers.map((x) => [x.id, x.trophies]));
    shared = pair[0].player.brawlers
      .filter((x) => mapB.has(x.id))
      .map((x) => ({ id: x.id, a: x.trophies, b: mapB.get(x.id) as number }))
      .sort((x, y) => y.a + y.b - (x.a + x.b))
      .slice(0, 12);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={H1}>{t.compareTitle}</h1>
        <p className={SUB}>{t.compareSub}</p>
      </div>
      <form
        className={`${CARD} flex flex-wrap items-end gap-3 p-5`}
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
          {t.tagA}
          <input value={tagA} onChange={(e) => setTagA(e.target.value)} placeholder={t.tagPlaceholder} className={`${INPUT} w-48 uppercase`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
          {t.tagB}
          <input value={tagB} onChange={(e) => setTagB(e.target.value)} placeholder={t.tagPlaceholder} className={`${INPUT} w-48 uppercase`} />
        </label>
        <PrimaryButton onClick={() => run()} disabled={busy || !tagA.trim() || !tagB.trim()}>
          {busy ? t.loading : t.compareBtn}
        </PrimaryButton>
      </form>
      {error && <p className="text-sm font-medium text-[var(--bad)]">{error}</p>}

      {pair && (
        <>
          {/* Os dois, lado a lado, com o placar de quem ganha mais itens */}
          <section className="grid grid-cols-2 gap-3">
            {pair.map((d, i) => (
              <div key={d.player.tag} className={`${CARD} flex flex-col items-center gap-2 p-4 text-center ${score[i] > score[1 - i] ? "ring-2 ring-[var(--good)]" : ""}`}>
                <PlayerIcon id={d.player.iconId} size={56} />
                <span className="w-full truncate text-lg font-extrabold">{d.player.name}</span>
                <span className="text-xs text-[var(--faint)]">#{d.player.tag}</span>
                <span className="text-sm font-semibold text-[var(--soft)]">{t.cWins(d.player.name, score[i], rows.length)}</span>
              </div>
            ))}
          </section>

          <section className={`${CARD} overflow-x-auto`}>
            <table className="w-full min-w-[420px] text-sm">
              <tbody>
                {rows.map((r) => {
                  const vals = pair.map(r.get);
                  return (
                    <tr key={r.label} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-5 py-3 text-[var(--soft)]">{r.label}</td>
                      {pair.map((d, i) => {
                        const win = vals[i] > vals[1 - i];
                        return (
                          <td key={i} className={`px-3 py-3 text-right font-bold ${win ? "text-[var(--good)]" : ""}`}>
                            {r.show ? r.show(d, vals[i]) : nf(vals[i])}
                            {win && " ▲"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {shared.length > 0 && (
            <section className={`${CARD} p-5`}>
              <h2 className="font-bold">{t.cTopShared}</h2>
              <div className="mt-3 grid grid-cols-[40px_1fr_1fr] gap-3 text-xs font-semibold text-[var(--faint)]">
                <span />
                <span className="truncate">{pair[0].player.name}</span>
                <span className="truncate">{pair[1].player.name}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {shared.map((s) => {
                  const b = BY_ID.get(s.id);
                  if (!b) return null;
                  const max = Math.max(s.a, s.b, 1);
                  return (
                    <li key={s.id} className="grid grid-cols-[40px_1fr_1fr] items-center gap-3">
                      <Icon brawler={b} size={36} />
                      {[s.a, s.b].map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-[var(--sunken)]">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${(v / max) * 100}%`, background: v >= [s.a, s.b][1 - i] ? "var(--accent)" : "var(--faint)" }}
                            />
                          </div>
                          <span className={`w-14 text-right text-xs font-bold ${v > [s.a, s.b][1 - i] ? "text-[var(--accent)]" : "text-[var(--soft)]"}`}>{nf(v)}</span>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
