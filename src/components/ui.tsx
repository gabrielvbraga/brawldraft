"use client";
// PEÇAS DE TELA usadas em várias páginas: moldura, botões, ícones e cores.

import { useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Brawler, GameMap } from "@/lib/types";

// ----- Temas de cor. O padrão é "ouro". Para criar outro, copie uma linha e troque as cores. -----
export const THEMES = {
  ouro: { bg1: "#07080b", bg2: "#10121a", panel: "#12141c", raised: "#191c27", line: "#272b3a", accent: "#f2c14e", accent2: "#ff8f3f", soft: "#a3aac0" },
  ametista: { bg1: "#08070d", bg2: "#140f22", panel: "#14111f", raised: "#1c1730", line: "#2e2648", accent: "#b794ff", accent2: "#ff7ac6", soft: "#b2a9cc" },
  oceano: { bg1: "#05090d", bg2: "#0b1720", panel: "#0e161e", raised: "#14202b", line: "#22323f", accent: "#4fd1ff", accent2: "#7cf2c4", soft: "#9fb3c2" },
  rubi: { bg1: "#0a0607", bg2: "#1a0d10", panel: "#170f12", raised: "#21151a", line: "#3a2329", accent: "#ff5c6c", accent2: "#ffb04f", soft: "#c4a8ae" },
};
export type ThemeName = keyof typeof THEMES;

// Cor de cada modo de jogo.
export const MODE_COLOR: Record<string, string> = {
  "Gem Grab": "#b56cff",
  "Brawl Ball": "#5aa9ff",
  Heist: "#ff6fb5",
  "Hot Zone": "#ff5a4d",
  Bounty: "#2fd6c3",
  Knockout: "#ffa94d",
};
export const MODE_ORDER = ["Gem Grab", "Brawl Ball", "Heist", "Hot Zone", "Bounty", "Knockout"];

// Cor de cada tier.
export const TIER_COLOR: Record<string, string> = {
  "S+": "#ff5a5a",
  S: "#ff9f43",
  A: "#f2c14e",
  B: "#7bd66f",
  C: "#5aa9ff",
  D: "#8b90a3",
};

// Classes prontas, para não repetir a mesma lista enorme em todo lugar.
export const PANEL = "rounded-2xl border border-[var(--line)] bg-[var(--panel)]";
export const CARD =
  "rounded-2xl border border-[var(--line)] bg-[var(--raised)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)]";
export const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 font-sans text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]";

// Sombra leve no texto dos títulos.
export const outline = { textShadow: "0 2px 12px rgba(0,0,0,0.45)" };

/** LOGO: escudo com um raio e duas lâminas cruzadas (o "pick" do draft). */
export function Logo(props: { size?: number; withName?: boolean }) {
  const size = props.size ?? 34;
  return (
    <span className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="bd-shield" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent2)" />
          </linearGradient>
        </defs>
        <path d="M24 3 42 9.5v13.2c0 11-7.4 19.4-18 22.3C13.4 42.1 6 33.7 6 22.7V9.5L24 3Z" fill="url(#bd-shield)" />
        <path d="M24 7.4 38.2 12.6v10.1c0 8.9-5.8 15.8-14.2 18.4C15.6 38.5 9.8 31.6 9.8 22.7V12.6L24 7.4Z" fill="#0b0c11" />
        <path d="M26.6 12 17.5 26h6.1l-2.3 10.6L31 21.4h-6.3L26.6 12Z" fill="url(#bd-shield)" />
      </svg>
      {props.withName !== false && (
        <span className="font-display text-xl leading-none tracking-wide text-white">
          Brawl<span className="text-[var(--accent)]">Draft</span>
        </span>
      )}
    </span>
  );
}

export type NavKey = "home" | "draft" | "train" | "meta" | "history" | "owned";

