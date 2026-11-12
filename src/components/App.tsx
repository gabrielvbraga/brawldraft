"use client";
// PEÇA PRINCIPAL DO SITE
// Guarda em qual tela estamos e os dados da pessoa (preferências, Brawlers da tag,
// histórico, conta) e mostra a tela certa. "use client" = roda no navegador.

import { useEffect, useMemo, useRef, useState } from "react";
import { applyLive } from "@/data/applyLive";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import type { Collected } from "@/lib/collector";
import { setCollected, setOverrides } from "@/lib/engine";
import { STR, type Lang } from "@/lib/i18n";
import type { LiveMeta } from "@/lib/livemeta";
import type { MetaDay } from "@/lib/metaChanges";
import { ROOMS_ENABLED, createRoom, newRoomCode, readRoom, type RoomState } from "@/lib/room";
import {
  comfortScores,
  load,
  mergeHistory,
  personalStats,
  rankedOwned,
  save,
  type HistoryEntry,
  type RosterItem,
} from "@/lib/storage";
import {
  SUPABASE_ON,
  freshSession,
  isAdmin as checkAdmin,
  loadOverrides,
  loadUserData,
  logVisit,
  saveScore,
  saveUserData,
  signIn,
  signUp,
  type Session,
} from "@/lib/supabase";
import type { GameMap } from "@/lib/types";
import DraftScreen from "./DraftScreen";
import { AdminScreen } from "./admin";
import { HistoryScreen } from "./history";
import { AccountScreen, Home, MapPicker, MetaScreen, OwnedScreen } from "./screens";
import { CompareScreen, CountersScreen, LeaderboardScreen, QuizScreen } from "./tools";
import { ACCENTS, MODES, PANEL, Shell, type AccentName, type ModeName, type NavKey } from "./ui";

type Screen =
  | "home"
  | "maps"
  | "draft"
  | "meta"
  | "counters"
  | "history"
  | "owned"
  | "account"
  | "quiz"
  | "leaderboard"
  | "compare"
  | "admin";

const BY_ID = new Map(BRAWLERS.map((b) => [b.id, b]));
const SYNC_EVERY = 10 * 60 * 1000; // busca partidas pela tag no máximo a cada 10 minutos

