"use client";
// PEÇA PRINCIPAL DO SITE
// Guarda em qual tela estamos e as preferências (tema, idioma, seus Brawlers,
// histórico, conta) e mostra a tela certa. "use client" = roda no navegador.

import { useEffect, useMemo, useRef, useState } from "react";
import { applyLive } from "@/data/applyLive";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import type { Collected } from "@/lib/collector";
import { setCollected } from "@/lib/engine";
import { STR, type Lang } from "@/lib/i18n";
import type { LiveMeta } from "@/lib/livemeta";
import { ROOMS_ENABLED, createRoom, newRoomCode, readRoom, type RoomState } from "@/lib/room";
import { load, personalStats, save, type HistoryEntry } from "@/lib/storage";
import { SUPABASE_ON, freshSession, loadUserData, saveUserData, signIn, signUp, type Session } from "@/lib/supabase";
import type { GameMap } from "@/lib/types";
import DraftScreen from "./DraftScreen";
import { AccountScreen, HistoryScreen, Home, MapPicker, MetaScreen, OwnedScreen } from "./screens";
import { PANEL, Shell, THEMES, type NavKey, type ThemeName } from "./ui";

type Screen = "home" | "maps" | "draft" | "meta" | "history" | "owned" | "account";

/** Junta dois históricos sem repetir partidas (a data identifica cada uma). */
function mergeHistory(a: HistoryEntry[], b: HistoryEntry[]): HistoryEntry[] {
  const byDate = new Map<string, HistoryEntry>();
  for (const h of [...a, ...b]) byDate.set(h.date, h);
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
}

export default function App(props: { live: LiveMeta | null; collected: Collected | null }) {
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
  const [notice, setNotice] = useState<string | null>(null); // aviso rápido (erro de sala etc.)

  // Preferências salvas no navegador.
  const [theme, setTheme] = useState<ThemeName>("ouro");
  const [lang, setLang] = useState<Lang>("pt");
  const [owned, setOwned] = useState<number[]>([]);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Conta (Supabase). A sessão fica salva no navegador para não precisar entrar toda vez.
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const t = STR[lang];
  const personal = useMemo(() => personalStats(history), [history]);

  /** Busca os dados da conta e junta com os deste aparelho. */
  async function syncFromAccount(s: Session, localHistory: HistoryEntry[], localOwned: number[]) {
    const remote = await loadUserData(s);
    if (!remote) return;
    const mergedHistory = mergeHistory(remote.history as HistoryEntry[], localHistory);
    const mergedOwned = remote.owned.length > 0 ? remote.owned : localOwned;
    setHistory(mergedHistory);
    setOwned(mergedOwned);
    save("bd-history", mergedHistory);
    save("bd-owned", mergedOwned);
    saveUserData(s, { history: mergedHistory, owned: mergedOwned });
  }

  /** Grava na conta (se estiver logado). Renova a sessão se precisar. */
  async function pushToAccount(nextHistory: HistoryEntry[], nextOwned: number[]) {
    const s = await freshSession(sessionRef.current);
    if (!s) return;
    if (s !== sessionRef.current) {
      setSession(s);
      save("bd-session", s);
    }
    saveUserData(s, { history: nextHistory, owned: nextOwned });
  }

  // Roda uma vez quando a página abre: carrega o que estava salvo.
  useEffect(() => {
    const savedTheme = load<string>("bd-theme", "ouro");
    if (savedTheme in THEMES) setTheme(savedTheme as ThemeName);
    const savedLang: Lang = load<string>("bd-lang", "pt") === "en" ? "en" : "pt";
    setLang(savedLang);
    const localOwned = load<number[]>("bd-owned", []);
    const localHistory = load<HistoryEntry[]>("bd-history", []);
    setOwned(localOwned);
    setOnlyOwned(load<boolean>("bd-only-owned", false));
    setHistory(localHistory);

    // Estava logado? Renova a sessão e sincroniza.
    if (SUPABASE_ON) {
      freshSession(load<Session | null>("bd-session", null)).then((s) => {
        setSession(s);
        save("bd-session", s);
        if (s) syncFromAccount(s, localHistory, localOwned);
      });
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
    pushToAccount(history, next);
  }

  /** Abre um draft (ao vivo, treino ou trio) já no mapa escolhido. */
  function openDraft(m: GameMap, mode: "live" | "train" | "trio") {
    setNotice(null);
    setTraining(mode === "train");
    if (mode === "trio") {
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
    } else setScreen(where);
  }

  const current: NavKey =
    screen === "maps" || screen === "draft" ? (training ? "train" : "draft") : screen === "account" ? "home" : screen;

  return (
    <Shell
      t={t}
      theme={theme}
      lang={lang}
      current={current}
      account={session?.user.email ?? null}
      onTheme={(name: ThemeName) => {
        setTheme(name);
        save("bd-theme", name);
      }}
      onLang={(l: Lang) => {
        setLang(l);
        save("bd-lang", l);
      }}
      onNav={(where: NavKey) => go(where)}
      onAccount={() => go("account")}
    >
      {notice && <p className={`${PANEL} mb-4 px-4 py-3 text-sm text-white`}>{notice}</p>}

      {screen === "home" && (
        <Home
          t={t}
          lang={lang}
          updatedAt={props.live?.updatedAt ?? null}
          battles={Math.round(props.collected?.battles ?? 0)}
          ownedCount={owned.length}
          historyCount={history.length}
          showTrio={ROOMS_ENABLED}
          loggedIn={session !== null}
          onGo={(where: "draft" | "train" | "trio" | "meta" | "history" | "owned" | "account") => go(where)}
          onPickMap={(m: GameMap) => openDraft(m, "live")}
        />
      )}

      {screen === "maps" && (
        <MapPicker
          t={t}
          lang={lang}
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
          room={room}
          initial={roomInit}
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
            const next = [...history, entry];
            setHistory(next);
            save("bd-history", next);
            pushToAccount(next, owned);
          }}
        />
      )}

      {screen === "meta" && <MetaScreen t={t} lang={lang} />}

      {screen === "history" && (
        <HistoryScreen
          t={t}
          lang={lang}
          history={history}
          onClear={() => {
            if (!window.confirm(t.clearConfirm)) return;
            setHistory([]);
            save("bd-history", []);
            pushToAccount([], owned);
          }}
        />
      )}

      {screen === "owned" && (
        <OwnedScreen
          t={t}
          owned={owned}
          onToggle={(id: number) => changeOwned(owned.includes(id) ? owned.filter((x) => x !== id) : [...owned, id])}
          onAll={(all: boolean) => changeOwned(all ? BRAWLERS.map((b) => b.id) : [])}
          onSet={(ids: number[]) => changeOwned(ids)}
          onDone={() => setScreen(back)}
        />
      )}

      {screen === "account" && (
        <AccountScreen
          t={t}
          enabled={SUPABASE_ON}
          email={session?.user.email ?? null}
          onLogin={async (email: string, password: string, create: boolean) => {
            const r = create ? await signUp(email, password) : await signIn(email, password);
            if (r.error) return r.error;
            if (r.needsConfirm || !r.session) return "confirm";
            setSession(r.session);
            save("bd-session", r.session);
            await syncFromAccount(r.session, history, owned);
            return null;
          }}
          onLogout={() => {
            setSession(null);
            save("bd-session", null);
          }}
        />
      )}
    </Shell>
  );
}