/** Moldura de todas as páginas: barra do topo, menu, configurações, conta e rodapé. */
export function Shell(props: {
  t: Dict;
  theme: ThemeName;
  lang: Lang;
  current: NavKey;
  account: string | null; // e-mail de quem está logado, ou null
  onTheme: (t: ThemeName) => void;
  onLang: (l: Lang) => void;
  onNav: (where: NavKey) => void;
  onAccount: () => void;
  children: React.ReactNode;
}) {
  const { t } = props;
  const [menu, setMenu] = useState(false); // menu de configurações aberto?
  const c = THEMES[props.theme] ?? THEMES.ouro;
  // As cores do tema viram "variáveis" que o resto da tela usa com var(--nome).
  const vars = {
    "--panel": c.panel,
    "--raised": c.raised,
    "--line": c.line,
    "--accent": c.accent,
    "--accent2": c.accent2,
    "--soft": c.soft,
    background: `radial-gradient(1200px 600px at 50% -200px, color-mix(in srgb, ${c.accent} 14%, transparent), transparent 70%), linear-gradient(180deg, ${c.bg1}, ${c.bg2})`,
  } as React.CSSProperties;

  const links: { key: NavKey; label: string }[] = [
    { key: "draft", label: t.liveDraft },
    { key: "train", label: t.training },
    { key: "meta", label: t.metaPage },
    { key: "history", label: t.history },
    { key: "owned", label: t.myBrawlers },
  ];

  return (
    <main className="min-h-screen font-sans text-white" style={vars}>
      {/* BARRA DO TOPO */}
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button onClick={() => props.onNav("home")} aria-label={t.home}>
            <Logo />
          </button>
          <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
            {links.map((l) => (
              <button
                key={l.key}
                onClick={() => props.onNav(l.key)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  props.current === l.key ? "bg-[var(--raised)] text-[var(--accent)]" : "text-[var(--soft)] hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={props.onAccount}
              className="max-w-[160px] truncate rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-white transition hover:border-[var(--accent)]"
            >
              {props.account ?? t.signIn}
            </button>
            <div className="relative">
              <button
                onClick={() => setMenu(!menu)}
                aria-label={t.settings}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--soft)] transition hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
              </button>
              {menu && (
                <div className={`${CARD} absolute right-0 top-11 w-56 p-3`}>
                  <p className="text-xs uppercase tracking-wider text-[var(--soft)]">{t.language}</p>
                  <div className="mt-2 flex gap-2">
                    {(["pt", "en"] as Lang[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => props.onLang(l)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${
                          props.lang === l ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] text-white"
                        }`}
                      >
                        {l === "pt" ? "Português" : "English"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wider text-[var(--soft)]">{t.theme}</p>
                  <div className="mt-2 flex gap-2">
                    {(Object.keys(THEMES) as ThemeName[]).map((name) => (
                      <button
                        key={name}
                        onClick={() => props.onTheme(name)}
                        title={name}
                        aria-label={`${t.theme}: ${name}`}
                        className={`h-8 flex-1 rounded-lg border-2 ${props.theme === name ? "border-white" : "border-transparent"}`}
                        style={{ background: `linear-gradient(135deg, ${THEMES[name].accent}, ${THEMES[name].accent2})` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Menu no celular: uma linha que rola para o lado */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {links.map((l) => (
            <button
              key={l.key}
              onClick={() => props.onNav(l.key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                props.current === l.key ? "bg-[var(--raised)] text-[var(--accent)]" : "text-[var(--soft)]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6" onClick={() => menu && setMenu(false)}>
        {props.children}
      </div>

      {/* RODAPÉ */}
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-center">
          <Logo size={26} />
          <p className="text-sm text-white">
            {t.madeBy} <span className="font-display text-[var(--accent)]">Gabriel</span>
          </p>
          <p className="max-w-xl text-[11px] leading-snug text-[var(--soft)] opacity-70">{t.disclaimer}</p>
        </div>
      </footer>
    </main>
  );
}

/** Botão principal (cheio, na cor de destaque). */
export function PrimaryButton(props: { onClick: () => void; children: React.ReactNode; disabled?: boolean; big?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-xl font-display tracking-wide text-black transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 ${
        props.big ? "px-7 py-3 text-xl" : "px-4 py-2 text-base"
      }`}
      style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}
    >
      {props.children}
    </button>
  );
}

export function SmallButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className="rounded-lg border border-[var(--line)] bg-[var(--raised)] px-3 py-1.5 text-sm text-white transition hover:border-[var(--accent)] active:scale-[0.98]"
    >
      {props.children}
    </button>
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
        className="shrink-0 rounded-lg"
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] font-display text-[var(--accent)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {brawler.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Miniatura do mapa. Se a foto falhar, mostra um bloco com a cor do modo. */
export function MapThumb(props: { map: GameMap; width: number }) {
  const { map, width } = props;
  const height = Math.round(width * 1.3); // os mapas são mais altos que largos
  const [broken, setBroken] = useState(false);
  if (map.imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={map.imageUrl}
        alt={map.name}
        width={width}
        height={height}
        loading="lazy"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-md border border-[var(--line)] bg-black/40"
        style={{ width, height, objectFit: "contain" }}
      />
    );
  }
  return (
    <span
      className="shrink-0 rounded-md border border-[var(--line)] opacity-60"
      style={{ width, height, background: MODE_COLOR[map.mode] ?? "#555" }}
    />
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
        props.active
          ? "border-[var(--accent)] bg-[var(--raised)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          : "border-[var(--line)] bg-[var(--panel)]"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--soft)]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: props.color }} />
        {props.title}
      </div>
      <div className="flex gap-1">
        {slots.map((id, i) => {
          const b = id !== null ? props.byId.get(id) : undefined;
          if (!b) return <span key={i} className="h-11 w-11 rounded-lg border border-dashed border-white/15" />;
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
      {props.label}: <span className={v < 0 ? "text-red-300" : "text-green-300"}>{text}</span>
    </span>
  );
}

/** Grade de Brawlers tocáveis, com busca. Usada no draft e em "Meus Brawlers". */
export function BrawlerGrid(props: {
  brawlers: Brawler[];
  placeholder: string;
  /** Devolve como o botão deve aparecer: normal, apagado ou destacado. */
  state: (b: Brawler) => "normal" | "dim" | "on";
  disabled?: (b: Brawler) => boolean;
  onPick: (b: Brawler) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const list = props.brawlers.filter((b) => b.name.toLowerCase().includes(q));
  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={props.placeholder} className={INPUT} />
      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {list.map((b) => {
          const st = props.state(b);
          return (
            <button
              key={b.id}
              disabled={props.disabled?.(b) ?? false}
              onClick={() => {
                props.onPick(b);
                setSearch("");
              }}
              title={b.name}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1 transition ${
                st === "on" ? "border-[var(--accent)] bg-[var(--raised)]" : "border-[var(--line)] bg-[var(--panel)]"
              } ${st === "dim" ? "opacity-25" : "hover:border-[var(--accent)] active:scale-95"}`}
            >
              <Icon brawler={b} size={56} />
              <span className="w-full truncate text-center text-[10px] text-white">{b.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
