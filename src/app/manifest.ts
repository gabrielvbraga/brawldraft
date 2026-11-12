// "Manifesto" do site: é o que permite instalar o BrawlDraft como app no celular.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BrawlDraft",
    short_name: "BrawlDraft",
    description: "Assistente de draft para o Ranked do Brawl Stars",
    start_url: "/",
    display: "standalone", // abre em tela cheia, sem a barra do navegador
    background_color: "#f6f7f9",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
