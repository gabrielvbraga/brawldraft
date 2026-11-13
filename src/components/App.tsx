"use client";
// PEÇA PRINCIPAL DO SITE
// Guarda em qual tela estamos e os dados da pessoa (preferências, Brawlers da tag,
// histórico, conta) e mostra a tela certa. "use client" = roda no navegador.

import { useEffect, useMemo, useRef, useState } from "react";
import { applyLive, applyNewMaps, rankedMapCount } from "@/data/applyLive";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import type { Collected } from "@/lib/collector";
import { setCollected, setOverrides } from "@/lib/engine";
import { STR, type Lang } from "@/lib/i18n";
import type { LiveMeta } from "@/lib/livemeta";
import type { MetaDay } from "@/lib/metaChanges";
import { ROOMS_ENABLED, createRoom, newRoomCode, readRoom, type RoomState } from "@/lib/room";
import {
  cleanHistory,
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
  isModerator,
  loadOverrides,
  loadRecSummary,
  loadUserData,
  logVisit,
  saveRecResult,
  saveScore,
  saveUserData,
  signIn,
  signUp,
  enrollTotp,
  listFactors,
  requestPasswordReset,
  sessionFromLink,
  unenrollFactor,
  updatePassword,
  verifyTotp,
  type RecSummary,
  type Session,
} from "@/lib/supabase";
import { refreshPush, registerWorker } from "@/lib/push";
import { goodMaps } from "@/lib/upgrade";
import type { Match } from "@/lib/matches";
import { findDraftMatch, type PendingDraft } from "@/lib/pending";
import { TiltBanner } from "./insights";
import type { GameMap } from "@/lib/types";
import DraftScreen from "./DraftScreen";
import { AdminScreen } from "./admin";
import { HistoryScreen } from "./history";
import { AccountScreen, DraftSetup, Home, MapPicker, MetaScreen, OwnedScreen, type DraftSetupChoice } from "./screens";
import { CountersScreen, LeaderboardScreen, QuizScreen } from "./tools";
import { CompareScreen, ProfileScreen } from "./profile";
import { DailyScreen } from "./daily";
import { DuelScreen } from "./duel";
import { mergeStats, type SiteStats } from "@/lib/achievements";
import { MODES, PANEL, Shell, type ModeName, type NavKey } from "./ui";

type Screen =
  | "home"
  | "maps"
  | "draft"
  | "setup"
  | "meta"
  | "counters"
  | "history"
  | "owned"
  | "account"
  | "quiz"
  | "leaderboard"
  | "compare"
  | "profile"
  | "daily"
  | "duel"
  | "admin";

const BY_ID = new Map(BRAWLERS.map((b) => [b.id, b]));
const SYNC_EVERY = 10 * 60 * 1000; // busca partidas pela tag no máximo a cada 10 minutos

