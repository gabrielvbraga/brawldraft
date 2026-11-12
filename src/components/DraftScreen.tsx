"use client";
// TELA DO DRAFT. Serve para três modos:
//   - ao vivo (training = false): você marca tudo e o site recomenda;
//   - treino (training = true): o site joga pelo inimigo, com relógio e sem dicas;
//   - trio (room = código da sala): igual ao ao vivo, mas sincronizado entre os três do time.
// Extras: modo duo (você + amigo), alerta de armadilha, dica do mapa e nota final do draft.

import { useEffect, useMemo, useRef, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { bestPairs, draftGrade, mapTip, nextTurn, recommend, suggestBans, type PickStage, type Side } from "@/lib/engine";
import { className, mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import { readRoom, writeRoom, type RoomState } from "@/lib/room";
import type { HistoryEntry, Personal } from "@/lib/storage";
import type { Brawler, GameMap } from "@/lib/types";
import { draftCard } from "@/lib/share";
import { save } from "@/lib/storage";
import { ShareButton } from "./extras";
import { MatchWatch } from "./matchwatch";
import { BrawlerGrid, CARD, INPUT, Icon, MODE_COLOR, MapImage, PANEL, Part, Pill, PrimaryButton, SmallButton, Strip, choice } from "./ui";

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
  /** Bônus de conforto por Brawler (troféus do jogador). */
  comfort: Record<number, number>;
  /** Grava a nota do treino no placar (só faz algo se a pessoa estiver logada). */
  onTrainScore: (score: number, mapName: string) => void;
  onToggleOnlyOwned: () => void;
  onEditOwned: () => void;
  onChangeMap: () => void;
  onRestart: () => void; // recomeça o draft do zero
  onSave: (entry: HistoryEntry) => void;
  /** Tag do jogador: com ela, o site descobre sozinho o resultado da partida. */
  tag?: string;
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
  const [options, setOptions] = useState(false); // painel "Opções" (first pick, solo/duo, dica, filtros)
  // MODO RÁPIDO (celular): tela enxuta com botões grandes. Lembra a escolha neste aparelho.
  const [quick, setQuickState] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("bd-quick") === "1";
    } catch {
      return false;
    }
  });
  function setQuick(on: boolean) {
    setQuickState(on);
    try {
      localStorage.setItem("bd-quick", on ? "1" : "0");
    } catch {
      // sem armazenamento: vale só agora
    }
  }
  const [stack, setStack] = useState<number[]>([]); // ordem das escolhas (para o "Desfazer")
  const [quickSearch, setQuickSearch] = useState(false);
  const [left, setLeft] = useState(TURN_SECONDS); // segundos restantes (treino)
  const [log, setLog] = useState<TrainLog[]>([]);
  const [played, setPlayed] = useState<number | null>(null); // Brawler que você jogou
  const [savedResult, setSavedResult] = useState(false);
  // DUO: você + um amigo escolhem juntos.
  const [duo, setDuo] = useState(false);
  const [friendTag, setFriendTag] = useState("");
  const [friendOwned, setFriendOwned] = useState<Set<number> | null>(null);
  const [friendMsg, setFriendMsg] = useState<string | null>(null);
  const [scoreSent, setScoreSent] = useState(false);
  // Para "as sugestões funcionam?": cada pick seu era uma das 3 primeiras sugestões?
  const [followed, setFollowed] = useState<Record<number, boolean>>({});
  const [manualResult, setManualResult] = useState(false); // marcar o resultado na mão

  // De quem é a vez, pela ordem do Ranked.
  const turn = nextTurn(first, mine.length, enemies.length);
  const auto: Target | null = !bansDone && bans.length < MAX_BANS ? "ban" : turn;
  const target = training ? auto : (manual ?? auto);
  const finished = auto === null;
  // Draft "sem bans" (escolhido no início): esconde a faixa de banidos.
  const noBans = !training && bansDone && bans.length === 0 && manual !== "ban";

  const filterOn = !training && props.onlyOwned && props.owned.length > 0;
  const used = new Set([...bans, ...mine, ...enemies]);

  // O ranking é recalculado sempre que algo muda.
  // Em que momento do draft está o SEU próximo pick (pela ordem 1-2-2-1).
  const pickIndex = mine.length + enemies.length; // 0 a 5
  const stage: PickStage = pickIndex === 0 ? "first" : pickIndex === 5 ? "last" : "middle";

  const ranking = useMemo(
    () =>
      recommend({
        stage,
        brawlers,
        map,
        bans,
        mine,
        enemies,
        lang,
        personal: training ? undefined : props.personal,
        comfort: training ? undefined : props.comfort,
        allowed: filterOn ? new Set(props.owned) : undefined,
      }),
    [brawlers, map, bans, mine, enemies, lang, training, props.personal, props.comfort, filterOn, props.owned, stage],
  );
  // Ranking sem filtro de Brawlers (o amigo do duo pode ter outros).
  const rankingAll = useMemo(
    () => recommend({ stage, brawlers, map, bans, mine, enemies, lang, personal: props.personal, comfort: props.comfort }),
    [brawlers, map, bans, mine, enemies, lang, props.personal, props.comfort, stage],
  );
  // Picks prováveis do inimigo: o mesmo motor, visto do lado deles.
  const enemyIdeas = useMemo(
    () => recommend({ brawlers, map, bans, mine: enemies, enemies: mine, lang }).slice(0, 5),
    [brawlers, map, bans, mine, enemies, lang],
  );
  const banIdeas = useMemo(() => suggestBans(brawlers, map, bans), [brawlers, map, bans]);

  function add(id: number, where: Target | null, timeout = false) {
    if (!where || used.has(id)) return;
    setStack((st) => [...st, id]);
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
      if (!training) setFollowed({ ...followed, [id]: ranking.slice(0, 3).some((r) => r.brawler.id === id) });
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

  /** Carrega os Brawlers nível 11 do amigo (para as duplas). */
  async function loadFriend() {
    setFriendMsg(null);
    try {
      const res = await fetch(`/api/player?tag=${encodeURIComponent(friendTag)}`);
      const data = (await res.json()) as { brawlers?: { id: number; power: number }[]; error?: string };
      if (!res.ok || !data.brawlers) {
        setFriendMsg(t.importErr(data.error ?? "api"));
        return;
      }
      const ids = new Set(data.brawlers.filter((b) => b.power >= 11).map((b) => b.id));
      setFriendOwned(ids);
      setFriendMsg(t.friendLoaded(ids.size));
    } catch {
      setFriendMsg(t.importErr("api"));
    }
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

  const top = ranking.slice(0, showAll ? 15 : 3);
  const myBans = training ? Math.max(0, bans.length - 3) : bans.length; // só para o texto do treino

  // Nota final do treino (0 a 100) e a letra correspondente.
  const grade = log.length > 0 ? Math.round((log.reduce((sum, l) => sum + l.ratio, 0) / log.length) * 100) : 0;
  const letter = grade >= 95 ? "S" : grade >= 88 ? "A" : grade >= 78 ? "B" : grade >= 65 ? "C" : "D";

  // TREINO: quando termina, manda a nota para o placar (uma vez).
  useEffect(() => {
    if (training && finished && log.length > 0 && !scoreSent) {
      setScoreSent(true);
      props.onTrainScore(grade, map.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training, finished, log.length]);

  // Nota final do draft ao vivo (chance estimada de vitória).
  const finalGrade = useMemo(() => {
    if (!finished) return null;
    const team = mine.map((id) => byId.get(id)).filter((b): b is Brawler => !!b);
    const foes = enemies.map((id) => byId.get(id)).filter((b): b is Brawler => !!b);
    return team.length === 3 && foes.length === 3 ? draftGrade(team, foes, map, lang) : null;
  }, [finished, mine, enemies, byId, map, lang]);

  // DUO: melhores pares (você + amigo) quando o seu time escolhe.
  const pairs = useMemo(
    () => (duo && target === "mine" ? bestPairs(rankingAll, filterOn ? new Set(props.owned) : null, friendOwned) : []),
    [duo, target, rankingAll, filterOn, props.owned, friendOwned],
  );
  const tip = mapTip(map);

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
      source: "manual",
      ...(played !== null && played in followed ? { followed: followed[played] } : {}),
    });
    setSavedResult(true);
    save("bd-pending-draft", null);
  }

  const stageTitle = stage === "first" ? t.stageFirst : stage === "last" ? t.stageLast : t.stageMiddle;
  const stageTip = stage === "first" ? t.stageFirstTip : stage === "last" ? t.stageLastTip : t.stageMiddleTip;

  // ================= MODO RÁPIDO =================
  if (quick && !training) {
    const undo = () => {
      const last = [...stack].reverse().find((id) => used.has(id));
      if (last === undefined) return;
      remove(last);
      setStack(stack.filter((id) => id !== last));
    };
    const banner =
      target === "mine"
        ? { bg: "var(--accent)", text: t.quickYour(mine.length + 1) }
        : target === "enemy"
          ? { bg: "var(--bad)", text: t.quickEnemy(enemies.length + 1) }
          : target === "ban"
            ? { bg: "#6b7280", text: t.quickBans(bans.length, MAX_BANS) }
            : { bg: "var(--good)", text: t.statusDone };
    const big = (b: Brawler, onClick: () => void, sub?: string, score?: string, best = false) => (
      <button
        key={b.id}
        onClick={onClick}
        className={`${CARD} flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.98] ${best ? "ring-2 ring-[var(--accent)]" : ""}`}
      >
        <Icon brawler={b} size={64} />
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-extrabold leading-tight">{b.name}</span>
          {sub && <span className="block truncate text-xs text-[var(--soft)]">{sub}</span>}
        </span>
        {score && <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-lg font-bold text-[var(--accent)]">{score}</span>}
      </button>
    );
    const slots = (ids: number[], n: number, color: string, size: number) => (
      <div className="flex gap-1.5">
        {Array.from({ length: n }, (_, i) => {
          const b = ids[i] !== undefined ? byId.get(ids[i]) : undefined;
          return b ? (
            <Icon key={i} brawler={b} size={size} />
          ) : (
            <span key={i} className="rounded-lg border-2 border-dashed" style={{ width: size, height: size, borderColor: color, opacity: 0.4 }} />
          );
        })}
      </div>
    );
    const showSearch = quickSearch || target === "enemy" || target === "ban";
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3">
        {/* Topo: mapa, sair, desfazer */}
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">⚡ {t.quickMode}</span>
            <span className="block truncate font-bold">
              {mapName(lang, map.name)} · <span className="font-normal text-[var(--soft)]">{modeName(lang, map.mode)}</span>
            </span>
          </span>
          <SmallButton onClick={undo} disabled={stack.length === 0}>↶ {t.undo}</SmallButton>
          <SmallButton onClick={() => setQuick(false)}>{t.quickExit}</SmallButton>
        </div>

        {/* De quem é a vez */}
        <div className="rounded-2xl px-4 py-3 text-center text-lg font-extrabold text-white" style={{ background: banner.bg }}>
          {banner.text}
        </div>

        {/* Times */}
        <div className={`${CARD} flex items-center justify-between gap-2 p-3`}>
          {slots(mine, TEAM_SIZE, "var(--accent)", 46)}
          <span className="text-xs font-bold text-[var(--faint)]">VS</span>
          {slots(enemies, TEAM_SIZE, "var(--bad)", 46)}
        </div>
        {bans.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">{t.banned}</span>
            <div className="flex gap-1 opacity-60">{bans.map((id) => byId.get(id) && <Icon key={id} brawler={byId.get(id) as Brawler} size={26} />)}</div>
          </div>
        )}

        {/* Sua vez: as 3 melhores, um toque escolhe */}
        {target === "mine" && (
          <div className="flex flex-col gap-2">
            {ranking.slice(0, 3).map((r, i) => big(r.brawler, () => add(r.brawler.id, "mine"), r.reasons[0], r.score.toFixed(1), i === 0))}
            {!quickSearch && (
              <button onClick={() => setQuickSearch(true)} className="py-2 text-sm font-semibold text-[var(--accent)]">
                {t.quickOther}
              </button>
            )}
          </div>
        )}

        {/* Vez do inimigo: os prováveis primeiro */}
        {target === "enemy" && (
          <div className="grid grid-cols-4 gap-2">
            {enemyIdeas.slice(0, 4).map((r) => (
              <button key={r.brawler.id} onClick={() => add(r.brawler.id, "enemy")} className={`${CARD} flex flex-col items-center gap-1 p-2 active:scale-95`}>
                <Icon brawler={r.brawler} size={52} />
                <span className="w-full truncate text-center text-xs font-semibold">{r.brawler.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Bans: os mais fortes no mapa primeiro */}
        {target === "ban" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              {banIdeas.slice(0, 4).map((b) => (
                <button key={b.id} onClick={() => add(b.id, "ban")} className={`${CARD} flex flex-col items-center gap-1 p-2 active:scale-95`}>
                  <Icon brawler={b} size={52} />
                  <span className="w-full truncate text-center text-xs font-semibold">{b.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setBansDone(true)} className="py-1 text-sm font-semibold text-[var(--accent)]">
              {t.bansDone}
            </button>
          </div>
        )}

        {/* Procurar qualquer Brawler */}
        {!finished && showSearch && (
          <BrawlerGrid
            brawlers={brawlers}
            placeholder={t.searchBrawler}
            state={(b: Brawler) => (used.has(b.id) ? "dim" : "normal")}
            disabled={(b: Brawler) => used.has(b.id) || !target}
            onPick={(b: Brawler) => {
              add(b.id, target);
              setQuickSearch(false);
            }}
          />
        )}

        {/* Fim: nota e partida em andamento */}
        {finished && finalGrade && (
          <div className={`${CARD} flex items-center gap-4 p-4`}>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-3xl font-extrabold text-white">{finalGrade.letter}</span>
            <span>
              <span className="block font-bold">{t.gTitle}</span>
              <span className="text-sm text-[var(--soft)]">{t.gChance(finalGrade.chance)}</span>
            </span>
          </div>
        )}
        {finished && props.tag && (
          <MatchWatch t={t} lang={lang} map={map} tag={props.tag} mine={mine} followed={followed} onSave={props.onSave} onManual={() => setQuick(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho: foto do mapa, nome, modo e botões */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-28 shrink-0 sm:w-36">
            <MapImage map={map} height={150} zoomLabel={t.zoomMap} closeLabel={t.close} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{mapName(lang, map.name)}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--soft)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODE_COLOR[map.mode] }} />
              {modeName(lang, map.mode)}
              {training && <Pill>{t.training}</Pill>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!training && <SmallButton onClick={() => setQuick(true)}>⚡ {t.quickMode}</SmallButton>}
          {!training && (
            <SmallButton onClick={() => setOptions(!options)}>
              {options ? "✕ " : "⚙ "}
              {t.options}
            </SmallButton>
          )}
          <SmallButton onClick={props.onRestart}>{training ? t.trainAgain : t.newDraft}</SmallButton>
          <SmallButton onClick={props.onChangeMap}>{t.changeMap}</SmallButton>
        </div>
      </div>

      {/* OPÇÕES (escondidas para a tela ficar limpa): dica do mapa, first pick, solo/duo e filtros */}
      {!training && options && (
        <div className={`${PANEL} flex flex-col gap-3 p-4`}>
      {tip && !training && (
          <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-sm">
            <strong>{t.mapTipTitle}:</strong> {tip}
          </p>
        )}
  
  
        {/* First pick e modo solo/duo */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-[var(--soft)]">{t.firstPick}:</span>
          {(["mine", "enemy"] as Side[]).map((s) => (
            <button key={s} disabled={training} onClick={() => setFirst(s)} className={choice(first === s)}>
              {s === "mine" ? t.myTeam : t.enemy}
            </button>
          ))}
          {!training && (
            <>
              <span className="ml-2 font-semibold text-[var(--soft)]">·</span>
              <button onClick={() => setDuo(false)} className={choice(!duo)}>
                {t.modeSolo}
              </button>
              <button onClick={() => setDuo(true)} className={choice(duo)}>
                {t.modeDuo}
              </button>
            </>
          )}
        </div>
  
        {duo && !training && (
          <div className={`${PANEL} flex flex-wrap items-center gap-2 p-3`}>
            <span className="text-sm text-[var(--soft)]">{t.duoHelp}</span>
            <input value={friendTag} onChange={(e) => setFriendTag(e.target.value)} placeholder={t.friendTag} className={`${INPUT} w-44 uppercase`} />
            <SmallButton onClick={loadFriend} disabled={!friendTag.trim()}>
              {t.loadFriend}
            </SmallButton>
            {friendMsg && <span className="text-xs font-medium text-[var(--soft)]">{friendMsg}</span>}
          </div>
        )}
          <div className="flex flex-wrap gap-2">
            <SmallButton onClick={props.onToggleOnlyOwned}>{props.onlyOwned ? t.onlyMineOn : t.onlyMineOff}</SmallButton>
            <SmallButton onClick={props.onEditOwned}>{t.myBrawlers}</SmallButton>
          </div>
        </div>
      )}

      {/* TRIO: código da sala e botão para copiar o link */}
      {room && (
        <div className={`${PANEL} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}>
          <span>
            {t.roomCode}: <span className="text-2xl font-extrabold tracking-widest text-[var(--accent)]">{room}</span>
          </span>
          <SmallButton onClick={copyLink}>{copied ? t.linkCopied : t.copyLink}</SmallButton>
          <span className="w-full text-xs text-[var(--soft)]">{t.roomHelp}</span>
        </div>
      )}

      {/* As três faixas: banidos, meu time e inimigos */}
      <div className={`grid gap-2 ${noBans ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {!noBans && (
          <Strip title={t.banned} color="#8a91a1" ids={bans} size={MAX_BANS} active={target === "ban"} byId={byId}
            onSelect={training ? undefined : () => setManual("ban")} onRemove={training ? undefined : remove} />
        )}
        <Strip title={t.myTeam} color="#2f80ed" ids={mine} size={TEAM_SIZE} active={target === "mine"} byId={byId}
          onSelect={training ? undefined : () => setManual("mine")} onRemove={training ? undefined : remove} />
        <Strip title={t.enemies} color="#e5533c" ids={enemies} size={TEAM_SIZE} active={target === "enemy"} byId={byId}
          onSelect={training ? undefined : () => setManual("enemy")} onRemove={training ? undefined : remove} />
      </div>

      {/* Aviso de quem é a vez (e o relógio, no treino) */}
      <div className={`${PANEL} flex items-center justify-between gap-2 px-4 py-3`}>
        <span className="font-semibold">
          {status}
          {training && target === "ban" ? ` (${myBans}/3)` : ""}
        </span>
        {clockOn && (
          <span className={`rounded-lg px-3 py-1 text-xl font-extrabold text-white ${left <= 5 ? "bg-[#c0392b]" : "bg-[var(--accent)]"}`}>
            {t.seconds(Math.max(0, left))}
          </span>
        )}
        {!training && target === "ban" && !bansDone && <SmallButton onClick={() => setBansDone(true)}>{t.bansDone}</SmallButton>}
      </div>

      {training && !finished && <p className="text-xs text-[var(--soft)]">{t.trainIntro}</p>}

      {/* TREINO TERMINADO: nota e revisão de cada escolha */}
      {training && finished && (
        <section className={`${CARD} p-5`}>
          <h2 className="text-xl font-bold">{t.trainResult}</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-xl bg-[var(--accent)] px-4 py-2 text-4xl font-extrabold text-white">{letter}</span>
            <span className="font-semibold">
              {t.trainGrade}: {grade}/100
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-sm text-[var(--soft)]">
            {log.map((l, i) => (
              <span key={i}>
                {i + 1}. {t.yourPick}: <b className="text-[var(--text)]">{l.picked}</b> ({Math.round(l.ratio * 100)}/100)
                {l.timeout ? ` · ${t.timeout}` : ""}
                {l.picked !== l.best ? ` · ${t.bestOption}: ${l.best}` : ""}
              </span>
            ))}
          </div>
          <div className="mt-4">
            <PrimaryButton onClick={props.onRestart}>{t.trainAgain}</PrimaryButton>
          </div>
        </section>
      )}

      {/* NOTA FINAL DO DRAFT (ao vivo e treino) */}
      {finished && finalGrade && (
        <section className={`${CARD} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{t.gTitle}</h2>
            <ShareButton
              t={t}
              fileName={`brawldraft-${map.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
              make={() => {
                const pick = (ids: number[]) => ids.map((id) => ({ id, name: byId.get(id)?.name ?? "?" }));
                return draftCard({
                  title: t.cardDraft,
                  mapName: mapName(lang, map.name),
                  modeLabel: modeName(lang, map.mode),
                  modeColor: MODE_COLOR[map.mode] ?? "#2f6bff",
                  mapGameId: map.gameId,
                  mine: pick(mine),
                  enemies: pick(enemies),
                  bans: pick(bans),
                  myTeamLabel: t.myTeam,
                  enemyLabel: t.enemies,
                  bansLabel: t.banned,
                  grade: finalGrade.letter,
                  chance: finalGrade.chance,
                  chanceLabel: t.cardChance,
                  host: window.location.host,
                });
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="rounded-xl bg-[var(--accent)] px-4 py-2 text-4xl font-extrabold text-white">{finalGrade.letter}</span>
            <div className="min-w-[200px] flex-1">
              <p className="font-semibold">{t.gChance(finalGrade.chance)}</p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--bad-bg)]">
                <div className="h-full rounded-full bg-[var(--good)]" style={{ width: `${finalGrade.chance}%` }} />
              </div>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {finalGrade.reasons.map((r) => (
              <li key={r.text} className={r.good ? "text-[var(--good)]" : "text-[var(--bad)]"}>
                {r.good ? "✓" : "✗"} {r.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* AO VIVO, DRAFT COMPLETO: com a tag, espera a partida acabar e pega o resultado sozinho */}
      {!training && finished && props.tag && !manualResult && (
        <MatchWatch
          t={t}
          lang={lang}
          map={map}
          tag={props.tag}
          mine={mine}
          followed={followed}
          onSave={props.onSave}
          onManual={() => setManualResult(true)}
        />
      )}

      {/* Sem tag (ou escolheu marcar na mão): quem jogou e se venceu */}
      {!training && finished && (!props.tag || manualResult) && (
        <section className={`${CARD} p-5`}>
          <h2 className="text-xl font-bold">{t.saveResult}</h2>
          {!props.tag && <p className="text-xs text-[var(--faint)]">{t.watchNoTag}</p>}
          {savedResult ? (
            <p className="mt-2 text-sm font-medium text-[var(--good)]">{t.saved}</p>
          ) : (
            <div>
              <p className="mt-1 text-sm text-[var(--soft)]">{t.whoPlayed}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                  className="rounded-xl bg-[#138a4a] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {t.win}
                </button>
                <button
                  disabled={played === null}
                  onClick={() => saveResult(false)}
                  className="rounded-xl bg-[#c0392b] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
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
        <section>
          <h2 className="text-xl font-bold">{t.banIdeas}</h2>
          <p className="text-xs text-[var(--soft)]">{t.banIdeasSub}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {banIdeas.map((b) => (
              <button
                key={b.id}
                onClick={() => add(b.id, "ban")}
                className={`${CARD} flex flex-col items-center gap-1 p-2.5 transition hover:border-[var(--accent)] active:scale-95`}
              >
                <Icon brawler={b} size={52} />
                <span className="w-full truncate text-center text-xs font-semibold">{b.name}</span>
                <span className="text-[10px] text-[var(--faint)]">
                  {map.top.includes(b.name) ? t.topOfMap(map.top.indexOf(b.name) + 1) : `Tier ${b.tier}`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* AO VIVO, VEZ DO INIMIGO: picks prováveis deles (ou aviso de que os seus acabaram) */}
      {!training && target === "enemy" && (
        <section className={`${CARD} p-4`}>
          <h2 className="text-xl font-bold">{t.enemyTurnTitle}</h2>
          <p className="text-xs text-[var(--soft)]">{mine.length >= TEAM_SIZE ? t.myPicksDone : t.enemyTurnSub}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {enemyIdeas.map((r) => (
              <button
                key={r.brawler.id}
                onClick={() => add(r.brawler.id, "enemy")}
                title={r.brawler.name}
                className="flex w-16 flex-col items-center gap-1 rounded-xl border border-[var(--line)] p-1 transition hover:border-[var(--bad)]"
              >
                <Icon brawler={r.brawler} size={48} />
                <span className="w-full truncate text-center text-[10px] font-medium">{r.brawler.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* AO VIVO, DUO: melhores pares */}
      {!training && target === "mine" && duo && pairs.length > 0 && (
        <section className={`${CARD} p-4`}>
          <h2 className="text-xl font-bold">{t.duoTitle}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {pairs.map((p) => (
              <div key={`${p.me.brawler.id}-${p.friend.brawler.id}`} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-2.5">
                <button onClick={() => add(p.me.brawler.id, "mine")} className="flex items-center gap-2" title={t.addToTeam}>
                  <Icon brawler={p.me.brawler} size={40} />
                  <span className="text-left">
                    <span className="block text-[10px] uppercase text-[var(--faint)]">{t.you}</span>
                    <span className="block font-semibold">{p.me.brawler.name}</span>
                  </span>
                </button>
                <span className="text-[var(--faint)]">+</span>
                <button onClick={() => add(p.friend.brawler.id, "mine")} className="flex items-center gap-2" title={t.addToTeam}>
                  <Icon brawler={p.friend.brawler} size={40} />
                  <span className="text-left">
                    <span className="block text-[10px] uppercase text-[var(--faint)]">{t.friend}</span>
                    <span className="block font-semibold">{p.friend.brawler.name}</span>
                  </span>
                </button>
                <span className="ml-auto rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-sm font-bold text-[var(--accent)]">{p.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AO VIVO, SUA VEZ: recomendações para ESTE pick */}
      {!training && target === "mine" && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">{stageTitle}</h2>
              <p className="text-xs text-[var(--soft)]">{stageTip}</p>
            </div>
          </div>
          {props.onlyOwned && props.owned.length === 0 && <p className="mt-1 text-xs text-[var(--soft)]">{t.onlyMineEmpty}</p>}
          <div className="mt-3 flex flex-col gap-2">
            {top.map((r, i) => (
              <div key={r.brawler.id} className={`${CARD} ${i === 0 ? "ring-2 ring-[var(--accent)]" : ""}`}>
                <button onClick={() => setOpen(open === r.brawler.id ? null : r.brawler.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="w-6 text-center text-xl font-extrabold text-[var(--faint)]">{i + 1}</span>
                  <Icon brawler={r.brawler} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-tight">
                      {r.brawler.name} <span className="text-xs font-normal text-[var(--faint)]">{className(lang, r.brawler.class)}</span>
                    </span>
                    <span className="block text-xs text-[var(--soft)]">{(open === r.brawler.id ? r.reasons : r.reasons.slice(0, 2)).join(" · ")}</span>
                    {r.trap && (
                      <span className="mt-1 inline-block rounded-md bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn)]">
                        ⚠ {t.trapWarn(r.trap)}
                      </span>
                    )}
                  </span>
                  <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent)]">{r.score.toFixed(1)}</span>
                </button>

                {/* Detalhe: de onde veio a nota */}
                {open === r.brawler.id && (
                  <div className="border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--soft)]">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      <Part label={t.partBase} value={r.parts.base} />
                      <Part label={t.partMap} value={r.parts.map} />
                      <Part label={t.partCounter} value={r.parts.counter} />
                      <Part label={t.partSynergy} value={r.parts.synergy} />
                      <Part label={t.partComp} value={r.parts.comp} />
                      <Part label={t.partRisk} value={r.parts.risk} />
                      <Part label={t.partPersonal} value={r.parts.personal} />
                      <Part label={t.partComfort} value={r.parts.comfort} />
                    </div>
                    {mine.length < TEAM_SIZE && (
                      <div className="mt-3">
                        <PrimaryButton onClick={() => add(r.brawler.id, "mine")}>{t.addToTeam}</PrimaryButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {top.length === 0 && <p className="text-sm text-[var(--soft)]">{t.noOptions}</p>}
          </div>
          {ranking.length > 3 && (
            <div className="mt-3 flex justify-center">
              <SmallButton onClick={() => setShowAll(!showAll)}>{showAll ? t.seeLess : t.seeMore}</SmallButton>
            </div>
          )}
        </section>
      )}

      {/* Grade com todos os Brawlers */}
      {!finished && (
        <section className="mt-2">
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
