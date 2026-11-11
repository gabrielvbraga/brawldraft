"use client";
// PEÇA PRINCIPAL DO SITE
// Guarda em qual tela estamos e as preferências (tema, idioma, seus Brawlers,
// histórico) e mostra a tela certa. "use client" = roda no navegador.

import { useEffect, useMemo, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { STR, type Lang } from "@/lib/i18n";
import { load, personalStats, save, type HistoryEntry } from "@/lib/storage";
import type { GameMap } from "@/lib/types";
import DraftScreen from "./DraftScreen";
import { HistoryScreen, Home, MapPicker, MetaScreen, OwnedScreen } from "./screens";
import { Shell, THEMES, type ThemeName } from "./ui";

type Screen = "home" | "maps" | "draft" | "meta" | "history" | "owned";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [back, setBack] = useState<Screen>("home"); // para onde "Meus Brawlers" volta
  const [training, setTraining] = useState(false);
  const [map, setMap] = useState<GameMap | null>(null);
  const [round, setRound] = useState(0); // aumenta a cada "novo draft", para recomeçar do zero

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
  }, []);

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
      onHome={screen === "home" ? undefined : () => setScreen("home")}
    >
      {screen === "home" && (
        <Home
          t={t}
          ownedCount={owned.length}
          historyCount={history.length}
          onGo={(where: "draft" | "train" | "meta" | "history" | "owned") => {
            if (where === "draft" || where === "train") {
              setTraining(where === "train");
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
          title={training ? t.training : t.liveDraft}
          onPick={(m: GameMap) => {
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
          onChangeMap={() => setScreen("maps")}
          onRestart={() => setRound(round + 1)}
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
          onDone={() => setScreen(back)}
        />
      )}
    </Shell>
  );
}
