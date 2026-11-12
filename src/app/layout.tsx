// MOLDURA GERAL DO SITE: título, ícone, cor da barra do celular e a fonte.

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Uma fonte só no site inteiro (Inter), do jeito do modelo Clean Pro.
const inter = Inter({ subsets: ["latin"], variable: "--font-main" });

export const metadata: Metadata = {
  title: "BrawlDraft",
  description: "Assistente de draft para o Ranked do Brawl Stars: bans, counters e a melhor escolha para cada mapa.",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "BrawlDraft", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
