// MOLDURA GERAL DO SITE: título, ícone, cor da barra do celular e fonte.

import type { Metadata, Viewport } from "next";
import { Lilita_One } from "next/font/google";
import "./globals.css";

// Fonte parecida com a do Brawl Stars.
const lilita = Lilita_One({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BrawlDraft",
  description: "Assistente de draft para o Ranked do Brawl Stars: bans, counters e a melhor escolha para cada mapa.",
  // Ícone usado quando o site é adicionado à tela inicial do iPhone.
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "BrawlDraft", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d0717",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={lilita.className}>{children}</body>
    </html>
  );
}
