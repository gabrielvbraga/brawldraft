"use client";
// TELAS MENORES: início, escolha de mapa, meta por mapa, histórico e "meus Brawlers".

import { useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { mapStrength } from "@/lib/engine";
import { className, modeName, type Dict, type Lang } from "@/lib/i18n";
import { load, save, type HistoryEntry } from "@/lib/storage";
import type { Brawler, GameMap } from "@/lib/types";
import { BrawlerGrid, CARD, INPUT, Icon, Logo, MODE_COLOR, MODE_ORDER, MapThumb, PANEL, PrimaryButton, SmallButton, TIER_COLOR, outline } from "./ui";

// ================= INÍCIO =================

export function Home(props: {
  t: Dict;
  lang: Lang;
  updatedAt: string | null; // quando o meta ao vivo foi lido (null = usando dados salvos)
  battles: number; // partidas analisadas pelo coletor
  ownedCount: number;
  historyCount: number;
  showTrio: boolean; // o draft em trio só aparece com o Supabase configurado
  loggedIn: boolean;
  onGo: (where: "draft" | "train" | "trio" | "meta" | "history" | "owned" | "account") => void;
  onPickMap: (m: GameMap) => void;
}) {
  const { t, lang } = props;
  // Ranking por % de vitórias (quem tem o dado ao vivo); sem dado ao vivo, pelo tier.
  const withRate = BRAWLERS.filter((b) => typeof b.winRate === "number").sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  const top = (withRate.length > 0 ? withRate : BRAWLERS.filter((b) => b.tier === "S+" || b.tier === "S")).slice(0, 6);
  const maxRate = Math.max(...top.map((b) => b.winRate ?? 0), 1);

  const features = [
    ...(props.showTrio ? [{ key: "trio" as const, title: t.trio, sub: t.trioSub, icon: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.3c.6-.2 1.3-.3 2-.3 3.3 0 6 2 6 5" }] : []),
    { key: "train" as const, title: t.training, sub: t.trainingSub, icon: "M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12v4l2.5 2.5M9 2h6" },
    { key: "meta" as const, title: t.metaPage, sub: t.metaPageSub, icon: "M4 20V10m6 10V4m6 16v-7m6 7V8" },
    { key: "history" as const, title: `${t.history} (${props.historyCount})`, sub: t.historySub, icon: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 3" },
    { key: "owned" as const, title: `${t.myBrawlers} (${props.ownedCount})`, sub: t.importTitle, icon: "M12 3 4 7v6c0 4.4 3.4 7.5 8 8.5 4.6-1 8-4.1 8-8.5V7l-8-4Z" },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* ABERTURA */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-6 py-12 text-center sm:py-16">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2))" }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center">
          <span className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-black/30 px-3 py-1 text-xs text-[var(--soft)]">
            <span className={`h-2 w-2 rounded-full ${props.updatedAt ? "bg-green-400" : "bg-yellow-400"}`} />
            {props.updatedAt ? t.liveBadge : t.savedBadge}
          </span>
          <div className="mt-5">
            <Logo size={64} withName={false} />
          </div>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-white sm:text-5xl" style={outline}>
            {t.heroTitle}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-[var(--soft)] sm:text-base">{t.heroSub}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <PrimaryButton big onClick={() => props.onGo("draft")}>
              {t.liveDraft}
            </PrimaryButton>
            {props.showTrio && <SmallButton onClick={() => props.onGo("trio")}>{t.trio}</SmallButton>}
            <SmallButton onClick={() => props.onGo("train")}>{t.training}</SmallButton>
          </div>
          <p className="mt-6 text-[11px] text-[var(--soft)]">
            {props.updatedAt
              ? t.metaUpdated(
                  new Date(props.updatedAt).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  }),
                )
              : t.metaSaved}
          </p>
        </div>
      </section>

      {/* NÚMEROS */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { n: BRAWLERS.length, label: t.statBrawlers },
          { n: MAPS.length, label: t.statMaps },
          { n: props.battles, label: t.statBattles },
        ].map((x) => (
          <div key={x.label} className={`${PANEL} px-3 py-4 text-center`}>
            <span className="block font-display text-3xl text-[var(--accent)]">{x.n > 0 ? x.n.toLocaleString(lang === "pt" ? "pt-BR" : "en-US") : "—"}</span>
            <span className="text-xs text-[var(--soft)]">{x.label}</span>
          </div>
        ))}
      </section>

      {/* MAIORES % DE VITÓRIAS */}
      <section>
        <h2 className="font-display text-2xl text-white">{t.topWinRate}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((b, i) => (
            <div key={b.id} className={`${CARD} flex items-center gap-3 p-3`}>
              <span className="w-5 text-center font-display text-lg text-[var(--soft)]">{i + 1}</span>
              <Icon brawler={b} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-lg text-white">{b.name}</span>
                  <span className="rounded-md px-1.5 text-xs font-bold text-black" style={{ background: TIER_COLOR[b.tier] }}>
                    {b.tier}
                  </span>
                </div>
                {typeof b.winRate === "number" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(b.winRate / maxRate) * 100}%`, background: "linear-gradient(90deg, var(--accent), var(--accent2))" }}
                      />
                    </div>
                    <span className="text-xs text-[var(--soft)]">
                      {b.winRate.toFixed(1)}% {t.winRateShort}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--soft)]">{className(lang, b.class)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MAPAS DA ROTAÇÃO */}
      <section>
        <h2 className="font-display text-2xl text-white">{t.rotation}</h2>
        <p className="text-sm text-[var(--soft)]">{t.rotationSub}</p>
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-2">
          {MODE_ORDER.flatMap((mode) => MAPS.filter((m) => m.mode === mode)).map((m) => (
            <button
              key={m.id}
              onClick={() => props.onPickMap(m)}
              className={`${CARD} flex w-36 shrink-0 flex-col items-center gap-2 p-3 text-center transition hover:border-[var(--accent)]`}
            >
              <MapThumb map={m} width={64} />
              <span className="font-display text-sm leading-tight text-white">{m.name}</span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--soft)]">
                <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[m.mode] }} />
                {modeName(lang, m.mode)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ÁREAS DO SITE */}
      <section className="grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <button
            key={f.key}
            onClick={() => props.onGo(f.key)}
            className={`${CARD} group flex items-center gap-4 p-4 text-left transition hover:border-[var(--accent)]`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--accent)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={f.icon} />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg text-white">{f.title}</span>
              <span className="block text-xs text-[var(--soft)]">{f.sub}</span>
            </span>
            <span className="ml-auto text-[var(--soft)] transition group-hover:translate-x-1 group-hover:text-[var(--accent)]">›</span>
          </button>
        ))}
      </section>

      {/* COMO FUNCIONA */}
      <section>
        <h2 className="font-display text-2xl text-white">{t.howTitle}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            [t.how1, t.how1Sub],
            [t.how2, t.how2Sub],
            [t.how3, t.how3Sub],
          ].map(([title, sub], i) => (
            <div key={title} className={`${PANEL} p-4`}>
              <span className="font-display text-3xl text-[var(--accent)]">{i + 1}</span>
              <span className="mt-1 block font-display text-lg text-white">{title}</span>
              <span className="text-sm text-[var(--soft)]">{sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CONVITE PARA CRIAR CONTA */}
      {props.showTrio && !props.loggedIn && (
        <section className={`${CARD} flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left`}>
          <p className="flex-1 text-sm text-white">{t.joinCta}</p>
          <PrimaryButton onClick={() => props.onGo("account")}>{t.createAccount}</PrimaryButton>
        </section>
      )}
    </div>
  );
}

// ================= CONTA =================

export function AccountScreen(props: {
  t: Dict;
  enabled: boolean;
  email: string | null;
  onLogin: (email: string, password: string, create: boolean) => Promise<string | null>; // devolve erro ou null
  onLogout: () => void;
}) {
  const { t } = props;
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <h1 className="font-display text-3xl text-white">{t.account}</h1>
      <p className="mt-1 text-sm text-[var(--soft)]">{t.accountSub}</p>

      {!props.enabled ? (
        <p className={`${PANEL} mt-4 p-4 text-sm text-[var(--soft)]`}>{t.accountsOff}</p>
      ) : props.email ? (
        <div className={`${CARD} mt-4 p-5`}>
          <p className="text-white">{t.loggedAs(props.email)}</p>
          <p className="mt-1 text-sm text-green-300">{t.synced}</p>
          <div className="mt-4">
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
          <button onClick={() => setCreate(!create)} className="text-sm text-[var(--accent)] hover:underline">
            {create ? t.haveAccount : t.noAccount}
          </button>
          {message && <p className={`text-sm ${message.ok ? "text-green-300" : "text-red-300"}`}>{message.text}</p>}
        </div>
      )}
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
      <h1 className="font-display text-3xl text-white">
        {props.title}
      </h1>
      <p className="text-sm text-[var(--soft)]">{t.chooseMap}</p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchMap} className={`${INPUT} mt-3`} />

      {MODE_ORDER.map((mode) => {
        const list = filtered.filter((m) => m.mode === mode);
        if (list.length === 0) return null;
        return (
          <section key={mode} className="mt-5">
            <h2 className="flex items-center gap-2 font-display text-xl text-white">
              <span className="h-3 w-3 rounded-full" style={{ background: MODE_COLOR[mode] }} />
              {modeName(lang, mode)}
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((m) => (
                <button
                  key={m.id}
                  onClick={() => props.onPick(m)}
                  className={`${CARD} flex items-center gap-3 border-l-4 px-2 py-2 text-left text-white transition hover:border-[var(--accent)] active:scale-[0.99]`}
                  style={{ borderLeftColor: MODE_COLOR[mode] }}
                >
                  <MapThumb map={m} width={40} />
                  <span className="min-w-0">
                    <span className="block font-display text-base leading-tight">{m.name}</span>
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
      <h1 className="font-display text-3xl text-white">
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
          // Dentro de cada tier, quem tem mais % de vitórias vem primeiro.
          const list = BRAWLERS.filter((b) => (map ? tierOnMap(b, map) : b.tier) === tier).sort(
            (x, y) => (y.winRate ?? 0) - (x.winRate ?? 0),
          );
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
                    {!map && typeof b.winRate === "number" && (
                      <span className="text-[10px] text-[var(--accent)]">{b.winRate.toFixed(1)}%</span>
                    )}
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
      <h1 className="font-display text-3xl text-white">
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

          <h2 className="mt-6 font-display text-xl text-white">
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

          <h2 className="mt-6 font-display text-xl text-white">
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

          <h2 className="mt-6 font-display text-xl text-white">
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
        <h1 className="font-display text-3xl text-white">
          {t.myBrawlers}
        </h1>
        <SmallButton onClick={props.onDone}>{t.done}</SmallButton>
      </div>
      {/* Importar pela tag */}
      <section className={`${PANEL} mt-3 p-3`}>
        <h2 className="font-display text-lg text-white">
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
            className="rounded-lg font-display bg-[var(--accent)] px-4 py-2 text-black disabled:opacity-40"
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
