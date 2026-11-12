"use client";
// HISTÓRICO: relatório da semana, metas de treino, partidas (com análise das derrotas)
// e o botão que busca as partidas de Ranked pela tag.

import { useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { lossReasons } from "@/lib/engine";
import { modeName, type Dict, type Lang } from "@/lib/i18n";
import { metaChanges, type MetaDay } from "@/lib/metaChanges";
import { groupBy, lastDays, type HistoryEntry } from "@/lib/storage";
import { weekCard } from "@/lib/share";
import type { RecSummary } from "@/lib/supabase";
import { AlertsCard, RecCard, SeasonCharts, ShareButton } from "./extras";
import { CARD, H1, H2, Icon, Pill, PrimaryButton, SUB, SmallButton, choice } from "./ui";

const BY_NAME = new Map(BRAWLERS.map((b) => [b.name, b]));
const pct = (w: number, g: number) => (g > 0 ? Math.round((w / g) * 100) : 0);

/** Média de % de vitórias do Brawler no meta (topbrawl); sem dado, 50%. */
function metaRate(name: string): number {
  return Math.round(BY_NAME.get(name)?.winRate ?? 50);
}

export function HistoryScreen(props: {
  t: Dict;
  lang: Lang;
  history: HistoryEntry[];
  metaHistory: MetaDay[];
  hasTag: boolean;
  syncing: boolean;
  syncMessage: string | null;
  onSync: () => void;
  onClear: () => void;
  recSummary: RecSummary | null;
  alertMaps: number[];
}) {
  const { t, lang, history } = props;
  const [tab, setTab] = useState<"week" | "season" | "goals" | "matches">("week");
  const [open, setOpen] = useState<string | null>(null);

  // ---- Relatório da semana ----
  const week = lastDays(history, 7);
  const weekWins = week.filter((h) => h.win).length;
  const byBrawler = groupBy(week, (h) => h.played).filter(([, s]) => s.games >= 3);
  const best = [...byBrawler].sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games)[0];
  const byMap = groupBy(week, (h) => h.map).filter(([, s]) => s.games >= 2);
  const worst = [...byMap].sort((a, b) => a[1].wins / a[1].games - b[1].wins / b[1].games)[0];
  const changes = metaChanges(props.metaHistory);

  /** Desenha o card da semana para compartilhar. */
  function makeWeekCard() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
      const list = week.filter((h) => h.date.slice(0, 10) === d);
      return { games: list.length, wins: list.filter((h) => h.win).length };
    });
    const bestB = best ? BY_NAME.get(best[0]) : undefined;
    return weekCard({
      title: t.cardWeek,
      games: week.length,
      winRate: pct(weekWins, week.length),
      gamesLabel: t.games,
      winRateLabel: t.winRate,
      best: best && bestB ? { id: bestB.id, name: best[0], line: `${pct(best[1].wins, best[1].games)}% · ${best[1].games}` } : undefined,
      bestLabel: t.reportBestLabel,
      worstMap: worst ? { name: worst[0], line: `${pct(worst[1].wins, worst[1].games)}% · ${worst[1].games}` } : undefined,
      worstLabel: t.reportWorstLabel,
      days,
      host: window.location.host,
    });
  }

  // ---- Metas de treino (Brawler + modo, a partir de 5 partidas) ----
  const goals = groupBy(history, (h) => `${h.played}|${h.mode}`)
    .filter(([, s]) => s.games >= 5)
    .map(([key, s]) => {
      const [name, mode] = key.split("|");
      const mine = pct(s.wins, s.games);
      const avg = metaRate(name);
      return { name, mode, mine, avg, diff: mine - avg, games: s.games };
    })
    .sort((a, b) => a.diff - b.diff);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={H1}>{t.history}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {props.hasTag ? (
            <PrimaryButton onClick={props.onSync} disabled={props.syncing}>
              {props.syncing ? t.syncing : t.syncHistory}
            </PrimaryButton>
          ) : null}
        </div>
      </div>
      {props.syncMessage && <p className="text-sm font-medium text-[var(--good)]">{props.syncMessage}</p>}
      <p className="text-xs text-[var(--faint)]">{props.hasTag ? t.syncNote : t.syncNoTag}</p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab("week")} className={choice(tab === "week")}>
          {t.reportTitle}
        </button>
        <button onClick={() => setTab("season")} className={choice(tab === "season")}>
          {t.seasonTab}
        </button>
        <button onClick={() => setTab("goals")} className={choice(tab === "goals")}>
          {t.goalsTitle}
        </button>
        <button onClick={() => setTab("matches")} className={choice(tab === "matches")}>
          {t.recent} ({history.length})
        </button>
      </div>

      {tab === "week" && (
        <div className="flex flex-col gap-4">
          {week.length > 0 && (
            <div>
              <ShareButton t={t} fileName="brawldraft-semana.png" make={makeWeekCard} />
            </div>
          )}
          {week.length === 0 ? (
            <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.reportEmpty}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t.games} value={String(week.length)} />
              <Stat label={t.winRate} value={`${pct(weekWins, week.length)}%`} />
              <Stat label={t.reportBestLabel} value={best ? best[0] : "—"} sub={best ? t.reportBest(best[0], pct(best[1].wins, best[1].games)) : undefined} />
              <Stat label={t.reportWorstLabel} value={worst ? worst[0] : "—"} sub={worst ? t.reportWorstMap(worst[0], pct(worst[1].wins, worst[1].games)) : undefined} />
            </div>
          )}
          <section className={`${CARD} p-5`}>
            <h2 className={H2}>{t.metaMoves}</h2>
            {changes ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Moves title={t.metaUp} items={changes.up.map((m) => `${m.name} +${m.delta.toFixed(1)}%`)} good />
                <Moves title={t.metaDown} items={changes.down.map((m) => `${m.name} ${m.delta.toFixed(1)}%`)} />
              </div>
            ) : (
              <p className={`${SUB} mt-2`}>{t.metaMovesEmpty}</p>
            )}
          </section>
          <RecCard t={t} history={history} summary={props.recSummary} />
          <AlertsCard t={t} lang={lang} maps={props.alertMaps} />
          {history.length > 0 && (
            <section className={`${CARD} p-5`}>
              <h2 className={H2}>{t.byMode}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {groupBy(history, (h) => h.mode).map(([mode, s]) => (
                  <div key={mode} className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <span className="block font-semibold">{modeName(lang, mode)}</span>
                    <span className="text-sm text-[var(--soft)]">
                      {s.games} · {pct(s.wins, s.games)}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "season" && <SeasonCharts t={t} history={history} />}

      {tab === "goals" && (
        <section className={`${CARD} p-5`}>
          <h2 className={H2}>{t.goalsTitle}</h2>
          <p className="text-xs text-[var(--soft)]">{t.goalsSub}</p>
          {goals.length === 0 ? (
            <p className={`${SUB} mt-3`}>{t.goalsEmpty}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {goals.map((g) => {
                const b = BY_NAME.get(g.name);
                const bad = g.diff <= -10;
                const good = g.diff >= 5;
                return (
                  <li
                    key={`${g.name}-${g.mode}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      bad ? "border-[var(--bad)] bg-[var(--bad-bg)]" : good ? "border-[var(--good)] bg-[var(--good-bg)]" : "border-[var(--line)]"
                    }`}
                  >
                    {b && <Icon brawler={b} size={36} />}
                    <span className="flex-1 text-sm">
                      {bad
                        ? t.goalBad(g.name, modeName(lang, g.mode), g.mine, g.avg)
                        : good
                          ? t.goalGood(g.name, modeName(lang, g.mode), g.mine, g.avg)
                          : `${g.name} · ${modeName(lang, g.mode)}: ${g.mine}% (${t.metaAvg} ${g.avg}%)`}
                    </span>
                    <span className="text-xs text-[var(--faint)]">{g.games}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "matches" && (
        <section className="flex flex-col gap-2">
          {history.length === 0 && <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.noHistory}</p>}
          {[...history].reverse().slice(0, 60).map((h) => {
            const b = BY_NAME.get(h.played);
            const map = MAPS.find((m) => m.name === h.map);
            const isOpen = open === h.date;
            return (
              <div key={h.date} className={`${CARD} overflow-hidden`}>
                <button onClick={() => setOpen(isOpen ? null : h.date)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Pill bg={h.win ? "var(--good-bg)" : "var(--bad-bg)"} color={h.win ? "var(--good)" : "var(--bad)"}>
                    {h.win ? t.win : t.loss}
                    {h.rounds ? ` ${h.rounds[0]}-${h.rounds[1]}` : ""}
                  </Pill>
                  {b && <Icon brawler={b} size={34} />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {h.played} {h.source === "auto" && <Pill>{t.autoBadge}</Pill>}{" "}
                      {h.followed && <Pill bg="var(--good-bg)" color="var(--good)">{t.recFollowed}</Pill>}
                    </span>
                    <span className="block truncate text-xs text-[var(--soft)]">
                      {h.map} · {modeName(lang, h.mode)}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--faint)]">{h.date.slice(0, 10)}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--line)] px-4 py-3 text-sm">
                    <p className="text-[var(--soft)]">
                      {t.myTeam}: {h.team.join(", ") || "—"} · {t.enemies}: {h.enemies.join(", ") || "—"}
                    </p>
                    {!h.win && (
                      <div className="mt-2">
                        <p className="font-semibold">{t.lossTitle}</p>
                        <ul className="mt-1 list-disc pl-5 text-[var(--soft)]">
                          {lossReasons(h, BRAWLERS, map, lang).map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {history.length > 0 && (
            <div className="mt-2">
              <SmallButton onClick={props.onClear}>{t.clearHistory}</SmallButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat(props: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <span className="block text-xs text-[var(--soft)]">{props.label}</span>
      <span className="block truncate text-2xl font-extrabold tracking-tight">{props.value}</span>
      {props.sub && <span className="block text-[11px] text-[var(--faint)]">{props.sub}</span>}
    </div>
  );
}

function Moves(props: { title: string; items: string[]; good?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{props.title}</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm">
        {props.items.length === 0 && <li className="text-[var(--faint)]">—</li>}
        {props.items.map((x) => (
          <li key={x} className={props.good ? "text-[var(--good)]" : "text-[var(--bad)]"}>
            {props.good ? "▲" : "▼"} {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
