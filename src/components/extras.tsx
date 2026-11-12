"use client";
// PEÇAS NOVAS DA v11: botão de compartilhar imagem, "qual upar pro 11",
// avisos no celular, gráficos da temporada e "as sugestões funcionam?".

import { useEffect, useState } from "react";
import { MAPS } from "@/data/maps";
import { mapName, type Dict } from "@/lib/i18n";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { shareImage } from "@/lib/share";
import type { HistoryEntry } from "@/lib/storage";
import type { RecSummary } from "@/lib/supabase";
import type { UpgradeTip } from "@/lib/upgrade";
import { CARD, H2, Icon, PrimaryButton, SUB, SmallButton } from "./ui";

const pct = (w: number, g: number) => (g > 0 ? Math.round((w / g) * 100) : 0);

// ================= COMPARTILHAR =================

export function ShareButton(props: { t: Dict; fileName: string; make: () => Promise<Blob | null> }) {
  const { t } = props;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setMsg(null);
    const blob = await props.make().catch(() => null);
    if (!blob) setMsg(t.shareFail);
    else {
      const r = await shareImage(blob, props.fileName, "BrawlDraft");
      if (r === "downloaded") setMsg(t.shareDownloaded);
    }
    setBusy(false);
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <SmallButton onClick={go} disabled={busy}>
        {busy ? t.shareBusy : `↗ ${t.share}`}
      </SmallButton>
      {msg && <span className="text-xs font-medium text-[var(--soft)]">{msg}</span>}
    </span>
  );
}

// ================= QUAL UPAR PRO 11 =================

