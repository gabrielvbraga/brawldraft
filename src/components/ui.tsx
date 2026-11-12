"use client";
// PEÇAS DE TELA usadas em várias páginas: moldura (topo, menu, rodapé), botões,
// ícones, miniaturas de mapa e cores. Visual "Clean Pro": claro, limpo, uma cor de destaque.

import { useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Brawler, GameMap } from "@/lib/types";

// ----- Cores -----
// O site tem modo claro e escuro, e uma cor de destaque à escolha.
// Tudo usa estas "variáveis" (var(--nome)), então trocar aqui muda o site inteiro.
export const MODES = {
  claro: { bg: "#f6f7f9", panel: "#ffffff", raised: "#ffffff", sunken: "#f1f3f6", line: "#e3e6ec", text: "#14171f", soft: "#5b6272", faint: "#8a91a1", good: "#146c3c", goodBg: "#e8f6ee", bad: "#b42318", badBg: "#fdecea", warn: "#8a5a00", warnBg: "#fff4d6" },
  escuro: { bg: "#0d1016", panel: "#151922", raised: "#1a1f2a", sunken: "#11151c", line: "#262c38", text: "#eef1f6", soft: "#a3abbc", faint: "#7c8597", good: "#5fd394", goodBg: "#12301f", bad: "#ff8a80", badBg: "#3a1614", warn: "#ffd27a", warnBg: "#3a2c0d" },
};
export type ModeName = keyof typeof MODES;

// Cor de destaque: azul, fixa no site inteiro.
const ACCENT = { accent: "#2457d6", soft: "#eef2fc", softDark: "#1b2847" };

// Cor de cada modo de jogo.
export const MODE_COLOR: Record<string, string> = {
  "Gem Grab": "#9b51e0",
  "Brawl Ball": "#2f80ed",
  Heist: "#e2479b",
  "Hot Zone": "#e5533c",
  Bounty: "#14a394",
  Knockout: "#e98a24",
};
export const MODE_ORDER = ["Gem Grab", "Brawl Ball", "Heist", "Hot Zone", "Bounty", "Knockout"];

// Cor de fundo de cada tier (com texto escuro por cima, para ler bem).
export const TIER_COLOR: Record<string, string> = {
  "S+": "#ffc9c9",
  S: "#ffe0b8",
  A: "#fff1b0",
  B: "#d8f3d0",
  C: "#d6e6ff",
  D: "#e6e8ee",
};

// Classes prontas, para não repetir a mesma lista enorme em todo lugar.
export const PANEL = "rounded-2xl border border-[var(--line)] bg-[var(--panel)]";
export const CARD = "rounded-2xl border border-[var(--line)] bg-[var(--raised)]";
export const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]";
export const H1 = "text-3xl font-extrabold tracking-tight text-[var(--text)]";
export const H2 = "text-xl font-bold tracking-tight text-[var(--text)]";
export const SUB = "text-sm text-[var(--soft)]";

/** LOGO: quadrado arredondado na cor de destaque com "BD", e o nome ao lado. */
export function Logo(props: { size?: number; withName?: boolean }) {
  const size = props.size ?? 32;
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center font-extrabold text-white"
        style={{ width: size, height: size, borderRadius: size * 0.28, background: "var(--accent)", fontSize: size * 0.42 }}
      >
        BD
      </span>
      {props.withName !== false && (
        <span className="text-[19px] font-extrabold tracking-tight text-[var(--text)]">BrawlDraft</span>
      )}
    </span>
  );
}

export type NavKey =
  | "home"
  | "draft"
  | "train"
  | "meta"
  | "counters"
  | "history"
  | "owned"
  | "quiz"
  | "leaderboard"
  | "compare"
  | "profile"
  | "daily"
  | "duel"
  | "admin";

