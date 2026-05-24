import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gráficos Premium · Riesgo Geopolítico",
  description:
    "Análisis de riesgo geopolítico y métricas institucionales con Monte Carlo (Merton Jump-Diffusion), Sortino, Calmar, drawdown y correlaciones macro.",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </body>
    </html>
  );
}
