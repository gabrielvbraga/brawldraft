"use client";
// PEÇAS DE TELA usadas em várias páginas: moldura, botões, ícones e cores.

import { useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import type { Brawler } from "@/lib/types";

// ----- Temas de cor. Para criar outro, copie uma linha e troque as cores. -----
export const THEMES = {
  roxo: { bg1: "#0d0717", bg2: "#1d0f3a", panel: "#1a1030", raised: "#281a4a", line: "#4a3380", accent: "#c77dff", soft: "#cdbdf0" },
  vermelho: { bg1: "#0f0707", bg2: "#2a0c0c", panel: "#1c0f0f", raised: "#2e1616", line: "#6b2424", accent: "#ff5252", soft: "#f0c4c4" },
  laranja: { bg1: "#0e0a06", bg2: "#2a1a08", panel: "#1c140c", raised: "#2e2012", line: "#6b4a1c", accent: "#ff9f1c", soft: "#f0dcc0" },
  ciano: { bg1: "#050b0f", bg2: "#08222e", panel: "#0c1a22", raised: "#122a36", line: "#1f5468", accent: "#2ee6ff", soft: "#bfe6ee" },
  grafite: { bg1: "#0a0a0b", bg2: "#1a1a1e", panel: "#151518", raised: "#222227", line: "#45454d", accent: "#f5f5f5", soft: "#c9c9d1" },
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
  A: "#ffd84d",
  B: "#7bd66f",
  C: "#5aa9ff",
  D: "#9a9aa6",
};

// Classes prontas, para não repetir a mesma lista enorme em todo lugar.
export const PANEL = "rounded-xl border-2 border-[var(--line)] bg-[var(--panel)]";
export const CARD = "rounded-xl border-2 border-[var(--line)] bg-[var(--raised)] shadow-[0_3px_0_#000]";
export const INPUT =
  "w-full rounded-xl border-2 border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]";

// Contorno preto no texto, no estilo do jogo.
export const outline = { textShadow: "0 2px 0 #000, 0 0 3px #000" };

/** Moldura de todas as páginas: fundo, barra do topo (início, idioma, tema) e rodapé. */
export function Shell(props: {
  t: Dict;
  theme: ThemeName;
  lang: Lang;
  onTheme: (t: ThemeName) => void;
  onLang: (l: Lang) => void;
  onHome?: () => void; // sem isso, o botão "Início" não aparece
  children: React.ReactNode;
}) {
  const c = THEMES[props.theme];
  // As cores do tema viram "variáveis" que o resto da tela usa com var(--nome).
  const vars = {
    "--panel": c.panel,
    "--raised": c.raised,
    "--line": c.line,
    "--accent": c.accent,
    "--soft": c.soft,
    background: `linear-gradient(180deg, ${c.bg1}, ${c.bg2})`,
  } as React.CSSProperties;

  return (
    <main className="min-h-screen px-3 py-3" style={vars}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>{props.onHome && <SmallButton onClick={props.onHome}>{`‹ ${props.t.home}`}</SmallButton>}</div>
          <div className="flex items-center gap-2">
            {/* Idioma */}
            <div className="flex overflow-hidden rounded-lg border-2 border-[var(--line)] text-xs">
              {(["pt", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => props.onLang(l)}
                  className={`px-2 py-1 ${props.lang === l ? "bg-[var(--accent)] text-black" : "bg-[var(--panel)] text-white"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Tema */}
            {(Object.keys(THEMES) as ThemeName[]).map((name) => (
              <button
                key={name}
                onClick={() => props.onTheme(name)}
                title={`${props.t.theme}: ${name}`}
                aria-label={`${props.t.theme}: ${name}`}
                className={`h-6 w-6 rounded-full border-2 ${props.theme === name ? "border-white" : "border-black"}`}
                style={{ background: THEMES[name].accent }}
              />
            ))}
          </div>
        </div>
        {props.children}
        <footer className="mt-8 text-center font-sans text-[11px] leading-snug text-[var(--soft)] opacity-70">
          {props.t.disclaimer}
        </footer>
      </div>
    </main>
  );
}

export function SmallButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className="rounded-lg border-2 border-[var(--line)] bg-[var(--raised)] px-3 py-1 text-sm text-white shadow-[0_2px_0_#000] transition hover:brightness-125 active:translate-y-0.5"
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
      className="flex shrink-0 items-center justify-center rounded-lg border-2 border-[var(--line)] bg-[var(--panel)] text-[var(--accent)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {brawler.name.slice(0, 2).toUpperCase()}
    </span>
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
      className={`rounded-xl border-2 p-2 ${props.onSelect ? "cursor-pointer" : ""} ${
        props.active ? "border-[var(--accent)] bg-[var(--raised)]" : "border-[var(--line)] bg-[var(--panel)]"
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-sm text-white">
        <span className="h-3 w-3 rounded-full border border-black" style={{ background: props.color }} />
        {props.title}
      </div>
      <div className="flex gap-1">
        {slots.map((id, i) => {
          const b = id !== null ? props.byId.get(id) : undefined;
          if (!b) return <span key={i} className="h-11 w-11 rounded-lg border-2 border-dashed border-white/20" />;
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
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1 transition ${
                st === "on" ? "border-[var(--accent)] bg-[var(--raised)]" : "border-[var(--line)] bg-[var(--raised)]"
              } ${st === "dim" ? "opacity-25" : "hover:brightness-125 active:scale-95"}`}
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
