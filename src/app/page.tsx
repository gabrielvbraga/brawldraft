// Página inicial. Roda no SERVIDOR: busca o meta atual e entrega para o site.

import App from "@/components/App";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { getLiveMeta } from "@/lib/livemeta";

// O meta é guardado por 12 horas dentro de getLiveMeta (veja src/lib/livemeta.ts).
// Entre uma atualização e outra, todo mundo recebe a versão guardada.

export default async function Home() {
  const live = await getLiveMeta(
    MAPS.map((m) => m.gameId),
    BRAWLERS.map((b) => b.name),
  );
  return <App live={live} />;
}
