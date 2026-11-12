"use client";
// RANK NO RANKED, ALERTA DE TILT E "COM QUEM VOCÊ GANHA MAIS"

import { useEffect, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import type { Dict, Lang } from "@/lib/i18n";
import { alliesAndRivals, comfortBest, currentRank, lossStreak, rankByDay, type Rate } from "@/lib/insights";
import { MAX_RANK, rankColor, rankName } from "@/lib/rank";
import { load, save, type HistoryEntry } from "@/lib/storage";
import { CARD, H2, Icon, SUB } from "./ui";

const BY_NAME = new Map(BRAWLERS.map((b) => [b.name, b]));

/** Selo do rank (ex.: Mítico II), na cor da faixa. */
export function RankBadge(props: { lang: Lang; rank: number; big?: boolean }) {
  const color = rankColor(props.rank);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl font-extrabold ${props.big ? "px-4 py-2 text-2xl" : "px-2.5 py-1 text-sm"}`}
      style={{ background: `${color}22`, color }}
    >
      <span className={`${props.big ? "h-3 w-3" : "h-2 w-2"} rounded-full`} style={{ background: color }} />
      {rankName(props.lang, props.rank)}
    </span>
  );
}

// ================= RANK NA TEMPORADA =================

export function RankCard(props: { t: Dict; lang: Lang; history: HistoryEntry[] }) {
  const { t, lang } = props;
  const [hover, setHover] = useState<number | null>(null);
  const now = currentRank(props.history);
  const days = rankByDay(props.history).slice(-60);

  const W = 640;
  const H = 170;
  const padL = 92;
  const padB = 22;
  const plotW = W - padL - 10;
  const plotH = H - padB - 12;
  const lo = days.length ? Math.max(0, Math.min(...days.map((d) => d.rank)) - 1) : 0;
  const hi = days.length ? Math.min(MAX_RANK, Math.max(...days.map((d) => d.rank)) + 1) : 1;
  const y = (r: number) => 12 + plotH - ((r - lo) / Math.max(1, hi - lo)) * plotH;
  const step = days.length > 1 ? plotW / (days.length - 1) : 0;
  const x = (i: number) => padL + (days.length > 1 ? i * step : plotW / 2);
  // Degraus: o rank fica igual até o próximo dia com partida.
  const path = days.map((d, i) => (i === 0 ? `M${x(i)},${y(d.rank)}` : `H${x(i)} V${y(d.rank)}`)).join(" ");
  const ticks = [...new Set([lo, Math.round((lo + hi) / 2), hi])];
  const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return (
    <section className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={H2}>{t.rankTitle}</h2>
        {now !== null && <RankBadge lang={lang} rank={now} big />}
      </div>
      {now === null ? (
        <p className={`${SUB} mt-2`}>{t.rankNone}</p>
      ) : (
        days.length > 1 && (
          <>
            <p className="mt-3 text-xs font-semibold text-[var(--soft)]">{t.rankChart}</p>
            <p className="h-5 text-xs font-medium">{hover !== null ? `${short(days[hover].day)}: ${rankName(lang, days[hover].rank)}` : ""}</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t.rankChart} onMouseLeave={() => setHover(null)}>
              {ticks.map((r) => (
                <g key={r}>
                  <line x1={padL} x2={W - 10} y1={y(r)} y2={y(r)} stroke="var(--line)" />
                  <text x={padL - 8} y={y(r) + 4} textAnchor="end" fontSize={11} fill="var(--faint)">
                    {rankName(lang, r)}
                  </text>
                </g>
              ))}
              <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
              {days.map((d, i) => (
                <g key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                  <rect x={x(i) - Math.max(6, step / 2)} y={12} width={Math.max(12, step)} height={plotH} fill="transparent" />
                  <circle cx={x(i)} cy={y(d.rank)} r={hover === i ? 5 : 3} fill="var(--accent)" stroke="var(--raised)" strokeWidth={2} />
                </g>
              ))}
              {[0, days.length - 1].map((i) => (
                <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fontSize={10} fill="var(--faint)">
                  {short(days[i].day)}
                </text>
              ))}
            </svg>
          </>
        )
      )}
    </section>
  );
}

// ================= ALERTA DE TILT =================

const DISMISS_KEY = "bd-tilt-hidden";

export function TiltBanner(props: { t: Dict; history: HistoryEntry[] }) {
  const { t } = props;
  // A hora é lida só no navegador (a página é montada antes no servidor).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), [props.history]);
  const streak = now === null ? 0 : lossStreak(props.history, now);
  const ordered = [...props.history].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = ordered.length ? ordered[ordered.length - 1].date : "";
  // Guarda a data da última partida quando a pessoa tocou em "Entendi": volta a aparecer só depois de outra derrota.
  const [dismissed, setDismissed] = useState(() => load<string>(DISMISS_KEY, ""));
  if (streak < 3 || (lastDate !== "" && dismissed === lastDate)) return null;
  const found = comfortBest(props.history);
  const best = found && found.rate >= 50 ? found : null; // só sugere se ele ganha mais do que perde
  const b = best ? BY_NAME.get(best.name) : undefined;
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--warn)] bg-[var(--warn-bg)] p-4" role="status">
      {b && <Icon brawler={b} size={44} />}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[var(--warn)]">{t.tiltTitle(streak)}</p>
        <p className="text-sm">{t.tiltSub}</p>
        {best && <p className="text-sm text-[var(--soft)]">{t.tiltComfort(best.name, best.rate)}</p>}
      </div>
      <button
        onClick={() => {
          // Esconde até a próxima partida.
          save(DISMISS_KEY, lastDate);
          setDismissed(lastDate);
        }}
        className="rounded-xl border border-[var(--warn)] px-4 py-2 text-sm font-semibold text-[var(--warn)]"
      >
        {t.tiltHide}
      </button>
    </section>
  );
}

// ================= ALIADOS E RIVAIS =================

function RateList(props: { t: Dict; title: string; items: Rate[]; good: boolean }) {
  if (props.items.length === 0) return null;
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{props.title}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {props.items.map((r) => {
          const b = BY_NAME.get(r.name);
          return (
            <li key={r.name} className="flex items-center gap-3">
              {b && <Icon brawler={b} size={36} />}
              <span className="flex-1 font-semibold">{r.name}</span>
              <span className={`text-sm font-bold ${props.good ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{props.t.arLine(r.rate, r.games)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AlliesRivals(props: { t: Dict; history: HistoryEntry[] }) {
  const { t } = props;
  const ar = alliesAndRivals(props.history);
  const any = ar.bestAllies.length + ar.worstAllies.length + ar.easyFoes.length + ar.hardFoes.length > 0;
  if (!any) return <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.arEmpty}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <RateList t={t} title={t.arBestAllies} items={ar.bestAllies.filter((x) => x.rate >= 50)} good />
      <RateList t={t} title={t.arWorstAllies} items={ar.worstAllies} good={false} />
      <RateList t={t} title={t.arEasy} items={ar.easyFoes} good />
      <RateList t={t} title={t.arHard} items={ar.hardFoes} good={false} />
    </div>
  );
}
