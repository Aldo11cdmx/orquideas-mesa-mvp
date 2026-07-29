import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Imperio · Servicio en mesa",
  description: "Desayunos, comida corrida y pedidos desde mesa en tiempo real",
  manifest: "/manifest.webmanifest",
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
  themeColor: "#35322f"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
