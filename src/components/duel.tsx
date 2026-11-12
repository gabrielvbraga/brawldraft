"use client";
// TELA DO DUELO 1 CONTRA 1 (link: /?duelo=CODIGO)

import { useEffect, useRef, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { DUEL_BANS, createDuel, duelLetter, duelTurn, newDuel, other, readDuel, writeDuel, type DuelState, type Side } from "@/lib/duel";
import { draftGrade, recommend, type PickStage } from "@/lib/engine";
import { mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import { newRoomCode } from "@/lib/room";
import { load, save } from "@/lib/storage";
import type { Brawler, GameMap } from "@/lib/types";
import { BrawlerGrid, CARD, H1, INPUT, Icon, MODE_COLOR, MapImage, PrimaryButton, SUB, SmallButton } from "./ui";

const BY_ID = new Map(BRAWLERS.map((b) => [b.id, b]));
const roleKey = (code: string) => `bd-duel-${code}`;

function Team(props: { title: string; ids: number[]; color: string; active: boolean }) {
  return (
    <div className={`${CARD} flex-1 p-3 ${props.active ? "ring-2" : ""}`} style={props.active ? ({ "--tw-ring-color": props.color } as React.CSSProperties) : undefined}>
      <p className="flex items-center gap-1.5 truncate text-xs font-bold uppercase tracking-wider" style={{ color: props.color }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: props.color }} />
        {props.title}
      </p>
      <div className="mt-2 flex gap-1.5">
        {[0, 1, 2].map((i) => {
          const b = props.ids[i] !== undefined ? BY_ID.get(props.ids[i]) : undefined;
          return b ? (
            <Icon key={i} brawler={b} size={48} />
          ) : (
            <span key={i} className="h-12 w-12 rounded-lg border-2 border-dashed opacity-40" style={{ borderColor: props.color }} />
          );
        })}
      </div>
    </div>
  );
}

export function DuelScreen(props: {
  t: Dict;
  lang: Lang;
  nick: string;
  initialCode: string | null;
  rotation: Set<number> | null;
  onResult: (won: boolean) => void;
}) {
  const { t, lang } = props;
  const [code, setCode] = useState<string | null>(props.initialCode);
  const [state, setState] = useState<DuelState | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const [name, setName] = useState(props.nick || "");
  const [joinCode, setJoinCode] = useState("");
  const [mapId, setMapId] = useState<number>(() => {
    const today = MAPS.filter((m) => props.rotation?.has(m.gameId));
    return (today[0] ?? MAPS[0]).id;
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const version = useRef(0);
  const reported = useRef(false);

  // ---- Entrar na sala (pelo link ou pelo código) ----
  async function enter(c: string) {
    const r = await readDuel(c);
    if (!r) {
      setMsg(t.duelNotFound);
      return;
    }
    let my = load<Side | null>(roleKey(c), null);
    let st = r.state;
    let ver = r.version;
    if (!my && !st.names.b) {
      // Vaga livre: entra como o segundo jogador.
      my = "b";
      st = { ...st, names: { ...st.names, b: (name || t.duelFriend).slice(0, 16) } };
      ver = r.version + 1;
      await writeDuel(c, st, ver);
      save(roleKey(c), my);
    }
    version.current = ver;
    setSide(my);
    setState(st);
    setCode(c);
    setMsg(null);
    reported.current = false;
    window.history.replaceState(null, "", `/?duelo=${c}`);
  }

  useEffect(() => {
    if (props.initialCode) enter(props.initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Lê a sala a cada 1,2 segundo ----
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(async () => {
      const r = await readDuel(code);
      if (r && r.version > version.current) {
        version.current = r.version;
        setState(r.state);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [code]);

  // Revanche criada pelo outro jogador: vai junto (mantendo o mesmo lado).
  useEffect(() => {
    const next = (state as (DuelState & { next?: string }) | null)?.next;
    if (next && next !== code && side) {
      save(roleKey(next), side);
      enter(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Fim do duelo: avisa uma vez (para as conquistas).
  useEffect(() => {
    if (!state || !code || side === null || reported.current || duelTurn(state) !== null) return;
    const mapNow = MAPS.find((m) => m.id === state.mapId);
    if (!mapNow) return;
    reported.current = true;
    const team = (ids: number[]) => ids.map((id) => BY_ID.get(id)).filter((x): x is Brawler => !!x);
    const ga = draftGrade(team(state.a), team(state.b), mapNow, lang);
    const qa = duelLetter(state.quality.a).score;
    const qb = duelLetter(state.quality.b).score;
    const winner: Side | null = ga.chance !== 50 ? (ga.chance > 50 ? "a" : "b") : qa !== qb ? (qa > qb ? "a" : "b") : null;
    props.onResult(winner === side);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, side, code]);

  async function create(first: Side = "a", names?: { a: string; b: string | null }, keepMap?: number, role: Side = "a") {
    const c = newRoomCode();
    const st = newDuel(keepMap ?? mapId, (name || t.duelYou).slice(0, 16), first);
    if (names) st.names = names;
    const ok = await createDuel(c, st);
    if (!ok) {
      setMsg(t.roomError);
      return null;
    }
    save(roleKey(c), role);
    version.current = 1;
    reported.current = false;
    setSide(role);
    setState(st);
    setCode(c);
    window.history.replaceState(null, "", `/?duelo=${c}`);
    return c;
  }

  async function push(next: DuelState) {
    if (!code) return;
    version.current += 1;
    setState(next);
    await writeDuel(code, next, version.current);
  }

  function copyLink() {
    if (!code) return;
    const link = `${window.location.origin}/?duelo=${code}`;
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => window.prompt(t.copyLink, link),
    );
  }

  // ================= SAGUÃO =================
  if (!code || !state) {
    const today = MAPS.filter((m) => props.rotation?.has(m.gameId));
    const list = today.length ? today : MAPS;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <div>
          <h1 className={H1}>{t.duelTitle}</h1>
          <p className={SUB}>{t.duelSub}</p>
        </div>
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
            {t.duelName}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
            {t.mapLabel}
            <select value={mapId} onChange={(e) => setMapId(Number(e.target.value))} className={INPUT}>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {mapName(lang, m.name)} · {modeName(lang, m.mode)}
                </option>
              ))}
            </select>
          </label>
          <PrimaryButton onClick={() => create()}>{t.duelCreate}</PrimaryButton>
        </section>
        <form
          className={`${CARD} flex flex-wrap items-end gap-3 p-5`}
          onSubmit={(e) => {
            e.preventDefault();
            if (joinCode.trim()) enter(joinCode.trim().toUpperCase());
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
            {t.duelJoinCode}
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={8} className={`${INPUT} uppercase`} />
          </label>
          <SmallButton onClick={() => joinCode.trim() && enter(joinCode.trim().toUpperCase())}>{t.duelJoin}</SmallButton>
        </form>
        {msg && <p className="text-sm font-medium text-[var(--bad)]">{msg}</p>}
      </div>
    );
  }

  // ================= DUELO =================
  const map = MAPS.find((m) => m.id === state.mapId) as GameMap;
  const me: Side = side ?? "a";
  const spectator = side === null;
  const turn = duelTurn(state);
  const myTurn = !!turn && !spectator && turn.side === me && !!state.names.b;
  const used = new Set([...state.bans, ...state.a, ...state.b]);
  const nameOf = (s: Side) => state.names[s] ?? t.duelWaitingName;
  const color = (s: Side) => (s === me ? "var(--accent)" : "var(--bad)");

  async function act(b: Brawler) {
    if (!turn || !myTurn || used.has(b.id)) return;
    if (turn.action === "ban") {
      await push({ ...state!, bans: [...state!.bans, b.id] });
      return;
    }
    // Qualidade do pick: comparado com a melhor opção do momento para este lado.
    const mine = state![me];
    const theirs = state![other(me)];
    const idx = state!.a.length + state!.b.length;
    const stage: PickStage = idx === 0 ? "first" : idx === 5 ? "last" : "middle";
    const ranking = recommend({ stage, brawlers: BRAWLERS, map, bans: state!.bans, mine, enemies: theirs, lang });
    const best = ranking[0]?.score ?? 1;
    const chosen = ranking.find((r) => r.brawler.id === b.id)?.score ?? 0;
    const q = Math.max(0, Math.min(1, best > 0 ? chosen / best : 0));
    await push({
      ...state!,
      [me]: [...mine, b.id],
      quality: { ...state!.quality, [me]: [...state!.quality[me], q] },
    } as DuelState);
  }

  // ---- Fim: notas e vencedor ----
  let result: { winner: Side | null; chance: Record<Side, number>; grade: Record<Side, ReturnType<typeof duelLetter>> } | null = null;
  if (!turn) {
    const team = (ids: number[]) => ids.map((id) => BY_ID.get(id)).filter((x): x is Brawler => !!x);
    const ga = draftGrade(team(state.a), team(state.b), map, lang);
    const chance = { a: ga.chance, b: 100 - ga.chance };
    const grade = { a: duelLetter(state.quality.a), b: duelLetter(state.quality.b) };
    const winner: Side | null =
      chance.a !== chance.b ? (chance.a > chance.b ? "a" : "b") : grade.a.score !== grade.b.score ? (grade.a.score > grade.b.score ? "a" : "b") : null;
    result = { winner, chance, grade };
  }

  const banner = !state.names.b
    ? t.duelWaiting
    : !turn
      ? result?.winner === null
        ? t.duelTie
        : result?.winner === me
          ? t.duelYouWon
          : t.duelTheyWon(nameOf(result?.winner as Side))
      : myTurn
        ? turn.action === "ban"
          ? t.duelYourBan(state.bans.length + 1, DUEL_BANS)
          : t.duelYourPick
        : t.duelTheirTurn(nameOf(turn.side));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {/* Mapa e código */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-20 shrink-0">
          <MapImage map={map} height={100} zoomLabel={t.zoomMap} closeLabel={t.close} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">⚔️ {t.duelTitle}</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{mapName(lang, map.name)}</h1>
          <p className="flex items-center gap-1.5 text-sm text-[var(--soft)]">
            <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[map.mode] }} />
            {modeName(lang, map.mode)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-[var(--accent-soft)] px-3 py-1.5 text-lg font-extrabold tracking-widest text-[var(--accent)]">{code}</span>
          <SmallButton onClick={copyLink}>{copied ? t.linkCopied : t.copyLink}</SmallButton>
        </div>
      </div>

      {/* De quem é a vez */}
      <div
        className="rounded-2xl px-4 py-3 text-center text-lg font-extrabold text-white"
        style={{ background: !state.names.b ? "#6b7280" : !turn ? (result?.winner === me ? "var(--good)" : result?.winner ? "var(--bad)" : "#6b7280") : myTurn ? "var(--accent)" : "#6b7280" }}
        role="status"
      >
        {banner}
      </div>
      {!state.names.b && <p className="text-center text-sm text-[var(--soft)]">{t.duelInvite}</p>}

      {/* Times e bans */}
      <div className="flex gap-3">
        <Team title={`${nameOf(me)} (${t.duelYou})`} ids={state[me]} color={color(me)} active={!!turn && turn.side === me} />
        <Team title={nameOf(other(me))} ids={state[other(me)]} color={color(other(me))} active={!!turn && turn.side === other(me)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">
          {t.banned} {state.bans.length}/{DUEL_BANS}
        </span>
        {state.bans.map((id) => {
          const b = BY_ID.get(id);
          return b ? (
            <span key={id} className="opacity-50">
              <Icon brawler={b} size={32} />
            </span>
          ) : null;
        })}
      </div>

      {/* Escolher */}
      {myTurn && (
        <BrawlerGrid
          brawlers={BRAWLERS}
          placeholder={t.searchBrawler}
          state={(b: Brawler) => (used.has(b.id) ? "dim" : "normal")}
          disabled={(b: Brawler) => used.has(b.id)}
          onPick={act}
        />
      )}

      {/* Resultado */}
      {result && (
        <section className="grid gap-3 sm:grid-cols-2">
          {([me, other(me)] as Side[]).map((s) => (
            <div key={s} className={`${CARD} p-5 ${result!.winner === s ? "ring-2 ring-[var(--good)]" : ""}`}>
              <p className="truncate font-bold">{nameOf(s)}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-3xl font-extrabold text-white">
                  {result!.grade[s].letter}
                </span>
                <span className="text-sm">
                  <span className="block font-semibold">{t.duelPickQuality(result!.grade[s].score)}</span>
                  <span className="block text-[var(--soft)]">{t.duelChance(result!.chance[s])}</span>
                </span>
              </div>
            </div>
          ))}
          <p className="text-xs text-[var(--faint)] sm:col-span-2">{t.duelHow}</p>
          {!spectator && (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <PrimaryButton
                onClick={async () => {
                  const c = await create(other(state.first), state.names, state.mapId, me);
                  // Avisa a sala antiga para o outro jogador vir junto.
                  if (c && code) {
                    const old = await readDuel(code);
                    if (old) await writeDuel(code, { ...old.state, next: c } as DuelState, old.version + 1);
                  }
                }}
              >
                {t.duelRematch}
              </PrimaryButton>
              <SmallButton
                onClick={() => {
                  setCode(null);
                  setState(null);
                  window.history.replaceState(null, "", "/");
                }}
              >
                {t.duelNew}
              </SmallButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
