import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdant — Stock Tracker",
  description:
    "Real-time quotes, multi-factor screener, and a watchlist built for serious traders.",
  keywords: ["stock tracker", "stock screener", "real-time quotes", "equity watchlist", "market data"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