export function UpgradeCard(props: { t: Dict; tips: UpgradeTip[]; hasRoster: boolean }) {
  const { t, tips } = props;
  return (
    <section className={`${CARD} p-5`}>
      <h2 className={H2}>{t.upTitle}</h2>
      <p className="text-xs text-[var(--soft)]">{t.upSub}</p>
      {!props.hasRoster ? (
        <p className={`${SUB} mt-3`}>{t.upNeedTag}</p>
      ) : tips.length === 0 ? (
        <p className={`${SUB} mt-3`}>{t.upNone}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {tips.map((tip, i) => (
            <li key={tip.brawler.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
              <span className="w-5 text-center text-sm font-bold text-[var(--faint)]">{i + 1}</span>
              <Icon brawler={tip.brawler} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {tip.brawler.name} <span className="text-xs font-normal text-[var(--faint)]">· {t.upYou(tip.power, tip.trophies)}</span>
                </p>
                <p className="text-xs text-[var(--soft)]">
                  {t.upWhy(tip.good, tip.total)}
                  {tip.brawler.winRate !== undefined && ` · ${t.upMeta(Math.round(tip.brawler.winRate * 10) / 10)}`}
                </p>
                <p className="truncate text-xs text-[var(--faint)]">
                  {t.upMaps}: {tip.bestMaps.map((n) => mapName(t.langCode, n)).join(", ")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ================= AVISOS NO CELULAR =================

export function AlertsCard(props: { t: Dict; lang: string; maps: number[] }) {
  const { t } = props;
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    pushState().then(setState);
  }, []);

  const names = props.maps.map((id) => MAPS.find((m) => m.gameId === id)?.name).filter((n): n is string => !!n).map((n) => mapName(t.langCode, n));

  async function toggle() {
    setBusy(true);
    setFail(false);
    const next = state === "on" ? await disablePush() : await enablePush(props.maps, props.lang);
    if (state !== "on" && next === "off") setFail(true);
    setState(next);
    setBusy(false);
  }

  return (
    <section className={`${CARD} p-5`}>
      <h2 className={H2}>{t.alertsTitle}</h2>
      <p className="text-xs text-[var(--soft)]">{t.alertsSub}</p>
      {state === "unsupported" && <p className={`${SUB} mt-3`}>{t.alertsUnsupported}</p>}
      {state === "off-server" && <p className={`${SUB} mt-3`}>{t.alertsOffServer}</p>}
      {state === "denied" && <p className="mt-3 text-sm text-[var(--bad)]">{t.alertsDenied}</p>}
      {(state === "on" || state === "off") && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {state === "on" ? (
              <SmallButton onClick={toggle} disabled={busy}>
                {t.alertsOff}
              </SmallButton>
            ) : (
              <PrimaryButton onClick={toggle} disabled={busy}>
                {t.alertsOn}
              </PrimaryButton>
            )}
            {state === "on" && <span className="text-sm font-medium text-[var(--good)]">{t.alertsActive}</span>}
          </div>
          {fail && <p className="text-sm text-[var(--bad)]">{t.alertsFail}</p>}
          <p className="text-xs text-[var(--faint)]">{names.length > 0 ? t.alertsMaps(names.join(", ")) : t.alertsNoMaps}</p>
        </div>
      )}
    </section>
  );
}

// ================= TEMPORADA (dois gráficos, um eixo cada) =================

type Day = { day: string; games: number; wins: number; rate: number | null };

/** Os últimos "n" dias, com partidas, vitórias e a média de 7 dias do % de vitórias. */
export function seasonDays(history: HistoryEntry[], n = 60, today = new Date()): Day[] {
  const per = new Map<string, { g: number; w: number }>();
  for (const h of history) {
    const d = h.date.slice(0, 10);
    const s = per.get(d) ?? { g: 0, w: 0 };
    s.g++;
    if (h.win) s.w++;
    per.set(d, s);
  }
  const days: Day[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    const s = per.get(d) ?? { g: 0, w: 0 };
    days.push({ day: d, games: s.g, wins: s.w, rate: null });
  }
  days.forEach((d, i) => {
    const win = days.slice(Math.max(0, i - 6), i + 1);
    const g = win.reduce((a, x) => a + x.games, 0);
    d.rate = g >= 3 ? pct(win.reduce((a, x) => a + x.wins, 0), g) : null;
  });
  return days;
}

const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function SeasonCharts(props: { t: Dict; history: HistoryEntry[] }) {
  const { t } = props;
  const [hover, setHover] = useState<{ chart: "g" | "r"; i: number } | null>(null);
  const all = seasonDays(props.history);
  const first = all.findIndex((d) => d.games > 0);
  if (first < 0) return <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.seasonEmpty}</p>;
  const days = all.slice(Math.min(first, all.length - 14)); // pelo menos 14 dias na tela
  const games = days.reduce((a, d) => a + d.games, 0);
  const wins = days.reduce((a, d) => a + d.wins, 0);

  const Wd = 640;
  const Hd = 150;
  const padL = 42;
  const padB = 22;
  const plotW = Wd - padL - 6;
  const plotH = Hd - padB - 10;
  const step = plotW / days.length;
  const maxG = Math.max(4, ...days.map((d) => d.games));
  const yG = (v: number) => 10 + plotH - (v / maxG) * plotH;
  const yR = (v: number) => 10 + plotH - (v / 100) * plotH;
  const xAt = (i: number) => padL + i * step + step / 2;
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1];

  const axis = (yLabels: { v: number; y: number; label: string }[]) => (
    <>
      {yLabels.map((l) => (
        <g key={l.label}>
          <line x1={padL} x2={Wd - 6} y1={l.y} y2={l.y} stroke="var(--line)" strokeWidth={1} />
          <text x={padL - 6} y={l.y + 4} textAnchor="end" fontSize={10} fill="var(--faint)">
            {l.label}
          </text>
        </g>
      ))}
      {ticks.map((i) => (
        <text key={i} x={xAt(i)} y={Hd - 6} textAnchor="middle" fontSize={10} fill="var(--faint)">
          {short(days[i].day)}
        </text>
      ))}
    </>
  );

  const rateLine = days
    .map((d, i) => (d.rate === null ? null : `${xAt(i)},${yR(d.rate)}`))
    .reduce<string[][]>((segs, p) => {
      if (p === null) segs.push([]);
      else (segs[segs.length - 1] ?? segs[segs.push([]) - 1]).push(p);
      return segs;
    }, [[]])
    .filter((s) => s.length > 0);

  const tip =
    hover === null
      ? null
      : hover.chart === "g"
        ? t.seasonDay(short(days[hover.i].day), days[hover.i].games, days[hover.i].wins)
        : days[hover.i].rate !== null
          ? t.seasonRateDay(short(days[hover.i].day), days[hover.i].rate as number)
          : null;

  return (
    <section className={`${CARD} p-5`}>
      <h2 className={H2}>{t.seasonTitle}</h2>
      <p className="text-sm text-[var(--soft)]">{t.seasonTotal(games, pct(wins, games), days.length)}</p>
      <p className="mt-1 h-5 text-xs font-medium text-[var(--text)]">{tip ?? ""}</p>

      <p className="mt-2 text-xs font-semibold text-[var(--soft)]">{t.seasonGames}</p>
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="w-full" role="img" aria-label={t.seasonGames} onMouseLeave={() => setHover(null)}>
        {axis([0, Math.round(maxG / 2), maxG].map((v) => ({ v, y: yG(v), label: String(v) })))}
        {days.map((d, i) => {
          const h = (d.games / maxG) * plotH;
          const bw = Math.max(2, step - 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover({ chart: "g", i })} onClick={() => setHover({ chart: "g", i })}>
              <rect x={padL + i * step} y={10} width={step} height={plotH} fill="transparent" />
              {d.games > 0 && (
                <path
                  d={`M${padL + i * step + 1},${yG(0)} v${-(h - Math.min(3, h / 2))} q0,${-Math.min(3, h / 2)} ${Math.min(3, bw / 2)},${-Math.min(3, h / 2)} h${bw - 2 * Math.min(3, bw / 2)} q${Math.min(3, bw / 2)},0 ${Math.min(3, bw / 2)},${Math.min(3, h / 2)} v${h - Math.min(3, h / 2)} z`}
                  fill="var(--accent)"
                  opacity={hover && hover.chart === "g" && hover.i !== i ? 0.55 : 1}
                />
              )}
            </g>
          );
        })}
      </svg>

      <p className="mt-3 text-xs font-semibold text-[var(--soft)]">{t.seasonRate}</p>
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="w-full" role="img" aria-label={t.seasonRate} onMouseLeave={() => setHover(null)}>
        {axis([0, 50, 100].map((v) => ({ v, y: yR(v), label: `${v}%` })))}
        <line x1={padL} x2={Wd - 6} y1={yR(50)} y2={yR(50)} stroke="var(--faint)" strokeWidth={1} strokeDasharray="4 4" />
        {rateLine.map((seg, k) => (
          <polyline key={k} points={seg.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover && hover.chart === "r" && days[hover.i].rate !== null && (
          <>
            <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={10} y2={10 + plotH} stroke="var(--faint)" strokeWidth={1} />
            <circle cx={xAt(hover.i)} cy={yR(days[hover.i].rate as number)} r={4.5} fill="var(--accent)" stroke="var(--raised)" strokeWidth={2} />
          </>
        )}
        {days.map((d, i) => (
          <rect
            key={d.day}
            x={padL + i * step}
            y={10}
            width={step}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover({ chart: "r", i })}
            onClick={() => setHover({ chart: "r", i })}
          />
        ))}
      </svg>
    </section>
  );
}

// ================= AS SUGESTÕES FUNCIONAM? =================

export function RecCard(props: { t: Dict; history: HistoryEntry[]; summary: RecSummary | null; globalOnly?: boolean }) {
  const { t, summary } = props;
  const mine = props.history.filter((h) => h.followed !== undefined);
  const f = mine.filter((h) => h.followed);
  const o = mine.filter((h) => !h.followed);
  const globalOk = summary !== null && summary.followed.games >= 20;
  return (
    <section className={`${CARD} p-5`}>
      <h2 className={H2}>{t.recTitle}</h2>
      <p className="text-xs text-[var(--soft)]">{t.recSub}</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {globalOk && summary && (
          <>
            <li className="font-semibold">{t.recGlobal(pct(summary.followed.wins, summary.followed.games), summary.followed.games)}</li>
            {summary.other.games > 0 && <li className="text-[var(--soft)]">{t.recOther(pct(summary.other.wins, summary.other.games), summary.other.games)}</li>}
          </>
        )}
        {f.length > 0 && <li>{t.recMine(pct(f.filter((h) => h.win).length, f.length), f.length)}</li>}
        {o.length > 0 && <li className="text-[var(--soft)]">{t.recMineOther(pct(o.filter((h) => h.win).length, o.length), o.length)}</li>}
        {mine.length === 0 && !props.globalOnly && <li className="text-[var(--soft)]">{t.recEmpty}</li>}
      </ul>
    </section>
  );
}