export default function App(props: { live: LiveMeta; collected: Collected | null; metaHistory: MetaDay[] }) {
  // Atualiza Brawlers, mapas e o motor com os dados do servidor antes de desenhar a tela.
  applyLive(props.live);
  applyNewMaps(props.collected);
  setCollected(props.collected);

  const [screen, setScreen] = useState<Screen>("home");
  const [back, setBack] = useState<Screen>("home"); // para onde "Meus Brawlers" volta
  const [training, setTraining] = useState(false);
  const [map, setMap] = useState<GameMap | null>(null);
  const [round, setRound] = useState(0); // aumenta a cada "novo draft", para recomeçar do zero
  const [trio, setTrio] = useState(false); // escolhendo mapa para um draft em trio?
  const [setup, setSetup] = useState<DraftSetupChoice | null>(null); // respostas do início do draft
  const [recSummary, setRecSummary] = useState<RecSummary | null>(null);
  const [profileTag, setProfileTag] = useState<string | null>(null); // perfil aberto por link (?perfil=TAG)
  const [profileOpen, setProfileOpen] = useState(0); // muda a cada toque em "Perfil" no menu (volta para o seu)
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [duelCode, setDuelCode] = useState<string | null>(null); // duelo aberto por link (?duelo=CODIGO)
  const [siteStats, setSiteStats] = useState<SiteStats>({}); // números do uso do site (conquistas)
  const [recovery, setRecovery] = useState<Session | null>(null); // veio pelo link "esqueci minha senha"
  const [mfaOn, setMfaOn] = useState<boolean | null>(null); // verificação em 2 etapas ligada?
  const mfaPending = useRef<{ session: Session; factorId: string } | null>(null);
  const [room, setRoom] = useState<string | null>(null); // código da sala atual
  const [roomInit, setRoomInit] = useState<{ state: RoomState; version: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // aviso rápido
  const [, setTick] = useState(0); // força redesenhar quando as correções do admin chegam

  // Preferências e dados salvos no navegador (e na conta, se estiver logado).
  const [mode, setMode] = useState<ModeName>("claro");
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
  const [moderator, setModerator] = useState(false);

  // Cópia sempre atual dos dados, para gravar na conta sem pegar valores velhos.
  const data = useRef({ history, owned, roster, free6, tag, nick, session, stats: siteStats });
  data.current = { history, owned, roster, free6, tag, nick, session, stats: siteStats };
  const visited = useRef(new Set<string>());

  const t = STR[lang];
  const personal = useMemo(() => personalStats(history), [history]);
  const comfort = useMemo(() => comfortScores(roster), [roster]);
  // Verificação em 2 etapas: está ligada nesta conta?
  useEffect(() => {
    if (!session) return;
    let alive = true;
    listFactors(session).then((f) => alive && setMfaOn(f.some((x) => x.status === "verified")));
    return () => {
      alive = false;
    };
  }, [session]);

  // Vitórias seguindo a sugestão (para as conquistas): contadas pelo histórico.
  useEffect(() => {
    const n = history.filter((h) => h.followed && h.win).length;
    if (n > (data.current.stats.followedWins ?? 0)) bumpStats((s) => ({ ...s, followedWins: n }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);
  const myBestRank = useMemo(() => history.reduce<number | null>((m, h) => (h.rank !== undefined && (m === null || h.rank > m) ? h.rank : m), null), [history]);
  const alertMaps = useMemo(() => goodMaps(history, roster, BRAWLERS, MAPS), [history, roster]);
  // Avisos ligados? Mantém a lista de mapas em dia (no máximo uma vez a cada 12 horas).
  useEffect(() => {
    const last = load<number>("bd-push-refresh", 0);
    if (Date.now() - last < 12 * 3600 * 1000) return;
    const timer = setTimeout(() => {
      save("bd-push-refresh", Date.now());
      refreshPush(alertMaps, lang);
    }, 3000);
    return () => clearTimeout(timer);
  }, [alertMaps, lang]);

  /** Grava tudo na conta (se estiver logado). Renova a sessão se precisar. */
  async function pushToAccount(changes: Partial<typeof data.current> = {}) {
    const d = { ...data.current, ...changes };
    const s = await freshSession(d.session);
    if (!s) return;
    if (s !== data.current.session) {
      setSession(s);
      save("bd-session", s);
    }
    saveUserData(s, { history: d.history, owned: d.owned, roster: d.roster, free6: d.free6, tag: d.tag, nick: d.nick, stats: d.stats });
  }

  /** Atualiza os números do site (drafts, Brawler do dia, duelos) e salva na conta. */
  function bumpStats(change: (s: SiteStats) => SiteStats) {
    const next = change(data.current.stats);
    setSiteStats(next);
    save("bd-stats", next);
    data.current = { ...data.current, stats: next };
    pushToAccount({ stats: next });
  }

  /** Login completo: guarda a sessão e junta os dados da conta. */
  async function finishLogin(s: Session) {
    setSession(s);
    save("bd-session", s);
    await syncFromAccount(s, data.current);
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
      stats: mergeStats(local.stats ?? {}, (remote.stats as SiteStats | undefined) ?? {}),
    };
    setHistory(merged.history);
    if (merged.history.length !== (remote.history as HistoryEntry[]).length) pushToAccount({ history: merged.history });
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
    setSiteStats(merged.stats);
    save("bd-stats", merged.stats);
    saveUserData(s, merged);
    setAdmin(await checkAdmin(s));
    setModerator(await isModerator(s));
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
      const json = (await res.json()) as { items?: Match[] };
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
              rounds: it.rounds,
              ...(it.rank !== undefined ? { rank: it.rank } : {}),
              source: "auto" as const,
            };
          })
          .filter((e) => e.mode !== ""); // só os mapas do Ranked que o site conhece
        // Draft ao vivo que terminou com o site fechado: liga o "seguiu a sugestão" à partida.
        const pending = load<PendingDraft | null>("bd-pending-draft", null);
        if (pending) {
          const hit = findDraftMatch(json.items, pending);
          if (hit) {
            const e = entries.find((x) => x.date === hit.date);
            const followed = pending.followed[hit.played];
            if (e && followed !== undefined) e.followed = followed;
            save("bd-pending-draft", null);
            const s = data.current.session;
            if (s && followed !== undefined && e) saveRecResult(s, { followed, win: e.win, map: e.map, brawler: e.played });
          } else if (Date.now() - pending.at > 3 * 3600 * 1000) save("bd-pending-draft", null);
        }
        const beforeCount = data.current.history.length;
        const merged = mergeHistory(data.current.history, entries);
        const added = Math.max(0, merged.length - beforeCount);
        setHistory(merged);
        save("bd-history", merged);
        if (added > 0) pushToAccount({ history: merged });
        setSyncMessage(STR[load<string>("bd-lang", "pt") === "en" ? "en" : "pt"].syncDone(added));

        // OS 6 GRÁTIS: um Brawler que você tem abaixo do nível 11 mas jogou no Ranked
        // com nível 11 só pode ser um dos grátis da temporada. Marca sozinho.
        const lowLevel = new Set(data.current.roster.filter((r) => r.power < 11).map((r) => r.id));
        const found = json.items.filter((it) => it.playedPower >= 11 && lowLevel.has(it.played)).map((it) => it.played);
        const nextFree = [...new Set([...data.current.free6, ...found])].slice(0, 6);
        if (nextFree.length !== data.current.free6.length) {
          const nextOwned = rankedOwned(data.current.roster, nextFree);
          setFree6(nextFree);
          setOwned(nextOwned);
          save("bd-free6", nextFree);
          save("bd-owned", nextOwned);
          data.current = { ...data.current, free6: nextFree, owned: nextOwned };
          pushToAccount({ free6: nextFree, owned: nextOwned });
        }
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
    const savedLang: Lang = load<string>("bd-lang", "pt") === "en" ? "en" : "pt";
    setLang(savedLang);
    const local = {
      history: cleanHistory(load<HistoryEntry[]>("bd-history", [])),
      owned: load<number[]>("bd-owned", []),
      roster: load<RosterItem[]>("bd-roster", []),
      free6: load<number[]>("bd-free6", []),
      tag: load<string>("bd-tag", ""),
      nick: load<string>("bd-nick", ""),
      session: null,
      stats: load<SiteStats>("bd-stats", {}),
    };
    setHistory(local.history);
    setOwned(local.owned);
    setRoster(local.roster);
    setFree6(local.free6);
    setTag(local.tag);
    setNick(local.nick);
    setSiteStats(local.stats);
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

    // Service worker (avisos no celular e instalar como app) e o resumo "as sugestões funcionam?".
    registerWorker();
    if (SUPABASE_ON) loadRecSummary().then(setRecSummary);

    // Mapas ativos hoje.
    fetch("/api/rotation")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { active?: number[] } | null) => setRotation(new Set(j?.active ?? [])))
      .catch(() => setRotation(new Set()));

    // Histórico automático pela tag.
    if (local.tag) syncBattles();

    // Voltou pelo link do e-mail (esqueci minha senha / confirmação)?
    if (window.location.hash.includes("access_token=")) {
      const hash = window.location.hash;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      sessionFromLink(hash).then((r) => {
        if (!r) return;
        if (r.type === "recovery") {
          setRecovery(r.session);
          setScreen("account");
        } else {
          setSession(r.session);
          save("bd-session", r.session);
          syncFromAccount(r.session, data.current);
        }
      });
    }

    // Abriu um link de duelo (?duelo=CODIGO) ou do jogo do dia (?jogo=dia)?
    const params = new URLSearchParams(window.location.search);
    const duelo = params.get("duelo");
    if (duelo && /^[A-Z0-9]{4,8}$/i.test(duelo)) {
      setDuelCode(duelo.toUpperCase());
      setScreen("duel");
    }
    if (params.get("jogo") === "dia") setScreen("daily");

    // Abriu um link de perfil (?perfil=TAG)? Mostra o perfil.
    const perfil = new URLSearchParams(window.location.search).get("perfil");
    if (perfil && /^[0-9A-Z]{3,14}$/i.test(perfil)) {
      setProfileTag(perfil.toUpperCase());
      setScreen("profile");
    }

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
  async function startRoom(m: GameMap, c: DraftSetupChoice | null) {
    setNotice(t.roomCreating);
    const code = newRoomCode();
    const state: RoomState = { mapId: m.id, first: c?.first ?? "mine", bans: [], mine: [], enemies: [], bansDone: c ? !c.bans : false };
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
    setTrio(kind === "trio");
    leaveRoom();
    setMap(m);
    if (kind === "train") {
      setSetup(null);
      setRound(round + 1);
      setScreen("draft");
    } else {
      // Ao vivo e trio: primeiro a tela de início (bans e first pick).
      setScreen("setup");
    }
    window.scrollTo({ top: 0 });
  }

  /** Respondeu o início do draft: abre o draft (ou cria a sala do trio). */
  function startFromSetup(c: DraftSetupChoice) {
    if (!map) return;
    setSetup(c);
    if (trio) {
      startRoom(map, c);
      return;
    }
    setRound(round + 1);
    setScreen("draft");
  }

  /** Navegação pelo menu do topo e pelos botões da tela inicial. */
  function go(where: NavKey | "trio" | "account") {
    setNotice(null);
    if (where === "profile") {
      setProfileTag(null);
      setProfileOpen((n) => n + 1);
    }
    if (where === "compare") setCompareWith(null);
    if (where === "duel") setDuelCode(null);
    if (/perfil=|duelo=|jogo=/.test(window.location.search)) window.history.replaceState(null, "", "/");
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
    screen === "maps" || screen === "draft" || screen === "setup" ? (training ? "train" : "draft") : screen === "account" ? "home" : screen;

  return (
    <Shell
      t={t}
      mode={mode}
      lang={lang}
      current={current}
      account={session ? nick || session.user.email : null}
      isAdmin={admin || moderator}
      onMode={(m: ModeName) => {
        setMode(m);
        save("bd-mode", m);
      }}
      onLang={(l: Lang) => {
        setLang(l);
        save("bd-lang", l);
      }}
      onNav={(where: NavKey) => go(where)}
      onAccount={() => go("account")}
    >
      {notice && <p className={`${PANEL} mb-5 px-4 py-3 text-sm`}>{notice}</p>}

      {/* Alerta de tilt: 3 derrotas seguidas no Ranked */}
      {(screen === "home" || screen === "setup" || (screen === "draft" && !training)) && (
        <div className="mb-5">
          <TiltBanner t={t} history={history} />
        </div>
      )}

      {screen === "home" && (
        <Home
          t={t}
          lang={lang}
          live={props.live}
          metaHistory={props.metaHistory}
          battles={Math.round(props.collected?.battles ?? 0)}
          mapCount={rankedMapCount(props.collected) ?? MAPS.length}
          ownedCount={owned.length}
          historyCount={history.length}
          rotation={rotation}
          showTrio={ROOMS_ENABLED}
          loggedIn={session !== null}
          recSummary={recSummary}
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

      {screen === "setup" && map && (
        <DraftSetup
          t={t}
          lang={lang}
          map={map}
          title={trio ? t.trio : t.liveDraft}
          ownedCount={owned.length}
          onlyOwned={onlyOwned}
          tag={tag}
          onChangeMap={() => setScreen("maps")}
          onEditOwned={() => go("owned")}
          onStart={startFromSetup}
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
          initial={
            roomInit ??
            (setup && !training
              ? { state: { mapId: map.id, first: setup.first, bans: [], mine: [], enemies: [], bansDone: !setup.bans }, version: 1 }
              : null)
          }
          onTrainScore={(score: number, mapName: string) => {
            const s = data.current.session;
            if (!s) return;
            saveScore(s, (data.current.nick || s.user.email.split("@")[0]).slice(0, 20).padEnd(2, "_"), score, mapName).then((ok) => ok && setNotice(t.lbSaved));
          }}
          onToggleOnlyOwned={() => {
            save("bd-only-owned", !onlyOwned);
            setOnlyOwned(!onlyOwned);
          }}
          onEditOwned={() => go("owned")}
          onChangeMap={() => {
            if (!training) setTrio(room !== null); // trocar o mapa numa sala cria uma sala nova
            leaveRoom();
            setScreen("maps");
          }}
          onRestart={() => {
            leaveRoom();
            setRound(round + 1);
          }}
          tag={tag}
          onDraftDone={() => bumpStats((s) => ({ ...s, drafts: (s.drafts ?? 0) + 1 }))}
          onSave={(entry: HistoryEntry) => {
            const s = data.current.session;
            if (s && entry.followed !== undefined)
              saveRecResult(s, { followed: entry.followed, win: entry.win, map: entry.map, brawler: entry.played });
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
          recSummary={recSummary}
          alertMaps={alertMaps}
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
          rotation={rotation}
          comfort={comfort}
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
            // Conta com verificação em 2 etapas: pede o código antes de entrar.
            const factor = (await listFactors(r.session)).find((f) => f.status === "verified");
            if (factor) {
              mfaPending.current = { session: r.session, factorId: factor.id };
              return "mfa";
            }
            await finishLogin(r.session);
            return null;
          }}
          onMfaCode={async (code: string) => {
            const p = mfaPending.current;
            if (!p) return "erro";
            const r = await verifyTotp(p.session, p.factorId, code);
            if (!r.session) return r.error ?? "erro";
            mfaPending.current = null;
            await finishLogin(r.session);
            return null;
          }}
          onForgot={(email: string) => requestPasswordReset(email, window.location.origin)}
          recovery={recovery !== null}
          onNewPassword={async (password: string) => {
            const s = recovery ?? (await freshSession(session));
            if (!s) return "sessão";
            const err = await updatePassword(s, password);
            if (err) return err;
            if (recovery) {
              setRecovery(null);
              await finishLogin(recovery);
            }
            return null;
          }}
          mfaEnabled={mfaOn}
          onEnableMfa={async () => {
            const s = await freshSession(session);
            return s ? enrollTotp(s) : "sessão";
          }}
          onConfirmMfa={async (id: string, code: string) => {
            const s = await freshSession(session);
            if (!s) return "sessão";
            const r = await verifyTotp(s, id, code);
            if (!r.session) return r.error ?? "erro";
            setSession(r.session);
            save("bd-session", r.session);
            setMfaOn(true);
            return null;
          }}
          onDisableMfa={async () => {
            const s = await freshSession(session);
            if (!s) return "sessão";
            for (const f of await listFactors(s)) await unenrollFactor(s, f.id);
            setMfaOn(false);
            return null;
          }}
          onLogout={() => {
            setSession(null);
            setMfaOn(null);
            setAdmin(false);
            setModerator(false);
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

      {screen === "compare" && <CompareScreen key={compareWith ?? "c"} t={t} lang={lang} myTag={tag} initialB={compareWith ?? undefined} />}

      {screen === "daily" && (
        <DailyScreen
          t={t}
          lang={lang}
          onResult={(won, st) =>
            bumpStats((s) => ({ ...s, dailyWins: (s.dailyWins ?? 0) + (won ? 1 : 0), dailyBestStreak: Math.max(s.dailyBestStreak ?? 0, st.best) }))
          }
        />
      )}

      {screen === "duel" && (
        <DuelScreen
          key={duelCode ?? "novo"}
          t={t}
          lang={lang}
          nick={nick}
          initialCode={duelCode}
          rotation={rotation}
          onResult={(won) => bumpStats((s) => ({ ...s, duelsPlayed: (s.duelsPlayed ?? 0) + 1, duelsWon: (s.duelsWon ?? 0) + (won ? 1 : 0) }))}
        />
      )}

      {screen === "profile" && (
        <ProfileScreen
          key={`${profileTag ?? "me"}-${profileOpen}`}
          t={t}
          lang={lang}
          myTag={tag}
          initialTag={profileTag}
          myStats={siteStats}
          myBestRank={myBestRank}
          onCompare={(other) => {
            go("compare");
            setCompareWith(other === tag.replace(/^#/, "").toUpperCase() ? null : other);
          }}
        />
      )}

      {screen === "admin" && (
        <AdminScreen
          t={t}
          lang={lang}
          session={session}
          isAdmin={admin}
          isMod={moderator}
          onOpenProfile={(tg) => {
            go("profile");
            setProfileTag(tg.replace(/^#/, "").toUpperCase());
          }}
        />
      )}
    </Shell>
  );
}
