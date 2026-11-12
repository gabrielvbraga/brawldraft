// Página inicial. Roda no SERVIDOR: busca o meta atual, as contas do coletor e as
// cópias diárias do meta, e entrega tudo para o site.

import App from "@/components/App";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { SNAPSHOT } from "@/data/snapshot";
import { getLiveMeta } from "@/lib/livemeta";
import { getCollected, getMetaHistory } from "@/lib/stats";

// O meta é guardado por 12 horas dentro de getLiveMeta (src/lib/livemeta.ts); as contas
// do coletor e as cópias diárias, por 1 hora (src/lib/stats.ts).

export default async function Home() {
  const [live, collected, metaHistory] = await Promise.all([
    getLiveMeta(
      MAPS.map((m) => m.gameId),
      BRAWLERS.map((b) => b.name),
    ),
    getCollected(),
    getMetaHistory(),
  ]);
  // Se a leitura ao vivo falhar, usa a cópia salva do topbrawl (nunca outra fonte).
  return <App live={live ?? SNAPSHOT} collected={collected} metaHistory={metaHistory} />;
}
