// Página inicial. Roda no SERVIDOR: busca o meta atual e as contas do coletor.

import App from "@/components/App";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { SNAPSHOT } from "@/data/snapshot";
import { getLiveMeta } from "@/lib/livemeta";
import { getCollected } from "@/lib/stats";

// O meta é guardado por 12 horas dentro de getLiveMeta (src/lib/livemeta.ts) e as
// contas do coletor por 1 hora dentro de getCollected (src/lib/stats.ts).

export default async function Home() {
  const [live, collected] = await Promise.all([
    getLiveMeta(
      MAPS.map((m) => m.gameId),
      BRAWLERS.map((b) => b.name),
    ),
    getCollected(),
  ]);
  // Se a leitura ao vivo falhar, usa a cópia salva do topbrawl (nunca outra fonte).
  return <App live={live ?? SNAPSHOT} collected={collected} />;
}
