// Página inicial. Roda no SERVIDOR: busca o meta atual e entrega para o site.

import App from "@/components/App";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { getLiveMeta } from "@/lib/livemeta";

// A Vercel refaz esta página no máximo a cada 12 horas (60 * 60 * 12 segundos),
// buscando o meta de novo. Entre uma atualização e outra, todo mundo recebe a versão guardada.
export const revalidate = 43200;

export default async function Home() {
  const live = await getLiveMeta(
    MAPS.map((m) => m.gameId),
    BRAWLERS.map((b) => b.name),
  );
  return <App live={live} />;
}
