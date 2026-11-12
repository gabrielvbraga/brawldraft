"use client";
// TELAS PRINCIPAIS: início, escolha de mapa, meta por mapa, "meus Brawlers" e conta.

import { useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { RANK_BANDS, type Collected } from "@/lib/collector";
import { mapStrength } from "@/lib/engine";
import { className, mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import type { LiveMeta } from "@/lib/livemeta";
import type { MetaDay } from "@/lib/metaChanges";
import { metaChanges } from "@/lib/metaChanges";
import type { RosterItem } from "@/lib/storage";
import type { RecSummary } from "@/lib/supabase";
import type { Brawler, GameMap } from "@/lib/types";
import { upgradeAdvice } from "@/lib/upgrade";
import { UpgradeCard } from "./extras";
import {
  BrawlerGrid,
  CARD,
  H1,
  H2,
  INPUT,
  Icon,
  MODE_COLOR,
  MODE_ORDER,
  MapImage,
  PANEL,
  Pill,
  PrimaryButton,
  SUB,
  SmallButton,
  TIER_COLOR,
  choice,
} from "./ui";

const BY_NAME = new Map(BRAWLERS.map((b) => [b.name, b]));
const fmt = (n: number) => `${n.toFixed(1)}%`;

/** Tabela de Brawlers com % de vitórias e de uso (estilo Clean Pro). */
function RateTable(props: { t: Dict; lang: Lang; rows: { name: string; wins: number; use: number }[] }) {
  const { t, lang } = props;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--faint)]">
            <th className="px-4 py-2 font-semibold">#</th>
            <th className="px-2 py-2 font-semibold">Brawler</th>
            <th className="px-2 py-2 font-semibold">{t.winRate}</th>
            <th className="px-2 py-2 font-semibold">{t.useRate}</th>
            <th className="px-4 py-2 font-semibold">Tier</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => {
            const b = BY_NAME.get(r.name);
            return (
              <tr key={r.name} className="border-t border-[var(--line)]">
                <td className="px-4 py-2.5 font-semibold text-[var(--faint)]">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2.5">
                    {b && <Icon brawler={b} size={34} />}
                    <span>
                      <span className="block font-semibold">{r.name}</span>
                      {b && <span className="block text-[11px] text-[var(--faint)]">{className(lang, b.class)}</span>}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2.5 font-bold text-[var(--good)]">{fmt(r.wins)}</td>
                <td className="px-2 py-2.5 text-[var(--soft)]">{fmt(r.use)}</td>
                <td className="px-4 py-2.5">{b && <Pill bg={TIER_COLOR[b.tier]}>{b.tier}</Pill>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Cartão de mapa com foto grande. */
function MapCard(props: { t: Dict; lang: Lang; map: GameMap; today: boolean; onPick: () => void; height?: number; compact?: boolean }) {
  const { t, lang, map } = props;
  return (
    <div className={`${CARD} flex flex-col overflow-hidden transition hover:border-[var(--accent)]`}>
      <div className="p-2 pb-0">
        <MapImage map={map} height={props.height ?? 210} zoomLabel={t.zoomMap} closeLabel={t.close} />
      </div>
      <button onClick={props.onPick} className="flex flex-1 flex-col gap-1 p-3 text-left">
        <span className="flex items-center gap-2">
          <span className="font-bold">{mapName(lang, map.name)}</span>
          {props.today && !props.compact && <Pill bg="var(--good-bg)" color="var(--good)">{t.todayBadge}</Pill>}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[var(--soft)]">
          <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[map.mode] }} />
          {modeName(lang, map.mode)}
        </span>
        {!props.compact && (
          <span className="text-xs text-[var(--faint)]">
            {t.highlight}: {map.top.slice(0, 3).join(", ")}
          </span>
        )}
      </button>
    </div>
  );
}

// ================= INÍCIO =================

export function Home(props: {
  t: Dict;
  lang: Lang;
  live: LiveMeta;
  metaHistory: MetaDay[];
  battles: number;
  mapCount: number;
  ownedCount: number;
  historyCount: number;
  rotation: Set<number> | null;
  showTrio: boolean;
  loggedIn: boolean;
  recSummary: RecSummary | null;
  onGo: (where: "draft" | "train" | "trio" | "meta" | "history" | "owned" | "account" | "counters" | "quiz" | "leaderboard" | "compare" | "profile") => void;
  onPickMap: (m: GameMap) => void;
}) {
  const { t, lang, live } = props;
  const when = new Date(live.updatedAt).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  const changes = metaChanges(props.metaHistory);
  const today = props.rotation;
  const maps = MODE_ORDER.flatMap((mode) => MAPS.filter((m) => m.mode === mode));
  const shownMaps = today && today.size > 0 ? maps.filter((m) => today.has(m.gameId)) : maps;

  const features = [
    { key: "train" as const, title: t.training, sub: t.trainingSub },
    { key: "counters" as const, title: t.countersTitle, sub: t.countersSub },
    { key: "history" as const, title: `${t.history} (${props.historyCount})`, sub: t.historySub },
    { key: "owned" as const, title: `${t.myBrawlers} (${props.ownedCount})`, sub: t.importTitle },
    { key: "quiz" as const, title: t.quizTitle, sub: t.quizSub },
    { key: "profile" as const, title: t.profile, sub: t.profileSub },
    { key: "compare" as const, title: t.compareTitle, sub: t.compareSub },
  ];

  const [mode, setMode] = useState<string>(() => MODE_ORDER.find((m) => shownMaps.some((x) => x.mode === m)) ?? MODE_ORDER[0]);
  const modeMaps = shownMaps.filter((m) => m.mode === mode);
  const hasChanges = !!changes && (changes.up.length > 0 || changes.down.length > 0);

  return (
    <div className="flex flex-col gap-10">
      {/* ABERTURA + NÚMEROS */}
      <section className="flex flex-wrap items-stretch gap-8">
        <div className="flex flex-[1_1_520px] flex-col justify-center gap-5">
          <span
            className={`flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold ${
              live.saved ? "bg-[var(--warn-bg)] text-[var(--warn)]" : "bg-[var(--good-bg)] text-[var(--good)]"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${live.saved ? "bg-[var(--warn)]" : "bg-[var(--good)]"}`} />
            {live.saved ? t.metaSavedAt(when) : t.metaUpdated(when)}
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{t.heroTitle}</h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--soft)] sm:text-lg">{t.heroSub}</p>
          <div className="flex flex-wrap gap-2.5">
            <PrimaryButton big onClick={() => props.onGo("draft")}>
              {t.liveDraft}
            </PrimaryButton>
            {props.showTrio && <SmallButton onClick={() => props.onGo("trio")}>{t.trio}</SmallButton>}
            <SmallButton onClick={() => props.onGo("train")}>{t.training}</SmallButton>
          </div>
        </div>
        <div className="grid flex-[1_1_360px] grid-cols-2 gap-3">
          {[
            { label: t.statRefresh, value: "12h" },
            { label: t.statBattles, value: props.battles > 0 ? props.battles.toLocaleString(lang === "pt" ? "pt-BR" : "en-US") : "—" },
            { label: t.statBrawlers, value: String(BRAWLERS.length) },
            { label: t.statMaps, value: String(props.mapCount) },
          ].map((s) => (
            <div key={s.label} className={`${CARD} flex flex-col justify-center gap-1 p-5`}>
              <span className="text-sm text-[var(--soft)]">{s.label}</span>
              <span className="text-3xl font-extrabold tracking-tight">{s.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* MAPAS: um modo por vez */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={H2}>{today && today.size ? t.rotationToday : t.rotation}</h2>
            <p className={SUB}>{t.rotationSub}</p>
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {MODE_ORDER.filter((m) => shownMaps.some((x) => x.mode === m)).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`${choice(mode === m)} flex shrink-0 items-center gap-2`}>
              <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[m] }} />
              {modeName(lang, m)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {modeMaps.map((m) => (
            <MapCard key={m.id} t={t} lang={lang} map={m} today={!!today?.has(m.gameId)} onPick={() => props.onPickMap(m)} height={170} compact />
          ))}
        </div>
      </section>

      {/* META (top 5) + O QUE MUDOU */}
      <section className="flex flex-wrap gap-5">
        <div className={`${CARD} flex-[2_1_520px] overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <span className="font-bold">{t.topWinRate}</span>
            <button onClick={() => props.onGo("meta")} className="text-sm font-semibold text-[var(--accent)] hover:underline">
              {t.seeAll}
            </button>
          </div>
          <RateTable t={t} lang={lang} rows={live.overall.slice(0, 5)} />
        </div>
        {hasChanges && changes && (
          <div className={`${CARD} flex-[1_1_280px] p-5`}>
            <h2 className="font-bold">{t.metaMoves}</h2>
            <div className="mt-3 flex flex-col gap-4">
              <MoveList title={t.metaUp} items={changes.up.slice(0, 3).map((m) => `${m.name} +${m.delta.toFixed(1)}%`)} good />
              <MoveList title={t.metaDown} items={changes.down.slice(0, 3).map((m) => `${m.name} ${m.delta.toFixed(1)}%`)} />
            </div>
          </div>
        )}
      </section>

      {/* MAIS FERRAMENTAS (uma linha) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--faint)]">{t.moreTools}</h2>
        <div className="flex flex-wrap gap-2">
          {features.map((f) => (
            <button key={f.key} onClick={() => props.onGo(f.key)} className={`${CARD} px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--accent)]`}>
              {f.title}
            </button>
          ))}
        </div>
      </section>

      {props.showTrio && !props.loggedIn && (
        <section className={`${CARD} flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left`}>
          <p className="flex-1 text-sm">{t.joinCta}</p>
          <PrimaryButton onClick={() => props.onGo("account")}>{t.createAccount}</PrimaryButton>
        </section>
      )}
    </div>
  );
}

function MoveList(props: { title: string; items: string[]; good?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{props.title}</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm">
        {props.items.map((x) => (
          <li key={x} className={props.good ? "text-[var(--good)]" : "text-[var(--bad)]"}>
            {props.good ? "▲" : "▼"} {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ================= ESCOLHA DO MAPA =================

export function MapPicker(props: { t: Dict; lang: Lang; title: string; rotation: Set<number> | null; onPick: (m: GameMap) => void }) {
  const { t, lang } = props;
  const hasRotation = !!props.rotation && props.rotation.size > 0;
  const [onlyToday, setOnlyToday] = useState(true);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = MAPS.filter(
    (m) => (m.name.toLowerCase().includes(q) || mapName(lang, m.name).toLowerCase().includes(q)) && (!hasRotation || !onlyToday || props.rotation?.has(m.gameId)),
  );

  return (
    <div>
      <h1 className={H1}>{props.title}</h1>
      <p className={SUB}>{t.chooseMap}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchMap} className={`${INPUT} max-w-sm`} />
        {hasRotation ? (
          <>
            <button onClick={() => setOnlyToday(true)} className={choice(onlyToday)}>
              {t.rotationToday}
            </button>
            <button onClick={() => setOnlyToday(false)} className={choice(!onlyToday)}>
              {t.rotationAll}
            </button>
          </>
        ) : (
          props.rotation && <span className="text-xs text-[var(--faint)]">{t.rotationNone}</span>
        )}
      </div>

      {MODE_ORDER.map((mode) => {
        const list = filtered.filter((m) => m.mode === mode);
        if (list.length === 0) return null;
        return (
          <section key={mode} className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: MODE_COLOR[mode] }} />
              {modeName(lang, mode)}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <MapCard key={m.id} t={t} lang={lang} map={m} today={!!props.rotation?.has(m.gameId)} onPick={() => props.onPick(m)} />
              ))}
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && <p className={`${SUB} mt-6 text-center`}>{t.noMap}</p>}
    </div>
  );
}

// ================= META POR MAPA =================

const TIERS = ["S+", "S", "A", "B", "C", "D"];

/** Transforma a força no mapa (número) em uma letra de tier. */
function tierOnMap(b: Brawler, map: GameMap): string {
  const s = mapStrength(b, map);
  const v = s.base + s.bonus;
  return v >= 11 ? "S+" : v >= 9.5 ? "S" : v >= 8 ? "A" : v >= 6.5 ? "B" : v >= 5 ? "C" : "D";
}

export function MetaScreen(props: { t: Dict; lang: Lang; live: LiveMeta; collected: Collected | null }) {
  const { t, lang, live } = props;
  const [mapId, setMapId] = useState(0); // 0 = geral
  const [band, setBand] = useState("all");
  const map = MAPS.find((m) => m.id === mapId) ?? null;
  const rows = map ? (live.maps[map.gameId] ?? []) : live.overall;

  // Meta por faixa de Ranked (partidas coletadas, mínimo de 20 por Brawler).
  const bandRows =
    band === "all"
      ? null
      : Object.entries(props.collected?.byRank?.[band] ?? {})
          .filter(([, p]) => p[1] >= 20)
          .map(([id, p]) => ({ b: BRAWLERS.find((x) => x.id === Number(id)), wins: (p[0] / p[1]) * 100, games: Math.round(p[1]) }))
          .filter((x): x is { b: Brawler; wins: number; games: number } => !!x.b)
          .sort((a, b) => b.wins - a.wins);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={H1}>{t.metaPage}</h1>
        <p className={SUB}>{map ? t.metaMapSub : t.metaGeneralSub}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
          {t.mapLabel}
          <select value={mapId} onChange={(e) => setMapId(Number(e.target.value))} className={`${INPUT} min-w-[240px]`}>
            <option value={0}>{t.general}</option>
            {MODE_ORDER.map((mode) => (
              <optgroup key={mode} label={modeName(lang, mode)}>
                {MAPS.filter((m) => m.mode === mode).map((m) => (
                  <option key={m.id} value={m.id}>
                    {mapName(lang, m.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
          {t.levelLabel}
          <select value={band} onChange={(e) => setBand(e.target.value)} className={`${INPUT} min-w-[200px]`}>
            <option value="all">{t.rankAll}</option>
            {RANK_BANDS.map((r) => (
              <option key={r} value={r}>
                {t.rankBand[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {bandRows ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="border-b border-[var(--line)] px-5 py-4">
            <span className="font-bold">{t.rankBand[band]}</span>
            <p className="text-xs text-[var(--soft)]">{t.rankSub}</p>
          </div>
          {bandRows.length === 0 ? (
            <p className={`${SUB} p-5`}>{t.rankFew}</p>
          ) : (
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {bandRows.slice(0, 30).map((x, i) => (
                <div key={x.b.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-2.5">
                  <span className="w-6 text-center text-sm font-semibold text-[var(--faint)]">{i + 1}</span>
                  <Icon brawler={x.b} size={36} />
                  <span className="flex-1 font-semibold">{x.b.name}</span>
                  <span className="text-right">
                    <span className="block font-bold text-[var(--good)]">{fmt(x.wins)}</span>
                    <span className="block text-[10px] text-[var(--faint)]">{x.games}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className={`${CARD} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] px-5 py-4">
              {map && (
                <div className="w-28 shrink-0">
                  <MapImage map={map} height={150} zoomLabel={t.zoomMap} closeLabel={t.close} />
                </div>
              )}
              <div>
                <span className="font-bold">{map ? mapName(lang, map.name) : t.topWinRate}</span>
                <p className="text-xs text-[var(--soft)]">{t.topbrawlNote}</p>
              </div>
            </div>
            {rows.length > 0 ? <RateTable t={t} lang={lang} rows={rows} /> : <p className={`${SUB} p-5`}>{t.noRows}</p>}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className={H2}>{t.tierAll}</h2>
            {TIERS.map((tier) => {
              const list = BRAWLERS.filter((b) => (map ? tierOnMap(b, map) : b.tier) === tier).sort(
                (x, y) => (y.winRate ?? 0) - (x.winRate ?? 0),
              );
              if (list.length === 0) return null;
              return (
                <div key={tier} className={`${PANEL} flex items-stretch overflow-hidden`}>
                  <span className="flex w-14 shrink-0 items-center justify-center text-xl font-extrabold text-[#14171f]" style={{ background: TIER_COLOR[tier] }}>
                    {tier}
                  </span>
                  <div className="flex flex-wrap gap-2 p-2.5">
                    {list.map((b) => (
                      <div key={b.id} className="flex w-14 flex-col items-center" title={b.name}>
                        <Icon brawler={b} size={46} />
                        <span className="w-full truncate text-center text-[10px] font-medium">{b.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

// ================= MEUS BRAWLERS =================

export function OwnedScreen(props: {
  t: Dict;
  owned: number[];
  roster: RosterItem[];
  free6: number[];
  tag: string;
  onToggle: (id: number) => void;
  onAll: (all: boolean) => void;
  onImported: (tag: string, name: string, roster: RosterItem[]) => void;
  onFree6: (ids: number[]) => void;
  onDone: () => void;
  rotation: Set<number> | null;
  comfort: Record<number, number>;
}) {
  const { t, owned, roster, free6 } = props;
  const tips = upgradeAdvice(BRAWLERS, roster, free6, MAPS, props.rotation, props.comfort);
  const [tag, setTag] = useState(props.tag);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const byId = new Map(roster.map((r) => [r.id, r]));
  const p11 = roster.filter((r) => r.power >= 11).length;

  /** Busca os Brawlers do jogador na API oficial (pela nossa rota /api/player). */
  async function importTag() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/player?tag=${encodeURIComponent(tag)}`);
      const data = (await res.json()) as { tag?: string; name?: string; brawlers?: RosterItem[]; error?: string };
      if (!res.ok || !data.brawlers) {
        setMessage({ ok: false, text: t.importErr(data.error ?? "api") });
      } else {
        const known = new Set(BRAWLERS.map((b) => b.id));
        const list = data.brawlers.filter((b) => known.has(b.id));
        props.onImported(data.tag ?? tag, data.name ?? "", list);
        setMessage({ ok: true, text: `${data.name ?? ""}: ${t.p11Count(list.filter((b) => b.power >= 11).length)}` });
      }
    } catch {
      setMessage({ ok: false, text: t.importErr("api") });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className={H1}>{t.myBrawlers}</h1>
        <SmallButton onClick={props.onDone}>{t.done}</SmallButton>
      </div>

      {/* Importar pela tag */}
      <section className={`${CARD} p-5`}>
        <h2 className={H2}>{t.importTitle}</h2>
        <p className="text-xs text-[var(--soft)]">{t.importHelp}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t.tagPlaceholder} className={`${INPUT} max-w-[200px] uppercase`} />
          <PrimaryButton onClick={importTag} disabled={busy || tag.trim() === ""}>
            {busy ? t.importing : t.importButton}
          </PrimaryButton>
        </div>
        {message && <p className={`mt-2 text-sm font-medium ${message.ok ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{message.text}</p>}
        {roster.length > 0 && <p className="mt-3 rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--text)]">{t.rankedRule}</p>}
      </section>

      {/* Os 6 grátis do Ranked */}
      {roster.length > 0 && (
        <section className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={H2}>{t.free6Title}</h2>
            <span className="text-sm font-semibold text-[var(--accent)]">{t.free6Count(free6.length)}</span>
          </div>
          <p className="mb-3 text-xs text-[var(--soft)]">{t.free6Help}</p>
          <BrawlerGrid
            brawlers={BRAWLERS.filter((b) => (byId.get(b.id)?.power ?? 0) < 11)}
            placeholder={t.searchBrawler}
            state={(b: Brawler) => (free6.includes(b.id) ? "on" : "normal")}
            disabled={(b: Brawler) => !free6.includes(b.id) && free6.length >= 6}
            caption={(b: Brawler) => {
              const r = byId.get(b.id);
              return r ? `${t.levelShort} ${r.power}` : "—";
            }}
            onPick={(b: Brawler) => props.onFree6(free6.includes(b.id) ? free6.filter((x) => x !== b.id) : [...free6, b.id])}
          />
        </section>
      )}

      {/* Qual upar pro nível 11 */}
      <UpgradeCard t={t} tips={tips} hasRoster={roster.length > 0} />

      {/* Lista completa */}
      <section>
        <p className="text-sm text-[var(--soft)]">
          {t.ownedHelp(owned.length, BRAWLERS.length)}
          {roster.length > 0 && ` · ${t.p11Count(p11)}`}
        </p>
        <div className="my-3 flex gap-2">
          <SmallButton onClick={() => props.onAll(true)}>{t.markAll}</SmallButton>
          <SmallButton onClick={() => props.onAll(false)}>{t.unmarkAll}</SmallButton>
        </div>
        <BrawlerGrid
          brawlers={BRAWLERS}
          placeholder={t.searchBrawler}
          state={(b: Brawler) => (owned.includes(b.id) ? "on" : "dim")}
          caption={(b: Brawler) => {
            const r = byId.get(b.id);
            return r ? `${t.levelShort} ${r.power} · ${r.trophies}` : null;
          }}
          onPick={(b: Brawler) => props.onToggle(b.id)}
        />
      </section>
    </div>
  );
}

// ================= CONTA =================

export function AccountScreen(props: {
  t: Dict;
  enabled: boolean;
  email: string | null;
  nick: string;
  onLogin: (email: string, password: string, create: boolean) => Promise<string | null>; // devolve erro ou null
  onLogout: () => void;
  onNick: (nick: string) => void;
}) {
  const { t } = props;
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nick, setNick] = useState(props.nick);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const err = await props.onLogin(email.trim(), password, create);
    setBusy(false);
    if (err === "confirm") setMessage({ ok: true, text: t.confirmEmail });
    else if (err) setMessage({ ok: false, text: t.authError(err) });
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className={H1}>{t.account}</h1>
      <p className={`${SUB} mt-1`}>{t.accountSub}</p>

      {!props.enabled ? (
        <p className={`${CARD} mt-4 p-4 text-sm text-[var(--soft)]`}>{t.accountsOff}</p>
      ) : props.email ? (
        <div className={`${CARD} mt-4 flex flex-col gap-3 p-5`}>
          <p className="font-semibold">{t.loggedAs(props.email)}</p>
          <p className="text-sm text-[var(--good)]">{t.synced}</p>
          <label className="mt-2 flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
            {t.nick}
            <input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder={t.nickPlaceholder} className={INPUT} />
          </label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => props.onNick(nick.trim())} disabled={nick.trim().length < 2}>
              {t.saveNick}
            </PrimaryButton>
            <SmallButton onClick={props.onLogout}>{t.logout}</SmallButton>
          </div>
        </div>
      ) : (
        <div className={`${CARD} mt-4 flex flex-col gap-3 p-5`}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} className={INPUT} autoComplete="email" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password}
            className={INPUT}
            autoComplete={create ? "new-password" : "current-password"}
          />
          <PrimaryButton onClick={submit} disabled={busy || !email.includes("@") || password.length < 6}>
            {create ? t.createAccount : t.login}
          </PrimaryButton>
          <button onClick={() => setCreate(!create)} className="text-sm font-semibold text-[var(--accent)] hover:underline">
            {create ? t.haveAccount : t.noAccount}
          </button>
          {message && <p className={`text-sm ${message.ok ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{message.text}</p>}
        </div>
      )}
    </div>
  );
}

// ================= INÍCIO DO DRAFT (mapa + bans + first pick) =================

export type DraftSetupChoice = { bans: boolean; first: "mine" | "enemy" };

export function DraftSetup(props: {
  t: Dict;
  lang: Lang;
  map: GameMap;
  title: string;
  ownedCount: number;
  onlyOwned: boolean;
  tag: string;
  onChangeMap: () => void;
  onEditOwned: () => void;
  onStart: (c: DraftSetupChoice) => void;
}) {
  const { t, lang, map } = props;
  const [bans, setBans] = useState<boolean | null>(null);
  const [first, setFirst] = useState<"mine" | "enemy">("mine");
  const option = (on: boolean) =>
    `w-full rounded-2xl border-2 p-4 text-left transition ${
      on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] hover:border-[var(--faint)]"
    }`;
  const ownedText =
    props.onlyOwned && props.ownedCount > 0
      ? props.tag
        ? t.ownedLine(props.ownedCount, props.tag)
        : t.ownedLineNoTag(props.ownedCount)
      : props.tag
        ? t.ownedAll
        : t.ownedNone;

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{props.title}</p>
      <section className={`${CARD} mt-2 flex flex-col gap-5 p-5 sm:p-6`}>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t.setupTitle}</h1>
          <p className={`${SUB} mt-1`}>{t.setupSub}</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3">
          <div className="w-20 shrink-0">
            <MapImage map={map} height={80} zoomLabel={t.zoomMap} closeLabel={t.close} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">{t.mapLabel}</p>
            <p className="truncate text-lg font-bold">{mapName(lang, map.name)}</p>
            <p className="flex items-center gap-1.5 text-xs text-[var(--soft)]">
              <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[map.mode] }} />
              {modeName(lang, map.mode)}
            </p>
          </div>
          <button onClick={props.onChangeMap} className="px-2 text-sm font-bold text-[var(--accent)] hover:underline">
            {t.swap}
          </button>
        </div>

        <hr className="border-[var(--line)]" />

        <div className="flex flex-col gap-3">
          <div>
            <h2 className={H2}>{t.bansQ}</h2>
            <p className={`${SUB} mt-1`}>{t.bansQSub}</p>
          </div>
          <button onClick={() => setBans(true)} className={option(bans === true)} aria-pressed={bans === true}>
            <span className="block font-bold">{t.bansYes}</span>
            <span className="block text-sm text-[var(--soft)]">{t.bansYesSub}</span>
          </button>
          <button onClick={() => setBans(false)} className={option(bans === false)} aria-pressed={bans === false}>
            <span className="block font-bold">{t.bansNo}</span>
            <span className="block text-sm text-[var(--soft)]">{t.bansNoSub}</span>
          </button>
        </div>

        <hr className="border-[var(--line)]" />

        <div>
          <h2 className="font-bold">{t.firstQ}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setFirst("mine")} className={choice(first === "mine")}>
              {t.myTeam}
            </button>
            <button onClick={() => setFirst("enemy")} className={choice(first === "enemy")}>
              {t.enemy}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--faint)]">{t.firstQSub}</p>
        </div>

        <hr className="border-[var(--line)]" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--soft)]">{ownedText}</p>
          <button onClick={props.onEditOwned} className="text-sm font-bold text-[var(--accent)] hover:underline">
            {t.myBrawlers}
          </button>
        </div>

        <div>
          <button
            onClick={() => bans !== null && props.onStart({ bans, first })}
            disabled={bans === null}
            className="w-full rounded-xl bg-[var(--accent)] px-6 py-3.5 text-base font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:bg-[var(--sunken)] disabled:text-[var(--faint)]"
          >
            {t.startDraft}
          </button>
          {bans === null && <p className="mt-2 text-center text-xs text-[var(--faint)]">{t.startHint}</p>}
        </div>
      </section>
    </div>
  );
}
