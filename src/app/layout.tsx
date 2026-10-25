import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: site ? new URL(site) : undefined,
  title: {
    default: "Espaço Beauty — Eliana Domingues",
    template: "%s · Espaço Beauty",
  },
  description:
    "Cabelo, unhas e sobrancelha com hora marcada. Escolha o serviço, veja os horários livres e reserve pelo celular.",
  applicationName: "Espaço Beauty",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Espaço Beauty",
    title: "Espaço Beauty — Eliana Domingues",
    description: "Reserve seu horário online: cabelo, unhas e sobrancelha.",
  },
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Espaço Beauty", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#3b1526",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
