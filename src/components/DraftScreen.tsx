"use client";
// TELA DO DRAFT. Serve para os dois modos:
//   - ao vivo (training = false): você marca tudo e o site recomenda;
//   - treino (training = true): o site joga pelo inimigo, com relógio e sem dicas;
//   - trio (room = código da sala): igual ao ao vivo, mas sincronizado entre os três do time.

import { useEffect, useMemo, useRef, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { nextTurn, recommend, suggestBans, type Side } from "@/lib/engine";
import { className, modeName, type Dict, type Lang } from "@/lib/i18n";
import { readRoom, writeRoom, type RoomState } from "@/lib/room";
import type { HistoryEntry, Personal } from "@/lib/storage";
import type { Brawler, GameMap } from "@/lib/types";
import { BrawlerGrid, CARD, Icon, MODE_COLOR, MapThumb, PANEL, Part, SmallButton, Strip, outline } from "./ui";

type Target = "ban" | "mine" | "enemy";

const MAX_BANS = 6;
const TEAM_SIZE = 3;
const TURN_SECONDS = 22;

/** Sorteia um item de uma lista. */
function randomOf<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** O que guardamos de cada escolha sua no treino, para dar a nota no fim. */
type TrainLog = { picked: string; best: string; ratio: number; timeout: boolean };

export default function DraftScreen(props: {
  t: Dict;
  lang: Lang;
  map: GameMap;
  training: boolean;
  owned: number[];
  onlyOwned: boolean;
  personal: Personal;
  onToggleOnlyOwned: () => void;
  onEditOwned: () => void;
  onChangeMap: () => void;
  onRestart: () => void; // recomeça o draft do zero
  onSave: (entry: HistoryEntry) => void;
  /** Código da sala de draft em trio (null = draft só neste aparelho). */
  room?: string | null;
  /** Estado inicial vindo da sala (quando alguém entra numa sala que já existe). */
  initial?: { state: RoomState; version: number } | null;
}) {
  const { t, lang, map, training } = props;
  const brawlers = BRAWLERS;
  const byId = useMemo(() => new Map(brawlers.map((b) => [b.id, b])), [brawlers]);

  // ----- Estado do draft -----
  // No treino, o inimigo já começa com 3 bans e o first pick é sorteado.
  const init = props.initial?.state;
  const [bans, setBans] = useState<number[]>(() =>
    init
      ? init.bans
      : training
      ? [...suggestBans(brawlers, map, [], 8)]
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((b) => b.id)
      : [],
  );
  const [first, setFirstLocal] = useState<Side>(() => init?.first ?? (training && Math.random() < 0.5 ? "enemy" : "mine"));
  const [mine, setMine] = useState<number[]>(init?.mine ?? []);
  const [enemies, setEnemies] = useState<number[]>(init?.enemies ?? []);
  const [bansDone, setBansDoneLocal] = useState(init?.bansDone ?? false);
  const [copied, setCopied] = useState(false);

  // ----- TRIO: sincronização com a sala -----
  // "version" conta as mudanças da sala. Quem tem o número maior tem o estado mais novo.
  const version = useRef(props.initial?.version ?? 1);
  const room = props.room ?? null;

  /** Troca todo o estado do draft de uma vez (usado ao receber a sala). */
  function applyState(st: RoomState) {
    setBans(st.bans);
    setMine(st.mine);
    setEnemies(st.enemies);
    setFirstLocal(st.first);
    setBansDoneLocal(st.bansDone);
  }

  /** Envia o estado novo para a sala, para os outros dois verem. */
  function push(changes: Partial<RoomState>) {
    if (!room) return;
    const next: RoomState = { mapId: map.id, first, bans, mine, enemies, bansDone, ...changes };
    version.current += 1;
    writeRoom(room, next, version.current);
  }

  // Lê a sala a cada 1,5 segundo e aplica se alguém do time mudou algo.
  useEffect(() => {
    if (!room) return;
    const timer = setInterval(async () => {
      const remote = await readRoom(room);
      if (remote && remote.version > version.current) {
        version.current = remote.version;
        applyState(remote.state);
      }
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  function setFirst(side: Side) {
    setFirstLocal(side);
    push({ first: side });
  }
  function setBansDone(done: boolean) {
    setBansDoneLocal(done);
    push({ bansDone: done });
  }
  const [manual, setManual] = useState<Target | null>(null); // faixa escolhida à mão (só ao vivo)
  const [open, setOpen] = useState<number | null>(null); // recomendação aberta
  const [showAll, setShowAll] = useState(false);
  const [left, setLeft] = useState(TURN_SECONDS); // segundos restantes (treino)
  const [log, setLog] = useState<TrainLog[]>([]);
  const [played, setPlayed] = useState<number | null>(null); // Brawler que você jogou
  const [savedResult, setSavedResult] = useState(false);

  // De quem é a vez, pela ordem do Ranked.
  const turn = nextTurn(first, mine.length, enemies.length);
  const auto: Target | null = !bansDone && bans.length < MAX_BANS ? "ban" : turn;
  const target = training ? auto : (manual ?? auto);
  const finished = auto === null;

  const filterOn = !training && props.onlyOwned && props.owned.length > 0;
  const used = new Set([...bans, ...mine, ...enemies]);

  // O ranking é recalculado sempre que algo muda.
  const ranking = useMemo(
    () =>
      recommend({
        brawlers,
        map,
        bans,
        mine,
        enemies,
        lang,
        personal: training ? undefined : props.personal,
        allowed: filterOn ? new Set(props.owned) : undefined,
      }),
    [brawlers, map, bans, mine, enemies, lang, training, props.personal, filterOn, props.owned],
  );
  const banIdeas = useMemo(() => suggestBans(brawlers, map, bans), [brawlers, map, bans]);

  function add(id: number, where: Target | null, timeout = false) {
    if (!where || used.has(id)) return;
    if (where === "ban" && bans.length < MAX_BANS) {
      setBans([...bans, id]);
      push({ bans: [...bans, id] });
    }
    if (where === "enemy" && enemies.length < TEAM_SIZE) {
      setEnemies([...enemies, id]);
      push({ enemies: [...enemies, id] });
    }
    if (where === "mine" && mine.length < TEAM_SIZE) {
      if (training) {
        // Guarda o quanto a sua escolha ficou perto da melhor opção do momento.
        const best = ranking[0];
        const chosen = ranking.find((r) => r.brawler.id === id);
        if (best && chosen) {
          const ratio = Math.max(0, Math.min(1, chosen.score / best.score));
          setLog([...log, { picked: chosen.brawler.name, best: best.brawler.name, ratio, timeout }]);
        }
      }
      setMine([...mine, id]);
      push({ mine: [...mine, id] });
    }
    setManual(null);
    setOpen(null);
  }

  function remove(id: number) {
    const next = {
      bans: bans.filter((x) => x !== id),
      mine: mine.filter((x) => x !== id),
      enemies: enemies.filter((x) => x !== id),
    };
    setBans(next.bans);
    setMine(next.mine);
    setEnemies(next.enemies);
    push(next);
  }

  function copyLink() {
    if (!room) return;
    const link = `${window.location.origin}/?sala=${room}`;
    navigator.clipboard?.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  // ----- TREINO: relógio -----
  // "turnKey" muda toda vez que a vez passa. Quando muda, o relógio recomeça.
  const turnKey = `${target}-${bans.length >= MAX_BANS || bansDone}-${mine.length}-${enemies.length}`;
  const clockOn = training && (target === "ban" || target === "mine");

  useEffect(() => {
    if (!clockOn) return;
    setLeft(TURN_SECONDS);
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, clockOn]);

  // Quando o tempo acaba: encerra os bans ou sorteia um pick, como no jogo.
  useEffect(() => {
    if (!clockOn || left > 0) return;
    if (target === "ban") setBansDone(true);
    if (target === "mine") {
      const free = brawlers.filter((b) => !used.has(b.id));
      if (free.length > 0) add(randomOf(free).id, "mine", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  // ----- TREINO: o inimigo escolhe sozinho -----
  useEffect(() => {
    if (!training || target !== "enemy") return;
    const timer = setTimeout(() => {
      // Mesmo motor de recomendação, visto do lado do inimigo.
      const options = recommend({ brawlers, map, bans, mine: enemies, enemies: mine }).slice(0, 3);
      if (options.length > 0) add(randomOf(options).brawler.id, "enemy");
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training, turnKey]);

  const status =
    target === "ban"
      ? t.statusBan
      : target === "mine"
        ? t.statusMine
        : target === "enemy"
          ? training
            ? t.statusEnemyAI
            : t.statusEnemy
          : t.statusDone;

  const top = ranking.slice(0, showAll ? 15 : 5);
  const myBans = training ? Math.max(0, bans.length - 3) : bans.length; // só para o texto do treino

  // Nota final do treino (0 a 100) e a letra correspondente.
  const grade = log.length > 0 ? Math.round((log.reduce((sum, l) => sum + l.ratio, 0) / log.length) * 100) : 0;
  const letter = grade >= 95 ? "S" : grade >= 88 ? "A" : grade >= 78 ? "B" : grade >= 65 ? "C" : "D";

  function saveResult(win: boolean) {
    const me = played !== null ? byId.get(played) : undefined;
    if (!me) return;
    const names = (ids: number[]) => ids.map((id) => byId.get(id)?.name ?? "?");
    props.onSave({
      date: new Date().toISOString(),
      map: map.name,
      mode: map.mode,
      played: me.name,
      team: names(mine),
      enemies: names(enemies),
      win,
    });
    setSavedResult(true);
  }

  return (
    <div>
      {/* Cabeçalho: mapa, modo e botões */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <MapThumb map={map} width={44} />
          <div>
          <h1 className="text-3xl leading-tight text-[var(--accent)]" style={outline}>
            {map.name}
          </h1>
          <p className="flex items-center gap-2 text-sm text-[var(--soft)]">
            <span className="h-3 w-3 rounded-full border border-black" style={{ background: MODE_COLOR[map.mode] }} />
            {modeName(lang, map.mode)}
            {training && <span className="rounded bg-[var(--accent)] px-2 text-black">{t.training}</span>}
          </p>
          </div>
        </div>
        <div className="flex gap-2">
          <SmallButton onClick={props.onRestart}>{training ? t.trainAgain : t.newDraft}</SmallButton>
          <SmallButton onClick={props.onChangeMap}>{t.changeMap}</SmallButton>
        </div>
      </div>

      {/* TRIO: código da sala e botão para copiar o link */}
      {room && (
        <div className={`${PANEL} mt-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2`}>
          <span className="text-white">
            {t.roomCode}: <span className="text-2xl tracking-widest text-[var(--accent)]">{room}</span>
          </span>
          <SmallButton onClick={copyLink}>{copied ? t.linkCopied : t.copyLink}</SmallButton>
          <span className="w-full font-sans text-xs text-[var(--soft)]">{t.roomHelp}</span>
        </div>
      )}

      {/* Quem tem o first pick (no treino é sorteado, então só mostra) */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white">
        <span>{t.firstPick}:</span>
        {(["mine", "enemy"] as Side[]).map((s) => (
          <button
            key={s}
            disabled={training}
            onClick={() => setFirst(s)}
            className={`rounded-lg border-2 px-3 py-1 ${
              first === s ? "border-black bg-[var(--accent)] text-black" : "border-[var(--line)] bg-[var(--panel)] text-white"
            }`}
          >
            {s === "mine" ? t.myTeam : t.enemy}
          </button>
        ))}
      </div>

      {/* As três faixas: banidos, meu time e inimigos */}
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Strip title={t.banned} color="#8a8a94" ids={bans} size={MAX_BANS} active={target === "ban"} byId={byId}
          onSelect={training ? undefined : () => setManual("ban")} onRemove={training ? undefined : remove} />
        <Strip title={t.myTeam} color="#4da3ff" ids={mine} size={TEAM_SIZE} active={target === "mine"} byId={byId}
          onSelect={training ? undefined : () => setManual("mine")} onRemove={training ? undefined : remove} />
        <Strip title={t.enemies} color="#ff5252" ids={enemies} size={TEAM_SIZE} active={target === "enemy"} byId={byId}
          onSelect={training ? undefined : () => setManual("enemy")} onRemove={training ? undefined : remove} />
      </div>

      {/* Aviso de quem é a vez (e o relógio, no treino) */}
      <div className={`${PANEL} mt-3 flex items-center justify-between gap-2 px-3 py-2`}>
        <span className="text-white">
          {status}
          {training && target === "ban" ? ` (${myBans}/3)` : ""}
        </span>
        {clockOn && (
          <span
            className={`rounded-lg border-2 border-black px-3 py-1 text-xl ${left <= 5 ? "bg-red-500 text-white" : "bg-[var(--accent)] text-black"}`}
          >
            {t.seconds(Math.max(0, left))}
          </span>
        )}
        {!training && target === "ban" && !bansDone && <SmallButton onClick={() => setBansDone(true)}>{t.bansDone}</SmallButton>}
      </div>

      {training && !finished && <p className="mt-2 font-sans text-xs text-[var(--soft)]">{t.trainIntro}</p>}

      {/* TREINO TERMINADO: nota e revisão de cada escolha */}
      {training && finished && (
        <section className={`${CARD} mt-4 p-4`}>
          <h2 className="text-xl text-white" style={outline}>
            {t.trainResult}
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-xl border-2 border-black bg-[var(--accent)] px-4 py-2 text-4xl text-black">{letter}</span>
            <span className="text-white">
              {t.trainGrade}: {grade}/100
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1 font-sans text-sm text-[var(--soft)]">
            {log.map((l, i) => (
              <span key={i}>
                {i + 1}. {t.yourPick}: <b className="text-white">{l.picked}</b> ({Math.round(l.ratio * 100)}/100)
                {l.timeout ? ` · ${t.timeout}` : ""}
                {l.picked !== l.best ? ` · ${t.bestOption}: ${l.best}` : ""}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <SmallButton onClick={props.onRestart}>{t.trainAgain}</SmallButton>
          </div>
        </section>
      )}

      {/* AO VIVO, DRAFT COMPLETO: salvar o resultado no histórico */}
      {!training && finished && (
        <section className={`${CARD} mt-4 p-4`}>
          <h2 className="text-xl text-white" style={outline}>
            {t.saveResult}
          </h2>
          {savedResult ? (
            <p className="mt-2 font-sans text-sm text-green-300">{t.saved}</p>
          ) : (
            <div>
              <p className="mt-1 font-sans text-sm text-[var(--soft)]">{t.whoPlayed}</p>
              <div className="mt-2 flex items-center gap-2">
                {mine.map((id) => {
                  const b = byId.get(id);
                  if (!b) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setPlayed(id)}
                      className={`rounded-xl border-2 p-1 ${played === id ? "border-[var(--accent)]" : "border-transparent opacity-60"}`}
                    >
                      <Icon brawler={b} size={52} />
                    </button>
                  );
                })}
                <button
                  disabled={played === null}
                  onClick={() => saveResult(true)}
                  className="rounded-lg border-2 border-black bg-green-400 px-3 py-2 text-black disabled:opacity-40"
                >
                  {t.win}
                </button>
                <button
                  disabled={played === null}
                  onClick={() => saveResult(false)}
                  className="rounded-lg border-2 border-black bg-red-400 px-3 py-2 text-black disabled:opacity-40"
                >
                  {t.loss}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* AO VIVO, FASE DE BANS: sugestões de quem banir */}
      {!training && target === "ban" && (
        <section className="mt-4">
          <h2 className="text-xl text-white" style={outline}>
            {t.banIdeas}
          </h2>
          <p className="font-sans text-xs text-[var(--soft)]">{t.banIdeasSub}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {banIdeas.map((b) => (
              <button
                key={b.id}
                onClick={() => add(b.id, "ban")}
                className={`${CARD} flex flex-col items-center gap-1 p-2 transition hover:brightness-125 active:scale-95`}
              >
                <Icon brawler={b} size={52} />
                <span className="w-full truncate text-center text-xs text-white">{b.name}</span>
                <span className="font-sans text-[10px] text-[var(--soft)]">
                  {map.top.includes(b.name) ? t.topOfMap(map.top.indexOf(b.name) + 1) : `Tier ${b.tier}`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* AO VIVO, FASE DE PICKS: melhores escolhas */}
      {!training && target !== "ban" && !finished && (
        <section className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl text-white" style={outline}>
              {t.bestPicks}
            </h2>
            <div className="flex gap-2">
              <SmallButton onClick={props.onToggleOnlyOwned}>{props.onlyOwned ? t.onlyMineOn : t.onlyMineOff}</SmallButton>
              <SmallButton onClick={props.onEditOwned}>{t.myBrawlers}</SmallButton>
            </div>
          </div>
          {props.onlyOwned && props.owned.length === 0 && (
            <p className="mt-1 font-sans text-xs text-[var(--soft)]">{t.onlyMineEmpty}</p>
          )}
          <div className="mt-2 flex flex-col gap-2">
            {top.map((r, i) => (
              <div key={r.brawler.id} className={CARD}>
                <button
                  onClick={() => setOpen(open === r.brawler.id ? null : r.brawler.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span className="w-6 text-center text-2xl text-[var(--accent)]" style={outline}>
                    {i + 1}
                  </span>
                  <Icon brawler={r.brawler} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg leading-tight text-white">
                      {r.brawler.name}{" "}
                      <span className="font-sans text-xs text-[var(--soft)]">{className(lang, r.brawler.class)}</span>
                    </span>
                    <span className="block font-sans text-xs text-[var(--soft)]">{r.reasons.join(" · ")}</span>
                  </span>
                  <span className="rounded-lg border-2 border-black bg-[var(--accent)] px-2 py-1 text-black">{r.score.toFixed(1)}</span>
                </button>

                {/* Detalhe: de onde veio a nota */}
                {open === r.brawler.id && (
                  <div className="border-t-2 border-[var(--line)] px-3 py-2 font-sans text-sm text-[var(--soft)]">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      <Part label={t.partBase} value={r.parts.base} />
                      <Part label={t.partMap} value={r.parts.map} />
                      <Part label={t.partCounter} value={r.parts.counter} />
                      <Part label={t.partSynergy} value={r.parts.synergy} />
                      <Part label={t.partComp} value={r.parts.comp} />
                      <Part label={t.partRisk} value={r.parts.risk} />
                      <Part label={t.partPersonal} value={r.parts.personal} />
                    </div>
                    {mine.length < TEAM_SIZE && (
                      <button
                        onClick={() => add(r.brawler.id, "mine")}
                        className="mt-2 rounded-lg border-2 border-black bg-[var(--accent)] px-3 py-1 text-black"
                      >
                        {t.addToTeam}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {ranking.length > 5 && (
            <div className="mt-2 flex justify-center">
              <SmallButton onClick={() => setShowAll(!showAll)}>{showAll ? t.seeLess : t.seeMore}</SmallButton>
            </div>
          )}
        </section>
      )}

      {/* Grade com todos os Brawlers */}
      {!finished && (
        <section className="mt-5">
          <BrawlerGrid
            brawlers={brawlers}
            placeholder={t.searchBrawler}
            state={(b: Brawler) => (used.has(b.id) ? "dim" : "normal")}
            disabled={(b: Brawler) => used.has(b.id) || !target || (training && target === "enemy")}
            onPick={(b: Brawler) => add(b.id, target)}
          />
        </section>
      )}
    </div>
  );
}
