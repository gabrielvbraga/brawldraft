"use client";
// PARTIDA EM ANDAMENTO
// Depois do draft ao vivo, o site fica esperando a partida acabar: a cada 20 segundos
// olha as partidas de Ranked da sua tag. Quando a partida (melhor de 3) termina,
// mostra o resultado e salva no histórico sozinho.

import { useEffect, useRef, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { lossReasons } from "@/lib/engine";
import type { Dict, Lang } from "@/lib/i18n";
import type { Match } from "@/lib/matches";
import { findLiveMatch, type PendingDraft } from "@/lib/pending";
import { save, type HistoryEntry } from "@/lib/storage";
import type { GameMap } from "@/lib/types";
import { CARD, Icon, SmallButton } from "./ui";

const EVERY = 20_000; // olha a cada 20 segundos
const GIVE_UP = 45 * 60_000; // depois de 45 minutos, para de olhar (a sincronização normal pega depois)
const BY_ID = new Map(BRAWLERS.map((b) => [b.id, b]));
const name = (id: number) => BY_ID.get(id)?.name ?? "?";

export function MatchWatch(props: {
  t: Dict;
  lang: Lang;
  map: GameMap;
  tag: string;
  mine: number[];
  followed: Record<number, boolean>;
  onSave: (entry: HistoryEntry) => void;
  onManual: () => void;
}) {
  const { t, lang, map } = props;
  const pending = useRef<PendingDraft>({ mapGameId: map.gameId, mine: props.mine, at: Date.now(), followed: props.followed });
  const [partial, setPartial] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<HistoryEntry | null>(null);
  const [checking, setChecking] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const done = useRef(false);

  async function check() {
    if (done.current) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/battles?tag=${encodeURIComponent(props.tag)}`, { cache: "no-store" });
      const json = (await res.json()) as { items?: Match[] };
      const m = res.ok && json.items ? findLiveMatch(json.items, pending.current) : null;
      if (m && m.done && !done.current) {
        done.current = true;
        const entry: HistoryEntry = {
          date: m.date,
          map: map.name,
          mode: map.mode,
          played: name(m.played),
          team: m.team.map(name),
          enemies: m.enemies.map(name),
          win: m.win,
          rounds: m.rounds,
          ...(m.rank !== undefined ? { rank: m.rank } : {}),
          source: "auto",
          ...(m.played in pending.current.followed ? { followed: pending.current.followed[m.played] } : {}),
        };
        save("bd-pending-draft", null);
        setResult(entry);
        props.onSave(entry);
      } else if (m) setPartial(m.rounds);
    } catch {
      // sem internet: tenta de novo na próxima volta
    }
    setChecking(false);
  }

  useEffect(() => {
    // Guarda o draft: se o site for fechado durante a partida, o resultado é ligado a ele depois.
    save("bd-pending-draft", pending.current);
    const start = pending.current.at;
    const timer = setInterval(() => {
      const passed = Date.now() - start;
      setMinutes(Math.floor(passed / 60_000));
      if (passed > GIVE_UP) {
        setGaveUp(true);
        clearInterval(timer);
        return;
      }
      if (document.visibilityState === "visible") check();
    }, EVERY);
    // Voltou para o site (depois de jogar)? Olha na hora.
    const onShow = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- RESULTADO -----
  if (result) {
    const me = BRAWLERS.find((b) => b.name === result.played);
    const [w, l] = result.rounds ?? [result.win ? 1 : 0, result.win ? 0 : 1];
    return (
      <section
        className={`${CARD} overflow-hidden border-2 p-5 ${result.win ? "border-[var(--good)]" : "border-[var(--bad)]"}`}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-4">
          {me && <Icon brawler={me} size={64} />}
          <div className="min-w-0 flex-1">
            <h2 className={`text-2xl font-extrabold tracking-tight ${result.win ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
              {result.win ? t.resWin : t.resLoss}
            </h2>
            <p className="font-semibold">{t.resScore(w, l)}</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[var(--soft)]">
          <li>{t.resPlayed(result.played)}</li>
          {result.followed !== undefined && <li>{result.followed ? t.resFollowed : t.resNotFollowed}</li>}
          <li className="text-[var(--good)]">{t.resSaved}</li>
        </ul>
        {!result.win && (
          <div className="mt-3 rounded-xl bg-[var(--sunken)] p-3 text-sm">
            <p className="font-semibold">{t.lossTitle}</p>
            <ul className="mt-1 list-disc pl-5 text-[var(--soft)]">
              {lossReasons(result, BRAWLERS, map, lang).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // ----- ESPERANDO A PARTIDA -----
  return (
    <section className={`${CARD} p-5`} aria-live="polite">
      <div className="flex items-center gap-4">
        {!gaveUp && (
          <span
            className="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]"
            role="status"
            aria-label={t.watchTitle}
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{t.watchTitle}</h2>
          <p className="text-sm text-[var(--soft)]">{gaveUp ? t.watchTimeout : t.watchSub}</p>
        </div>
        {!gaveUp && <span className="text-sm font-semibold text-[var(--faint)]">{t.elapsed(minutes)}</span>}
      </div>
      {partial && <p className="mt-3 text-sm font-semibold">{t.watchPartial(partial[0], partial[1])}</p>}
      <p className="mt-3 text-xs text-[var(--faint)]">{t.watchNote}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SmallButton onClick={check} disabled={checking}>
          {checking ? t.watchChecking : t.watchCheck}
        </SmallButton>
        <SmallButton onClick={props.onManual}>{t.watchManual}</SmallButton>
      </div>
    </section>
  );
}
