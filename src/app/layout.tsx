// MOLDURA GERAL DO SITE: título, ícone, cor da barra do celular e fontes.

import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Uma fonte só no site inteiro (Poppins): texto comum mais leve, títulos em negrito.
const poppins = Poppins({ weight: ["400", "500", "600", "700", "800"], subsets: ["latin"], variable: "--font-main" });

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
    <html lang="pt-BR" className={poppins.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
