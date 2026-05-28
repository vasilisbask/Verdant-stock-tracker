import type { Metadata } from "next";
import { Playfair_Display, IBM_Plex_Mono, Barlow } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--f-serif",
  weight: ["700", "800", "900"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--f-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  variable: "--f-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verdant — Stock Tracker",
  description:
    "Real-time quotes, multi-factor screener, and a watchlist built for serious traders.",
  keywords: ["stock tracker", "stock screener", "real-time quotes", "equity watchlist", "market data"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${ibmPlexMono.variable} ${barlow.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

