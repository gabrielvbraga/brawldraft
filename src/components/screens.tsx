"use client";
// TELAS MENORES: início, escolha de mapa, meta por mapa, histórico e "meus Brawlers".

import { useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { mapStrength } from "@/lib/engine";
import { modeName, type Dict, type Lang } from "@/lib/i18n";
import { load, save, type HistoryEntry } from "@/lib/storage";
import type { Brawler, GameMap } from "@/lib/types";
import { BrawlerGrid, CARD, INPUT, Icon, MODE_COLOR, MODE_ORDER, MapThumb, PANEL, SmallButton, TIER_COLOR, outline } from "./ui";

// ================= INÍCIO =================

export function Home(props: {
  t: Dict;
  lang: Lang;
  updatedAt: string | null; // quando o meta ao vivo foi lido (null = usando dados salvos)
  ownedCount: number;
  historyCount: number;
  showTrio: boolean; // o draft em trio só aparece com o Supabase configurado
  onGo: (where: "draft" | "train" | "trio" | "meta" | "history" | "owned") => void;
}) {
  const { t } = props;
  const hot = BRAWLERS.filter((b) => b.tier === "S+").concat(BRAWLERS.filter((b) => b.tier === "S"));

  // Os botões das outras áreas do site (o draft ao vivo fica no botão grande de cima).
  const cards = [
    ...(props.showTrio ? [{ key: "trio" as const, title: t.trio, sub: t.trioSub, mark: "👥" }] : []),
    { key: "train" as const, title: t.training, sub: t.trainingSub, mark: "⏱" },
    { key: "meta" as const, title: t.metaPage, sub: t.metaPageSub, mark: "★" },
    { key: "history" as const, title: `${t.history} (${props.historyCount})`, sub: t.historySub, mark: "✓" },
  ];

  return (
    <div>
      {/* Faixa de abertura com o nome do site */}
      <section
        className="relative overflow-hidden rounded-3xl border-2 border-[var(--line)] px-5 py-10 text-center shadow-[0_6px_0_#000]"
        style={{
          background:
            "radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--accent) 38%, transparent), transparent 62%), var(--panel)",
        }}
      >
        {/* Brawlers em alta, grandes e apagados, só como enfeite de fundo */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-between px-2 opacity-25" aria-hidden="true">
          {hot.slice(0, 2).map((b, i) => (
            <div key={b.id} style={{ transform: `rotate(${i === 0 ? -10 : 10}deg) translateY(18px)` }}>
              <Icon brawler={b} size={130} />
            </div>
          ))}
        </div>
        <h1
          className="relative leading-none text-[var(--accent)]"
          style={{ fontSize: "clamp(2.25rem, 12vw, 4.5rem)", textShadow: "0 5px 0 #000, 0 0 6px #000" }}
        >
          BRAWL<span className="text-white">DRAFT</span>
        </h1>
        <p className="relative mt-3 text-lg text-white" style={outline}>
          {t.tagline}
        </p>
        <p className="relative mx-auto mt-1 max-w-sm font-sans text-xs text-[var(--soft)]">{t.liveDraftSub}</p>
        <button
          onClick={() => props.onGo("draft")}
          className="relative mt-6 rounded-2xl border-2 border-black bg-[var(--accent)] px-8 py-3 text-2xl text-black shadow-[0_5px_0_#000] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_1px_0_#000]"
        >
          {t.liveDraft}
        </button>
      </section>

      {/* Botões das áreas do site */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => props.onGo(c.key)}
            className={`${CARD} flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:brightness-125 active:translate-y-0.5`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-[var(--accent)] text-2xl text-black">
              {c.mark}
            </span>
            <span>
              <span className="block text-xl leading-tight text-white">{c.title}</span>
              <span className="block font-sans text-xs text-[var(--soft)]">{c.sub}</span>
            </span>
          </button>
        ))}
      </section>

      {/* Brawlers em alta */}
      <section className={`${PANEL} mt-4 p-3`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg text-white" style={outline}>
            {t.hotNow}
          </h2>
          <SmallButton onClick={() => props.onGo("owned")}>{`${t.myBrawlers} (${props.ownedCount})`}</SmallButton>
        </div>
        <p className="font-sans text-[11px] text-[var(--soft)]">
          {props.updatedAt
            ? t.metaUpdated(new Date(props.updatedAt).toLocaleString(props.lang === "pt" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }))
            : t.metaSaved}
        </p>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {hot.map((b) => (
            <div key={b.id} className="flex shrink-0 flex-col items-center gap-1">
              <Icon brawler={b} size={56} />
              <span className="rounded border border-black px-1 text-[10px] text-black" style={{ background: TIER_COLOR[b.tier] }}>
                {b.tier}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ================= ESCOLHA DO MAPA =================

export function MapPicker(props: { t: Dict; lang: Lang; title: string; onPick: (m: GameMap) => void }) {
  const { t, lang } = props;
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = MAPS.filter((m) => m.name.toLowerCase().includes(q));

  return (
    <div>
      <h1 className="text-3xl text-[var(--accent)]" style={outline}>
        {props.title}
      </h1>
      <p className="text-sm text-[var(--soft)]">{t.chooseMap}</p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchMap} className={`${INPUT} mt-3`} />

      {MODE_ORDER.map((mode) => {
        const list = filtered.filter((m) => m.mode === mode);
        if (list.length === 0) return null;
        return (
          <section key={mode} className="mt-5">
            <h2 className="flex items-center gap-2 text-xl text-white" style={outline}>
              <span className="h-4 w-4 rounded-full border-2 border-black" style={{ background: MODE_COLOR[mode] }} />
              {modeName(lang, mode)}
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((m) => (
                <button
                  key={m.id}
                  onClick={() => props.onPick(m)}
                  className={`${CARD} flex items-center gap-3 border-l-8 px-2 py-2 text-left text-white transition hover:brightness-125 active:translate-y-0.5`}
                  style={{ borderLeftColor: MODE_COLOR[mode] }}
                >
                  <MapThumb map={m} width={40} />
                  <span className="min-w-0">
                    <span className="block text-base leading-tight">{m.name}</span>
                    <span className="block font-sans text-[11px] text-[var(--soft)]">
                      {t.highlight}: {m.top.slice(0, 3).join(", ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && <p className="mt-6 text-center text-[var(--soft)]">{t.noMap}</p>}
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

export function MetaScreen(props: { t: Dict; lang: Lang }) {
  const { t, lang } = props;
  const [mapId, setMapId] = useState(0); // 0 = tier list geral
  const map = MAPS.find((m) => m.id === mapId) ?? null;

  return (
    <div>
      <h1 className="text-3xl text-[var(--accent)]" style={outline}>
        {t.metaPage}
      </h1>
      <select value={mapId} onChange={(e) => setMapId(Number(e.target.value))} className={`${INPUT} mt-3`}>
        <option value={0}>{t.general}</option>
        {MODE_ORDER.map((mode) => (
          <optgroup key={mode} label={modeName(lang, mode)}>
            {MAPS.filter((m) => m.mode === mode).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="mt-2 flex items-center gap-3">
        {map && <MapThumb map={map} width={48} />}
        <p className="font-sans text-xs text-[var(--soft)]">{map ? t.metaMapSub : t.metaGeneralSub}</p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {TIERS.map((tier) => {
          const list = BRAWLERS.filter((b) => (map ? tierOnMap(b, map) : b.tier) === tier);
          if (list.length === 0) return null;
          return (
            <div key={tier} className={`${PANEL} flex items-stretch overflow-hidden`}>
              <span
                className="flex w-14 shrink-0 items-center justify-center border-r-2 border-black text-2xl text-black"
                style={{ background: TIER_COLOR[tier] }}
              >
                {tier}
              </span>
              <div className="flex flex-wrap gap-2 p-2">
                {list.map((b) => (
                  <div key={b.id} className="flex w-14 flex-col items-center" title={b.name}>
                    <Icon brawler={b} size={48} />
                    <span className="w-full truncate text-center text-[10px] text-white">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================= HISTÓRICO =================

/** Agrupa as partidas por uma chave (Brawler ou modo) e conta vitórias. */
function groupStats(history: HistoryEntry[], key: (h: HistoryEntry) => string) {
  const stats = new Map<string, { games: number; wins: number }>();
  for (const h of history) {
    const s = stats.get(key(h)) ?? { games: 0, wins: 0 };
    s.games++;
    if (h.win) s.wins++;
    stats.set(key(h), s);
  }
  return [...stats.entries()].sort((a, b) => b[1].games - a[1].games);
}

const percent = (wins: number, games: number) => (games > 0 ? `${Math.round((wins / games) * 100)}%` : "-");

export function HistoryScreen(props: { t: Dict; lang: Lang; history: HistoryEntry[]; onClear: () => void }) {
  const { t, lang, history } = props;
  const wins = history.filter((h) => h.win).length;
  const byName = new Map(BRAWLERS.map((b) => [b.name, b]));

  return (
    <div>
      <h1 className="text-3xl text-[var(--accent)]" style={outline}>
        {t.history}
      </h1>

      {history.length === 0 ? (
        <p className={`${PANEL} mt-3 p-4 font-sans text-sm text-[var(--soft)]`}>{t.noHistory}</p>
      ) : (
        <div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className={`${CARD} p-3`}>
              <span className="block font-sans text-xs text-[var(--soft)]">{t.games}</span>
              <span className="text-3xl text-white">{history.length}</span>
            </div>
            <div className={`${CARD} p-3`}>
              <span className="block font-sans text-xs text-[var(--soft)]">{t.winRate}</span>
              <span className="text-3xl text-white">{percent(wins, history.length)}</span>
            </div>
          </div>

          <h2 className="mt-4 text-xl text-white" style={outline}>
            {t.byBrawler}
          </h2>
          <div className="mt-2 flex flex-col gap-1">
            {groupStats(history, (h) => h.played).map(([name, s]) => {
              const b = byName.get(name);
              return (
                <div key={name} className={`${PANEL} flex items-center gap-3 px-3 py-2`}>
                  {b && <Icon brawler={b} size={36} />}
                  <span className="flex-1 text-white">{name}</span>
                  <span className="font-sans text-sm text-[var(--soft)]">
                    {s.games} · {percent(s.wins, s.games)}
                  </span>
                </div>
              );
            })}
          </div>

          <h2 className="mt-4 text-xl text-white" style={outline}>
            {t.byMode}
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {groupStats(history, (h) => h.mode).map(([mode, s]) => (
              <div key={mode} className={`${PANEL} px-3 py-2`}>
                <span className="block text-white">{modeName(lang, mode)}</span>
                <span className="font-sans text-sm text-[var(--soft)]">
                  {s.games} · {percent(s.wins, s.games)}
                </span>
              </div>
            ))}
          </div>

          <h2 className="mt-4 text-xl text-white" style={outline}>
            {t.recent}
          </h2>
          <div className="mt-2 flex flex-col gap-1">
            {[...history].reverse().slice(0, 20).map((h) => (
              <div key={h.date} className={`${PANEL} flex items-center gap-3 px-3 py-2`}>
                <span className={`rounded border border-black px-2 text-sm text-black ${h.win ? "bg-green-400" : "bg-red-400"}`}>
                  {h.win ? t.win : t.loss}
                </span>
                <span className="flex-1 text-white">
                  {h.played} <span className="font-sans text-xs text-[var(--soft)]">· {h.map}</span>
                </span>
                <span className="font-sans text-xs text-[var(--soft)]">{h.date.slice(0, 10)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <SmallButton onClick={props.onClear}>{t.clearHistory}</SmallButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= MEUS BRAWLERS =================

export function OwnedScreen(props: {
  t: Dict;
  owned: number[];
  onToggle: (id: number) => void;
  onAll: (all: boolean) => void;
  onSet: (ids: number[]) => void; // troca a lista inteira (usado na importação)
  onDone: () => void;
}) {
  const { t, owned } = props;
  const [tag, setTag] = useState(() => load<string>("bd-tag", ""));
  const [minLevel, setMinLevel] = useState(() => load<number>("bd-min-level", 1));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  /** Busca os Brawlers do jogador na API oficial (pela nossa rota /api/player). */
  async function importTag() {
    setBusy(true);
    setMessage(null);
    save("bd-tag", tag);
    save("bd-min-level", minLevel);
    try {
      const res = await fetch(`/api/player?tag=${encodeURIComponent(tag)}`);
      const data = (await res.json()) as { name?: string; brawlers?: { id: number; power: number }[]; error?: string };
      if (!res.ok || !data.brawlers) {
        setMessage({ ok: false, text: t.importErr(data.error ?? "api") });
      } else {
        const known = new Set(BRAWLERS.map((b) => b.id));
        const ids = data.brawlers.filter((b) => b.power >= minLevel && known.has(b.id)).map((b) => b.id);
        props.onSet(ids);
        setMessage({ ok: true, text: t.importOk(data.name ?? "", ids.length) });
      }
    } catch {
      setMessage({ ok: false, text: t.importErr("api") });
    }
    setBusy(false);
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl text-[var(--accent)]" style={outline}>
          {t.myBrawlers}
        </h1>
        <SmallButton onClick={props.onDone}>{t.done}</SmallButton>
      </div>
      {/* Importar pela tag */}
      <section className={`${PANEL} mt-3 p-3`}>
        <h2 className="text-lg text-white" style={outline}>
          {t.importTitle}
        </h2>
        <p className="font-sans text-xs text-[var(--soft)]">{t.importHelp}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder={t.tagPlaceholder}
            className={`${INPUT} max-w-[180px] uppercase`}
          />
          <label className="flex items-center gap-2 font-sans text-xs text-[var(--soft)]">
            {t.minLevel}
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              className="rounded-lg border-2 border-[var(--line)] bg-[var(--panel)] px-2 py-2 text-white"
            >
              {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || tag.trim() === ""}
            onClick={importTag}
            className="rounded-lg border-2 border-black bg-[var(--accent)] px-4 py-2 text-black disabled:opacity-40"
          >
            {busy ? t.importing : t.importButton}
          </button>
        </div>
        {message && (
          <p className={`mt-2 font-sans text-sm ${message.ok ? "text-green-300" : "text-red-300"}`}>{message.text}</p>
        )}
      </section>

      <p className="mt-3 text-sm text-[var(--soft)]">{t.ownedHelp(owned.length, BRAWLERS.length)}</p>
      <div className="my-3 flex gap-2">
        <SmallButton onClick={() => props.onAll(true)}>{t.markAll}</SmallButton>
        <SmallButton onClick={() => props.onAll(false)}>{t.unmarkAll}</SmallButton>
      </div>
      <BrawlerGrid
        brawlers={BRAWLERS}
        placeholder={t.searchBrawler}
        state={(b: Brawler) => (owned.includes(b.id) ? "on" : "dim")}
        onPick={(b: Brawler) => props.onToggle(b.id)}
      />
    </div>
  );
}
