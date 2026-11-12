"use client";
// TELA DO BRAWLER DO DIA

import { useEffect, useMemo, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAX_GUESSES, answerFor, compare, dayKey, finishDay, shareText, type Clue, type DailyState, type DailyStats } from "@/lib/daily";
import { className, type Dict, type Lang } from "@/lib/i18n";
import { load, save } from "@/lib/storage";
import type { Brawler } from "@/lib/types";
import { CARD, H1, INPUT, Icon, SUB, SmallButton } from "./ui";

const STATE_KEY = "bd-daily";
const STATS_KEY = "bd-daily-stats";
const EMPTY_STATS: DailyStats = { played: 0, wins: 0, streak: 0, best: 0, lastWinDay: null };
const BY_ID = new Map(BRAWLERS.map((b) => [b.id, b]));

function Cell(props: { clue: Clue; text: string; label: string }) {
  const arrowCell = props.clue === "up" || props.clue === "down";
  const bg =
    props.clue === "same" ? "var(--good)" : props.clue === "no" ? "var(--bad)" : props.clue === "unknown" ? "var(--sunken)" : "var(--warn-bg)";
  const arrow = props.clue === "up" ? "▲" : props.clue === "down" ? "▼" : "";
  return (
    <div
      className="flex min-h-[52px] flex-col items-center justify-center rounded-lg px-0.5 py-1 text-center text-[10px] font-bold leading-tight text-white sm:min-h-[56px] sm:rounded-xl sm:px-1 sm:py-1.5 sm:text-xs"
      style={{
        background: bg,
        color: props.clue === "unknown" ? "var(--soft)" : arrowCell ? "var(--warn)" : "#fff",
        border: arrowCell ? "1px solid var(--warn)" : undefined,
      }}
      title={props.label}
    >
      {arrow && <span className="text-base leading-none">{arrow}</span>}
      <span className="break-words">{props.text}</span>
    </div>
  );
}

export function DailyScreen(props: { t: Dict; lang: Lang; onResult: (won: boolean, stats: DailyStats) => void }) {
  const { t, lang } = props;
  const [day, setDay] = useState<string | null>(null);
  const [game, setGame] = useState<DailyState | null>(null);
  const [stats, setStats] = useState<DailyStats>(EMPTY_STATS);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState("");

  // A data é lida só no navegador.
  useEffect(() => {
    const d = dayKey();
    setDay(d);
    const saved = load<DailyState | null>(STATE_KEY, null);
    setGame(saved && saved.day === d ? saved : { day: d, guesses: [], done: false, won: false });
    setStats(load<DailyStats>(STATS_KEY, EMPTY_STATS));
  }, []);

  // Tempo até o próximo Brawler (meia-noite de Brasília).
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const next = new Date(br);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - br.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setLeft(`${h}h ${String(m).padStart(2, "0")}min`);
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  const answer = useMemo(() => (day ? answerFor(day, BRAWLERS) : null), [day]);
  if (!day || !game || !answer) return null;

  const guesses = game.guesses.map((id) => BY_ID.get(id)).filter((b): b is Brawler => !!b);
  const options =
    query.trim().length === 0
      ? []
      : BRAWLERS.filter((b) => !game.guesses.includes(b.id) && b.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  function guess(b: Brawler) {
    if (!game || game.done || !answer) return;
    const list = [...game.guesses, b.id];
    const won = b.id === answer.id;
    const done = won || list.length >= MAX_GUESSES;
    const next = { ...game, guesses: list, done, won };
    setGame(next);
    save(STATE_KEY, next);
    setQuery("");
    if (done) {
      const s = finishDay(stats, game.day, won);
      setStats(s);
      save(STATS_KEY, s);
      props.onResult(won, s);
    }
  }

  const dayLabel = `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  function share() {
    if (!answer) return;
    const text = shareText(dayLabel, guesses.map((g) => compare(g, answer)), game?.won ?? false, t.dailyTitle, `${window.location.origin}/?jogo=dia`);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) nav.share({ text }).catch(() => null);
    else
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  const tierLabel = (b: Brawler) => b.tier;
  const heads = [t.dClass, t.dTier, t.dRelease, t.dWinRate, t.dLetter];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className={H1}>{t.dailyTitle}</h1>
        <p className={SUB}>{t.dailySub}</p>
      </div>

      {/* Placar */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          [t.dPlayed, stats.played],
          [t.dWins, stats.wins],
          [t.dStreak, stats.streak],
          [t.dBest, stats.best],
        ].map(([label, v]) => (
          <div key={label as string} className={`${CARD} p-3`}>
            <p className="text-2xl font-extrabold">{v}</p>
            <p className="text-[11px] text-[var(--soft)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Palpite */}
      {!game.done && (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && options[0]) guess(options[0]);
            }}
            placeholder={t.dPlaceholder(MAX_GUESSES - game.guesses.length)}
            className={`${INPUT} w-full`}
            aria-label={t.dPlaceholder(MAX_GUESSES - game.guesses.length)}
          />
          {options.length > 0 && (
            <ul className={`${CARD} absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden`}>
              {options.map((b) => (
                <li key={b.id}>
                  <button onClick={() => guess(b)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--sunken)]">
                    <Icon brawler={b} size={32} />
                    <span className="font-semibold">{b.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Resultado */}
      {game.done && (
        <section className={`${CARD} flex flex-col gap-4 border-2 p-5 sm:flex-row sm:items-center ${game.won ? "border-[var(--good)]" : "border-[var(--bad)]"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-4">
          <Icon brawler={answer} size={64} />
          <div className="min-w-0 flex-1">
            <p className={`text-xl font-extrabold ${game.won ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
              {game.won ? t.dWon(game.guesses.length) : t.dLost}
            </p>
            <p className="text-sm text-[var(--soft)]">{t.dAnswer(answer.name)}</p>
            <p className="text-xs text-[var(--faint)]">{t.dNext(left)}</p>
          </div>
          </div>
          <SmallButton onClick={share}>{copied ? t.dCopied : `↗ ${t.dShare}`}</SmallButton>
        </section>
      )}

      {/* Palpites com as pistas */}
      {guesses.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))] gap-1 text-center text-[10px] font-semibold leading-tight text-[var(--faint)] sm:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))] sm:gap-1.5 sm:text-[11px]">
            <span />
            {heads.map((h) => (
              <span key={h} className="break-words">
                {h}
              </span>
            ))}
          </div>
          {[...guesses].reverse().map((g) => {
            const c = compare(g, answer);
            return (
              <div key={g.id} className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))] items-stretch gap-1 sm:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))] sm:gap-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon brawler={g} size={40} />
                  <span className="hidden truncate text-sm font-bold sm:inline">{g.name}</span>
                </div>
                <Cell clue={c.cls} text={className(lang, g.class)} label={heads[0]} />
                <Cell clue={c.tier} text={tierLabel(g)} label={heads[1]} />
                <Cell clue={c.release} text={t.dReleaseHint(c.release)} label={heads[2]} />
                <Cell clue={c.winRate} text={g.winRate !== undefined ? `${Math.round(g.winRate)}%` : "?"} label={heads[3]} />
                <Cell clue={c.letter} text={g.name.charAt(0).toUpperCase()} label={heads[4]} />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[var(--faint)]">{t.dHelp}</p>
    </div>
  );
}
