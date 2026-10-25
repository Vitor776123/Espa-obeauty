import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Espaço Beauty",
    short_name: "Espaço Beauty",
    description: "Agende seu horário no Espaço Beauty, de Eliana Domingues.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf5f3",
    theme_color: "#3b1526",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
