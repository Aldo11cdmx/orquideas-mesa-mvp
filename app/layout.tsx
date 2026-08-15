import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Imperio · Servicio en mesa",
  description: "Desayunos, comida corrida y pedidos desde mesa en tiempo real",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Imperio"
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent"
  },
  openGraph: {
    title: "Imperio · Cocina de barrio",
    description: "Desayunos de 9 a 5 y comida corrida de 1 a 5.",
    images: [{ url: "/og.png", width: 1728, height: 910, alt: "Menú de Imperio" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Imperio · Cocina de barrio",
    description: "Desayunos de 9 a 5 y comida corrida de 1 a 5.",
    images: ["/og.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#5c3d2e",
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