export default function App(props: { live: LiveMeta; collected: Collected | null; metaHistory: MetaDay[] }) {
  // Atualiza Brawlers, mapas e o motor com os dados do servidor antes de desenhar a tela.
  applyLive(props.live);
  setCollected(props.collected);

  const [screen, setScreen] = useState<Screen>("home");
  const [back, setBack] = useState<Screen>("home"); // para onde "Meus Brawlers" volta
  const [training, setTraining] = useState(false);
  const [map, setMap] = useState<GameMap | null>(null);
  const [round, setRound] = useState(0); // aumenta a cada "novo draft", para recomeçar do zero
  const [trio, setTrio] = useState(false); // escolhendo mapa para um draft em trio?
  const [room, setRoom] = useState<string | null>(null); // código da sala atual
  const [roomInit, setRoomInit] = useState<{ state: RoomState; version: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // aviso rápido
  const [, setTick] = useState(0); // força redesenhar quando as correções do admin chegam

  // Preferências e dados salvos no navegador (e na conta, se estiver logado).
  const [mode, setMode] = useState<ModeName>("claro");
  const [accent, setAccent] = useState<AccentName>("azul");
  const [lang, setLang] = useState<Lang>("pt");
  const [owned, setOwned] = useState<number[]>([]);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [free6, setFree6] = useState<number[]>([]);
  const [tag, setTag] = useState("");
  const [nick, setNick] = useState("");
  const [rotation, setRotation] = useState<Set<number> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Conta (Supabase). A sessão fica salva no navegador para não precisar entrar toda vez.
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState(false);

  // Cópia sempre atual dos dados, para gravar na conta sem pegar valores velhos.
  const data = useRef({ history, owned, roster, free6, tag, nick, session });
  data.current = { history, owned, roster, free6, tag, nick, session };
  const visited = useRef(new Set<string>());

  const t = STR[lang];
  const personal = useMemo(() => personalStats(history), [history]);
  const comfort = useMemo(() => comfortScores(roster), [roster]);

  /** Grava tudo na conta (se estiver logado). Renova a sessão se precisar. */
  async function pushToAccount(changes: Partial<typeof data.current> = {}) {
    const d = { ...data.current, ...changes };
    const s = await freshSession(d.session);
    if (!s) return;
    if (s !== data.current.session) {
      setSession(s);
      save("bd-session", s);
    }
    saveUserData(s, { history: d.history, owned: d.owned, roster: d.roster, free6: d.free6, tag: d.tag, nick: d.nick });
  }

  /** Busca os dados da conta e junta com os deste aparelho. */
  async function syncFromAccount(s: Session, local: typeof data.current) {
    const remote = await loadUserData(s);
    if (!remote) return;
    const merged = {
      history: mergeHistory(remote.history as HistoryEntry[], local.history),
      owned: remote.owned.length > 0 ? remote.owned : local.owned,
      roster: remote.roster && remote.roster.length > 0 ? remote.roster : local.roster,
      free6: remote.free6 && remote.free6.length > 0 ? remote.free6 : local.free6,
      tag: remote.tag || local.tag,
      nick: remote.nick || local.nick,
    };
    setHistory(merged.history);
    setOwned(merged.owned);
    setRoster(merged.roster);
    setFree6(merged.free6);
    setTag(merged.tag);
    setNick(merged.nick);
    save("bd-history", merged.history);
    save("bd-owned", merged.owned);
    save("bd-roster", merged.roster);
    save("bd-free6", merged.free6);
    save("bd-tag", merged.tag);
    save("bd-nick", merged.nick);
    saveUserData(s, merged);
    setAdmin(await checkAdmin(s));
  }

  /** HISTÓRICO AUTOMÁTICO: busca as partidas de Ranked da tag e junta no histórico. */
  async function syncBattles(force = false) {
    const myTag = data.current.tag;
    if (!myTag) return;
    const last = load<number>("bd-last-sync", 0);
    if (!force && Date.now() - last < SYNC_EVERY) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/battles?tag=${encodeURIComponent(myTag)}`);
      const json = (await res.json()) as {
        items?: { date: string; mapGameId: number; mapName: string; win: boolean; played: number; team: number[]; enemies: number[] }[];
      };
      if (res.ok && json.items) {
        save("bd-last-sync", Date.now());
        const name = (id: number) => BY_ID.get(id)?.name ?? "?";
        const entries: HistoryEntry[] = json.items
          .map((it) => {
            const m = MAPS.find((x) => x.gameId === it.mapGameId);
            return {
              date: it.date,
              map: m?.name ?? it.mapName,
              mode: m?.mode ?? "",
              played: name(it.played),
              team: it.team.map(name),
              enemies: it.enemies.map(name),
              win: it.win,
              source: "auto" as const,
            };
          })
          .filter((e) => e.mode !== ""); // só os mapas do Ranked que o site conhece
        const before = new Set(data.current.history.map((h) => h.date));
        const added = entries.filter((e) => !before.has(e.date)).length;
        const merged = mergeHistory(data.current.history, entries);
        setHistory(merged);
        save("bd-history", merged);
        if (added > 0) pushToAccount({ history: merged });
        setSyncMessage(STR[load<string>("bd-lang", "pt") === "en" ? "en" : "pt"].syncDone(added));
      }
    } catch {
      // sem internet ou API fora do ar: tenta de novo na próxima vez
    }
    setSyncing(false);
  }

  // Roda uma vez quando a página abre: carrega o que estava salvo e o que vem de fora.
  useEffect(() => {
    const savedMode = load<string>("bd-mode", "claro");
    if (savedMode in MODES) setMode(savedMode as ModeName);
    const savedAccent = load<string>("bd-accent", "azul");
    if (savedAccent in ACCENTS) setAccent(savedAccent as AccentName);
    const savedLang: Lang = load<string>("bd-lang", "pt") === "en" ? "en" : "pt";
    setLang(savedLang);
    const local = {
      history: load<HistoryEntry[]>("bd-history", []),
      owned: load<number[]>("bd-owned", []),
      roster: load<RosterItem[]>("bd-roster", []),
      free6: load<number[]>("bd-free6", []),
      tag: load<string>("bd-tag", ""),
      nick: load<string>("bd-nick", ""),
      session: null,
    };
    setHistory(local.history);
    setOwned(local.owned);
    setRoster(local.roster);
    setFree6(local.free6);
    setTag(local.tag);
    setNick(local.nick);
    // Com os Brawlers da tag, a sugestão já começa mostrando só os seus.
    setOnlyOwned(load<boolean>("bd-only-owned", local.roster.length > 0));
    data.current = { ...data.current, ...local };

    // Estava logado? Renova a sessão e sincroniza.
    if (SUPABASE_ON) {
      freshSession(load<Session | null>("bd-session", null)).then((s) => {
        setSession(s);
        save("bd-session", s);
        if (s) syncFromAccount(s, local);
      });
      // Correções do administrador (counters, sinergias, dicas).
      loadOverrides().then((o) => {
        if (o) {
          setOverrides(o);
          setTick((n) => n + 1);
        }
      });
    }

    // Mapas ativos hoje.
    fetch("/api/rotation")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { active?: number[] } | null) => setRotation(new Set(j?.active ?? [])))
      .catch(() => setRotation(new Set()));

    // Histórico automático pela tag.
    if (local.tag) syncBattles();

    // Abriu um link de sala (?sala=CODIGO)? Entra direto no draft em trio.
    const code = new URLSearchParams(window.location.search).get("sala");
    if (code && ROOMS_ENABLED) {
      readRoom(code.toUpperCase()).then((r) => {
        const m = r ? MAPS.find((x) => x.id === r.state.mapId) : undefined;
        if (!r || !m) {
          setNotice(STR[savedLang].roomNotFound);
          return;
        }
        setTraining(false);
        setMap(m);
        setRoom(code.toUpperCase());
        setRoomInit(r);
        setRound((n) => n + 1);
        setScreen("draft");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contador de visitas: cada tela conta uma vez por visita ao site.
  useEffect(() => {
    if (!SUPABASE_ON || visited.current.has(screen)) return;
    visited.current.add(screen);
    logVisit(screen);
  }, [screen]);

  /** Cria uma sala nova no mapa escolhido e abre o draft. */
  async function startRoom(m: GameMap) {
    setNotice(t.roomCreating);
    const code = newRoomCode();
    const state: RoomState = { mapId: m.id, first: "mine", bans: [], mine: [], enemies: [], bansDone: false };
    const ok = await createRoom(code, state);
    if (!ok) {
      setNotice(t.roomError);
      return;
    }
    setNotice(null);
    window.history.replaceState(null, "", `/?sala=${code}`);
    setMap(m);
    setRoom(code);
    setRoomInit({ state, version: 1 });
    setRound(round + 1);
    setScreen("draft");
  }

  /** Sai da sala (volta a ser um draft só deste aparelho). */
  function leaveRoom() {
    if (!room) return;
    setRoom(null);
    setRoomInit(null);
    window.history.replaceState(null, "", "/");
  }

  function changeOwned(next: number[]) {
    setOwned(next);
    save("bd-owned", next);
    pushToAccount({ owned: next });
  }

  /** Abre um draft (ao vivo, treino ou trio) já no mapa escolhido. */
  function openDraft(m: GameMap, kind: "live" | "train" | "trio") {
    setNotice(null);
    setTraining(kind === "train");
    if (kind === "trio") {
      startRoom(m);
      return;
    }
    leaveRoom();
    setMap(m);
    setRound(round + 1);
    setScreen("draft");
  }

  /** Navegação pelo menu do topo e pelos botões da tela inicial. */
  function go(where: NavKey | "trio" | "account") {
    setNotice(null);
    if (where !== "owned") leaveRoom();
    if (where === "draft" || where === "train" || where === "trio") {
      setTraining(where === "train");
      setTrio(where === "trio");
      setScreen("maps");
    } else if (where === "owned") {
      setBack(screen === "owned" ? "home" : screen);
      setScreen("owned");
    } else {
      if (where === "history") syncBattles();
      setScreen(where);
    }
    window.scrollTo({ top: 0 });
  }

  const current: NavKey =
    screen === "maps" || screen === "draft" ? (training ? "train" : "draft") : screen === "account" ? "home" : screen;

  return (
    <Shell
      t={t}
      mode={mode}
      accent={accent}
      lang={lang}
      current={current}
      account={session ? nick || session.user.email : null}
      isAdmin={admin}
      onMode={(m: ModeName) => {
        setMode(m);
        save("bd-mode", m);
      }}
      onAccent={(a: AccentName) => {
        setAccent(a);
        save("bd-accent", a);
      }}
      onLang={(l: Lang) => {
        setLang(l);
        save("bd-lang", l);
      }}
      onNav={(where: NavKey) => go(where)}
      onAccount={() => go("account")}
    >
      {notice && <p className={`${PANEL} mb-5 px-4 py-3 text-sm`}>{notice}</p>}

      {screen === "home" && (
        <Home
          t={t}
          lang={lang}
          live={props.live}
          metaHistory={props.metaHistory}
          battles={Math.round(props.collected?.battles ?? 0)}
          ownedCount={owned.length}
          historyCount={history.length}
          rotation={rotation}
          showTrio={ROOMS_ENABLED}
          loggedIn={session !== null}
          onGo={(where) => go(where)}
          onPickMap={(m: GameMap) => openDraft(m, "live")}
        />
      )}

      {screen === "maps" && (
        <MapPicker
          t={t}
          lang={lang}
          rotation={rotation}
          title={training ? t.training : trio ? t.trio : t.liveDraft}
          onPick={(m: GameMap) => openDraft(m, trio ? "trio" : training ? "train" : "live")}
        />
      )}

      {screen === "draft" && map && (
        <DraftScreen
          key={round} // trocar a "key" faz o React recriar a tela do zero
          t={t}
          lang={lang}
          map={map}
          training={training}
          owned={owned}
          onlyOwned={onlyOwned}
          personal={personal}
          comfort={comfort}
          room={room}
          initial={roomInit}
          onTrainScore={(score: number, mapName: string) => {
            const s = data.current.session;
            if (!s) return;
            saveScore(s, data.current.nick || s.user.email.split("@")[0], score, mapName).then((ok) => ok && setNotice(t.lbSaved));
          }}
          onToggleOnlyOwned={() => {
            save("bd-only-owned", !onlyOwned);
            setOnlyOwned(!onlyOwned);
          }}
          onEditOwned={() => go("owned")}
          onChangeMap={() => {
            setTrio(room !== null); // trocar o mapa numa sala cria uma sala nova
            leaveRoom();
            setScreen("maps");
          }}
          onRestart={() => {
            leaveRoom();
            setRound(round + 1);
          }}
          onSave={(entry: HistoryEntry) => {
            const next = mergeHistory(history, [entry]);
            setHistory(next);
            save("bd-history", next);
            pushToAccount({ history: next });
          }}
        />
      )}

      {screen === "meta" && <MetaScreen t={t} lang={lang} live={props.live} collected={props.collected} />}

      {screen === "counters" && <CountersScreen t={t} />}

      {screen === "history" && (
        <HistoryScreen
          t={t}
          lang={lang}
          history={history}
          metaHistory={props.metaHistory}
          hasTag={tag !== ""}
          syncing={syncing}
          syncMessage={syncMessage}
          onSync={() => syncBattles(true)}
          onClear={() => {
            if (!window.confirm(t.clearConfirm)) return;
            setHistory([]);
            save("bd-history", []);
            pushToAccount({ history: [] });
          }}
        />
      )}

      {screen === "owned" && (
        <OwnedScreen
          t={t}
          owned={owned}
          roster={roster}
          free6={free6}
          tag={tag}
          onToggle={(id: number) => changeOwned(owned.includes(id) ? owned.filter((x) => x !== id) : [...owned, id])}
          onAll={(all: boolean) => changeOwned(all ? BRAWLERS.map((b) => b.id) : [])}
          onImported={(newTag: string, _name: string, list: RosterItem[]) => {
            const nextOwned = rankedOwned(list, free6);
            setTag(newTag);
            setRoster(list);
            setOwned(nextOwned);
            setOnlyOwned(true);
            save("bd-tag", newTag);
            save("bd-roster", list);
            save("bd-owned", nextOwned);
            save("bd-only-owned", true);
            save("bd-last-sync", 0);
            data.current = { ...data.current, tag: newTag, roster: list, owned: nextOwned };
            pushToAccount({ tag: newTag, roster: list, owned: nextOwned });
            syncBattles(true);
          }}
          onFree6={(ids: number[]) => {
            const nextOwned = rankedOwned(roster, ids);
            setFree6(ids);
            setOwned(nextOwned);
            save("bd-free6", ids);
            save("bd-owned", nextOwned);
            pushToAccount({ free6: ids, owned: nextOwned });
          }}
          onDone={() => setScreen(back)}
        />
      )}

      {screen === "account" && (
        <AccountScreen
          t={t}
          enabled={SUPABASE_ON}
          email={session?.user.email ?? null}
          nick={nick}
          onLogin={async (email: string, password: string, create: boolean) => {
            const r = create ? await signUp(email, password) : await signIn(email, password);
            if (r.error) return r.error;
            if (r.needsConfirm || !r.session) return "confirm";
            setSession(r.session);
            save("bd-session", r.session);
            await syncFromAccount(r.session, data.current);
            return null;
          }}
          onLogout={() => {
            setSession(null);
            setAdmin(false);
            save("bd-session", null);
          }}
          onNick={(n: string) => {
            setNick(n);
            save("bd-nick", n);
            pushToAccount({ nick: n });
            setNotice(t.nickSaved);
          }}
        />
      )}

      {screen === "quiz" && <QuizScreen t={t} />}

      {screen === "leaderboard" && <LeaderboardScreen t={t} loggedIn={session !== null} myId={session?.user.id ?? null} />}

      {screen === "compare" && <CompareScreen t={t} lang={lang} myTag={tag} />}

      {screen === "admin" && <AdminScreen t={t} lang={lang} session={session} isAdmin={admin} />}
    </Shell>
  );
}
