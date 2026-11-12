"use client";
// FERRAMENTAS: busca de counter, quiz de counters, placar do treino e comparação de amigos.

import { useEffect, useMemo, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { countersOf, matchup } from "@/lib/engine";
import { mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import type { RosterItem } from "@/lib/storage";
import { loadScores, type Score } from "@/lib/supabase";
import type { Brawler } from "@/lib/types";
import { BrawlerGrid, CARD, H1, INPUT, Icon, Pill, PrimaryButton, SUB, SmallButton } from "./ui";

// ================= QUEM COUNTERA? =================

export function CountersScreen(props: { t: Dict }) {
  const { t } = props;
  const [target, setTarget] = useState<Brawler | null>(null);
  const result = useMemo(() => (target ? countersOf(target, BRAWLERS) : null), [target]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className={H1}>{t.countersTitle}</h1>
        <p className={SUB}>{t.countersSub}</p>
      </div>
      {target && result && (
        <section className={`${CARD} p-5`}>
          <div className="flex items-center gap-3">
            <Icon brawler={target} size={56} />
            <span className="text-2xl font-extrabold">{target.name}</span>
            <span className="ml-auto">
              <SmallButton onClick={() => setTarget(null)}>{t.back}</SmallButton>
            </span>
          </div>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <CounterList title={t.beatIt} items={result.beatIt} t={t} good={false} />
            <CounterList title={t.losesToIt} items={result.losesToIt} t={t} good />
          </div>
          {!result.beatIt.some((x) => x.specific) && <p className="mt-4 rounded-xl bg-[var(--warn-bg)] p-3 text-sm text-[var(--warn)]">{t.noData}</p>}
          <p className="mt-4 text-xs text-[var(--faint)]">{t.countersSource}</p>
        </section>
      )}
      {!target && (
        <BrawlerGrid brawlers={BRAWLERS} placeholder={t.searchBrawler} state={() => "normal"} onPick={(b: Brawler) => setTarget(b)} />
      )}
    </div>
  );
}

function CounterList(props: { title: string; items: { brawler: Brawler; value: number; specific: boolean }[]; t: Dict; good: boolean }) {
  const { t } = props;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">{props.title}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {props.items.length === 0 && <span className="text-sm text-[var(--faint)]">—</span>}
        {props.items.slice(0, 12).map((x) => {
          const strong = Math.abs(x.value) >= 1.5;
          return (
            <div key={x.brawler.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-2">
              <Icon brawler={x.brawler} size={36} />
              <span className="flex-1 font-semibold">{x.brawler.name}</span>
              {!x.specific && <span className="text-[10px] text-[var(--faint)]">{t.byClass}</span>}
              <Pill bg={props.good ? "var(--good-bg)" : "var(--bad-bg)"} color={props.good ? "var(--good)" : "var(--bad)"}>
                {strong ? t.strongTag : t.lightTag}
              </Pill>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================= QUIZ DE COUNTERS =================

type Question = { target: Brawler; options: Brawler[]; answer: number };

/** Monta uma pergunta: um Brawler, 1 counter de verdade e 3 que não countera ele. */
function makeQuestion(): Question | null {
  for (let tries = 0; tries < 50; tries++) {
    const target = BRAWLERS[Math.floor(Math.random() * BRAWLERS.length)];
    const counters = BRAWLERS.filter((b) => b.id !== target.id && matchup(b, target) >= 1);
    const others = BRAWLERS.filter((b) => b.id !== target.id && matchup(b, target) <= 0);
    if (counters.length === 0 || others.length < 3) continue;
    const right = counters[Math.floor(Math.random() * Math.min(counters.length, 5))];
    const wrong = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [right, ...wrong].sort(() => Math.random() - 0.5);
    return { target, options, answer: right.id };
  }
  return null;
}

export function QuizScreen(props: { t: Dict }) {
  const { t } = props;
  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);

  // A primeira pergunta é sorteada só no navegador (o servidor não sorteia nada).
  useEffect(() => setQ(makeQuestion()), []);

  function answer(id: number) {
    if (!q || picked !== null) return;
    setPicked(id);
    setTotal(total + 1);
    if (id === q.answer) {
      setRight(right + 1);
      setStreak(streak + 1);
    } else setStreak(0);
  }

  const correct = q?.options.find((o) => o.id === q.answer);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className={H1}>{t.quizTitle}</h1>
          <p className={SUB}>{t.quizSub}</p>
        </div>
        <span className="text-sm font-semibold text-[var(--soft)]">
          {t.quizScore(right, total)} · {t.quizStreak(streak)}
        </span>
      </div>
      {q && (
        <section className={`${CARD} flex flex-col items-center gap-5 p-6`}>
          <Icon brawler={q.target} size={88} />
          <h2 className="text-center text-2xl font-extrabold">{t.quizQ(q.target.name)}</h2>
          <div className="grid w-full grid-cols-2 gap-3">
            {q.options.map((o) => {
              const state =
                picked === null ? "" : o.id === q.answer ? "border-[var(--good)] bg-[var(--good-bg)]" : o.id === picked ? "border-[var(--bad)] bg-[var(--bad-bg)]" : "opacity-50";
              return (
                <button
                  key={o.id}
                  onClick={() => answer(o.id)}
                  className={`flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-left transition hover:border-[var(--accent)] ${state}`}
                >
                  <Icon brawler={o} size={44} />
                  <span className="font-semibold">{o.name}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="flex flex-col items-center gap-3">
              <p className={`font-bold ${picked === q.answer ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
                {picked === q.answer ? t.quizRight : t.quizWrong(correct?.name ?? "")}
              </p>
              <PrimaryButton
                onClick={() => {
                  setQ(makeQuestion());
                  setPicked(null);
                }}
              >
                {t.quizNext}
              </PrimaryButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ================= PLACAR DO TREINO =================

export function LeaderboardScreen(props: { t: Dict; loggedIn: boolean; myId: string | null }) {
  const { t } = props;
  const [scores, setScores] = useState<Score[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadScores().then((s) => {
      if (s) setScores(s);
      else setFailed(true);
    });
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className={H1}>{t.lbTitle}</h1>
        <p className={SUB}>{t.lbSub}</p>
      </div>
      {!props.loggedIn && <p className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm">{t.lbLogin}</p>}
      <section className={`${CARD} overflow-hidden`}>
        {scores === null && !failed && <p className={`${SUB} p-5`}>{t.loading}</p>}
        {(failed || (scores && scores.length === 0)) && <p className={`${SUB} p-5`}>{t.lbEmpty}</p>}
        {scores &&
          scores.map((s, i) => (
            <div
              key={s.user_id}
              className={`flex items-center gap-3 border-t border-[var(--line)] px-5 py-3 first:border-t-0 ${
                s.user_id === props.myId ? "bg-[var(--accent-soft)]" : ""
              }`}
            >
              <span className="w-7 text-center text-lg font-extrabold text-[var(--faint)]">{i + 1}</span>
              <span className="flex-1 font-semibold">{s.nick}</span>
              <span className="text-xs text-[var(--faint)]">{mapName(t.langCode, s.map)}</span>
              <span className="w-12 text-right text-lg font-extrabold text-[var(--accent)]">{s.score}</span>
            </div>
          ))}
      </section>
    </div>
  );
}
