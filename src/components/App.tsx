"use client";
// PEÇA PRINCIPAL DO SITE
// Guarda em qual tela estamos e as preferências (tema, idioma, seus Brawlers,
// histórico) e mostra a tela certa. "use client" = roda no navegador.

import { useEffect, useMemo, useState } from "react";
import { applyLive } from "@/data/applyLive";
import { BRAWLERS } from "@/data/brawlers";
import type { LiveMeta } from "@/lib/livemeta";
import { STR, type Lang } from "@/lib/i18n";
import { ROOMS_ENABLED, createRoom, newRoomCode, readRoom, type RoomState } from "@/lib/room";
import { load, personalStats, save, type HistoryEntry } from "@/lib/storage";
import { MAPS } from "@/data/maps";
import type { GameMap } from "@/lib/types";
import DraftScreen from "./DraftScreen";
import { HistoryScreen, Home, MapPicker, MetaScreen, OwnedScreen } from "./screens";
import { PANEL, Shell, THEMES, type ThemeName } from "./ui";

type Screen = "home" | "maps" | "draft" | "meta" | "history" | "owned";

export default function App(props: { live: LiveMeta | null }) {
  // Atualiza as listas de Brawlers e mapas com o meta ao vivo antes de desenhar a tela.
  applyLive(props.live);

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
  const [theme, setTheme] = useState<ThemeName>("roxo");
  const [lang, setLang] = useState<Lang>("pt");
  const [owned, setOwned] = useState<number[]>([]);
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Roda uma vez quando a página abre: carrega o que estava salvo.
  useEffect(() => {
    const savedTheme = load<string>("bd-theme", "roxo");
    if (savedTheme in THEMES) setTheme(savedTheme as ThemeName);
    if (load<string>("bd-lang", "pt") === "en") setLang("en");
    setOwned(load<number[]>("bd-owned", []));
    setOnlyOwned(load<boolean>("bd-only-owned", false));
    setHistory(load<HistoryEntry[]>("bd-history", []));

    // Abriu um link de sala (?sala=CODIGO)? Entra direto no draft em trio.
    const code = new URLSearchParams(window.location.search).get("sala");
    if (code && ROOMS_ENABLED) {
      readRoom(code.toUpperCase()).then((r) => {
        const m = r ? MAPS.find((x) => x.id === r.state.mapId) : undefined;
        if (!r || !m) {
          setNotice(STR[load<string>("bd-lang", "pt") === "en" ? "en" : "pt"].roomNotFound);
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

  const t = STR[lang];
  const personal = useMemo(() => personalStats(history), [history]);

  function changeOwned(next: number[]) {
    setOwned(next);
    save("bd-owned", next);
  }

  function goOwned(from: Screen) {
    setBack(from);
    setScreen("owned");
  }

  return (
    <Shell
      t={t}
      theme={theme}
      lang={lang}
      onTheme={(name: ThemeName) => {
        setTheme(name);
        save("bd-theme", name);
      }}
      onLang={(l: Lang) => {
        setLang(l);
        save("bd-lang", l);
      }}
      onHome={
        screen === "home"
          ? undefined
          : () => {
              leaveRoom();
              setScreen("home");
            }
      }
    >
      {notice && <p className={`${PANEL} mb-3 px-3 py-2 font-sans text-sm text-white`}>{notice}</p>}
      {screen === "home" && (
        <Home
          t={t}
          lang={lang}
          updatedAt={props.live?.updatedAt ?? null}
          ownedCount={owned.length}
          historyCount={history.length}
          showTrio={ROOMS_ENABLED}
          onGo={(where: "draft" | "train" | "trio" | "meta" | "history" | "owned") => {
            setNotice(null);
            if (where === "draft" || where === "train" || where === "trio") {
              setTraining(where === "train");
              setTrio(where === "trio");
              setScreen("maps");
            } else if (where === "owned") goOwned("home");
            else setScreen(where);
          }}
        />
      )}

      {screen === "maps" && (
        <MapPicker
          t={t}
          lang={lang}
          title={training ? t.training : trio ? t.trio : t.liveDraft}
          onPick={(m: GameMap) => {
            if (trio) {
              startRoom(m);
              return;
            }
            leaveRoom();
            setMap(m);
            setRound(round + 1);
            setScreen("draft");
          }}
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
          onToggleOnlyOwned={() => {
            save("bd-only-owned", !onlyOwned);
            setOnlyOwned(!onlyOwned);
          }}
          onEditOwned={() => goOwned("draft")}
          room={room}
          initial={roomInit}
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
    </Shell>
  );
}
