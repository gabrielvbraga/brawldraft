// MOLDURA GERAL DO SITE: título, ícone, cor da barra do celular e fontes.

import type { Metadata, Viewport } from "next";
import { Inter, Lilita_One } from "next/font/google";
import "./globals.css";

// Fonte de título (parecida com a do Brawl Stars) e fonte do texto comum.
const display = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "BrawlDraft",
  description: "Assistente de draft para o Ranked do Brawl Stars: bans, counters e a melhor escolha para cada mapa.",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "BrawlDraft", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07080b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