/** Moldura de todas as páginas: barra do topo, menu, configurações, conta e rodapé. */
export function Shell(props: {
  t: Dict;
  mode: ModeName;
  lang: Lang;
  current: NavKey;
  account: string | null; // apelido ou e-mail de quem está logado, ou null
  isAdmin: boolean;
  onMode: (m: ModeName) => void;
  onLang: (l: Lang) => void;
  onNav: (where: NavKey) => void;
  onAccount: () => void;
  children: React.ReactNode;
}) {
  const { t } = props;
  const [menu, setMenu] = useState<"settings" | "more" | null>(null);
  const m = MODES[props.mode] ?? MODES.claro;
  const a = ACCENT;
  const vars = {
    "--bg": m.bg,
    "--panel": m.panel,
    "--raised": m.raised,
    "--sunken": m.sunken,
    "--line": m.line,
    "--text": m.text,
    "--soft": m.soft,
    "--faint": m.faint,
    "--good": m.good,
    "--good-bg": m.goodBg,
    "--bad": m.bad,
    "--bad-bg": m.badBg,
    "--warn": m.warn,
    "--warn-bg": m.warnBg,
    "--accent": a.accent,
    "--accent-soft": props.mode === "escuro" ? a.softDark : a.soft,
    background: m.bg,
    colorScheme: props.mode === "escuro" ? "dark" : "light",
  } as React.CSSProperties;

  const main: { key: NavKey; label: string }[] = [
    { key: "draft", label: t.liveDraft },
    { key: "train", label: t.training },
    { key: "meta", label: t.metaPage },
    { key: "counters", label: t.navCounters },
    { key: "history", label: t.history },
  ];
  const more: { key: NavKey; label: string }[] = [
    { key: "profile", label: t.profile },
    { key: "duel", label: t.duelTitle },
    { key: "daily", label: t.dailyTitle },
    { key: "owned", label: t.myBrawlers },
    { key: "quiz", label: t.quiz },
    { key: "leaderboard", label: t.leaderboard },
    { key: "compare", label: t.compare },
    ...(props.isAdmin ? [{ key: "admin" as NavKey, label: t.admin }] : []),
  ];
  const go = (k: NavKey) => {
    setMenu(null);
    props.onNav(k);
  };
  const navClass = (on: boolean) =>
    `shrink-0 rounded-lg px-3 py-2 text-sm transition ${
      on ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "font-medium text-[var(--soft)] hover:text-[var(--text)]"
    }`;
  const linkClass = (k: NavKey) => navClass(props.current === k);

  return (
    <main className="min-h-screen font-sans text-[var(--text)]" style={vars}>
      {/* BARRA DO TOPO */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => go("home")} aria-label={t.home}>
            <Logo />
          </button>
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {main.map((l) => (
              <button key={l.key} onClick={() => go(l.key)} className={linkClass(l.key)}>
                {l.label}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "more" ? null : "more")}
                className={navClass(more.some((x) => x.key === props.current))}
                aria-expanded={menu === "more"}
              >
                {t.navMore} ▾
              </button>
              {menu === "more" && (
                <div className={`${PANEL} absolute left-0 top-11 w-52 p-1.5 shadow-lg`}>
                  {more.map((l) => (
                    <button key={l.key} onClick={() => go(l.key)} className={`${linkClass(l.key)} block w-full text-left`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={props.onAccount}
              className="max-w-[170px] truncate rounded-xl bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90"
            >
              {props.account ?? t.signIn}
            </button>
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "settings" ? null : "settings")}
                aria-label={t.settings}
                aria-expanded={menu === "settings"}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--soft)] transition hover:text-[var(--text)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
              </button>
              {menu === "settings" && (
                <div className={`${PANEL} absolute right-0 top-12 w-64 p-4 shadow-lg`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{t.language}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["pt", "en"] as Lang[]).map((l) => (
                      <button key={l} onClick={() => props.onLang(l)} className={choice(props.lang === l)}>
                        {l === "pt" ? "Português" : "English"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{t.theme}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(Object.keys(MODES) as ModeName[]).map((k) => (
                      <button key={k} onClick={() => props.onMode(k)} className={choice(props.mode === k)}>
                        {k === "claro" ? t.themeLight : t.themeDark}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Menu no celular e em telas médias: uma linha que rola para o lado */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {[...main, ...more].map((l) => (
            <button key={l.key} onClick={() => go(l.key)} className={linkClass(l.key)}>
              {l.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8" onClick={() => menu && setMenu(null)}>
        {props.children}
      </div>

      {/* RODAPÉ */}
      <footer className="border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center">
          <p className="text-sm text-[var(--soft)]">
            {t.madeBy} <strong className="text-[var(--text)]">Gabriel</strong>
          </p>
          <p className="max-w-xl text-[11px] leading-snug text-[var(--faint)]">{t.disclaimer}</p>
        </div>
      </footer>
    </main>
  );
}

/** Classe de um botão de escolha (marcado ou não). */
export function choice(on: boolean) {
  return `rounded-lg border px-3 py-2 text-sm font-medium transition ${
    on ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text)] hover:border-[var(--faint)]"
  }`;
}

/** Botão principal (cheio, na cor de destaque). */
export function PrimaryButton(props: { onClick: () => void; children: React.ReactNode; disabled?: boolean; big?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-xl bg-[var(--accent)] font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 ${
        props.big ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm"
      }`}
    >
      {props.children}
    </button>
  );
}

/** Botão secundário (contorno). */
export function SmallButton(props: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--faint)] active:scale-[0.98] disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

/** Etiqueta pequena colorida (tier, "Hoje", "auto"...). */
export function Pill(props: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-none"
      style={{ background: props.bg ?? "var(--accent-soft)", color: props.color ?? "#14171f" }}
    >
      {props.children}
    </span>
  );
}

/** Ícone do Brawler. Se a imagem falhar, mostra as iniciais do nome. */
export function Icon(props: { brawler: Brawler; size: number }) {
  const { brawler, size } = props;
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null); // imagem que falhou
  if (brawler.imageUrl && brawler.imageUrl !== brokenUrl) {
    const url = brawler.imageUrl;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={brawler.name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBrokenUrl(url)}
        className="shrink-0 rounded-xl bg-[var(--sunken)]"
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-bold text-[var(--accent)]"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {brawler.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/**
 * Foto do mapa (vista de cima). Ocupa a largura do espaço onde está, na altura pedida.
 * Tocar abre a foto grande (zoom).
 */
export function MapImage(props: { map: GameMap; height: number; zoomLabel: string; closeLabel: string; rounded?: string }) {
  const { map, height } = props;
  const [broken, setBroken] = useState(false);
  const [zoom, setZoom] = useState(false);
  const box = `${props.rounded ?? "rounded-xl"} w-full overflow-hidden bg-[var(--sunken)]`;
  if (!map.imageUrl || broken) {
    return <div className={box} style={{ height, background: `linear-gradient(160deg, ${MODE_COLOR[map.mode] ?? "#888"}33, transparent)` }} />;
  }
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // não deixa o toque abrir o draft do cartão
          setZoom(true);
        }}
        className={`${box} block cursor-zoom-in`}
        style={{ height }}
        aria-label={`${props.zoomLabel}: ${map.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={map.imageUrl}
          alt={map.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      </button>
      {zoom && (
        <div
          role="dialog"
          aria-label={map.name}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setZoom(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={map.imageUrl} alt={map.name} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">{props.closeLabel}</button>
        </div>
      )}
    </>
  );
}

/** Uma faixa (banidos, meu time ou inimigos) com seus espaços. */
export function Strip(props: {
  title: string;
  color: string;
  ids: number[];
  size: number;
  active: boolean;
  byId: Map<number, Brawler>;
  onSelect?: () => void;
  onRemove?: (id: number) => void;
}) {
  const slots = Array.from({ length: props.size }, (_, i) => props.ids[i] ?? null);
  return (
    <div
      onClick={props.onSelect}
      className={`rounded-2xl border p-3 transition ${props.onSelect ? "cursor-pointer" : ""} ${
        props.active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--panel)]"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--soft)]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: props.color }} />
        {props.title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((id, i) => {
          const b = id !== null ? props.byId.get(id) : undefined;
          if (!b) return <span key={i} className="h-11 w-11 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)]" />;
          const remove = props.onRemove;
          if (!remove) return <Icon key={i} brawler={b} size={44} />;
          return (
            <button
              key={i}
              title={b.name}
              onClick={(e) => {
                e.stopPropagation(); // não deixa o clique "vazar" para a faixa
                remove(b.id);
              }}
            >
              <Icon brawler={b} size={44} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Uma linha do detalhe da nota. */
export function Part(props: { label: string; value: number }) {
  const v = props.value;
  const text = `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
  return (
    <span>
      {props.label}: <span className={`font-semibold ${v < 0 ? "text-[var(--bad)]" : "text-[var(--good)]"}`}>{text}</span>
    </span>
  );
}

/** Grade de Brawlers tocáveis, com busca. Usada no draft, em "Meus Brawlers" e nas ferramentas. */
export function BrawlerGrid(props: {
  brawlers: Brawler[];
  placeholder: string;
  /** Devolve como o botão deve aparecer: normal, apagado ou destacado. */
  state: (b: Brawler) => "normal" | "dim" | "on";
  disabled?: (b: Brawler) => boolean;
  /** Texto pequeno embaixo do nome (nível, troféus...). */
  caption?: (b: Brawler) => string | null;
  onPick: (b: Brawler) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const list = props.brawlers.filter((b) => b.name.toLowerCase().includes(q));
  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={props.placeholder} className={INPUT} />
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {list.map((b) => {
          const st = props.state(b);
          const cap = props.caption?.(b);
          return (
            <button
              key={b.id}
              disabled={props.disabled?.(b) ?? false}
              onClick={() => {
                props.onPick(b);
                setSearch("");
              }}
              title={b.name}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                st === "on" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--panel)]"
              } ${st === "dim" ? "opacity-30" : "hover:border-[var(--accent)] active:scale-95"}`}
            >
              <Icon brawler={b} size={52} />
              <span className="w-full truncate text-center text-[11px] font-medium text-[var(--text)]">{b.name}</span>
              {cap && <span className="text-[10px] text-[var(--faint)]">{cap}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
