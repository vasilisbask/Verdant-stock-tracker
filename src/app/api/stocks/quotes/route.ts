import { NextRequest, NextResponse } from "next/server";

// Structure matches Landing Page `Tick` type
interface QuoteResult {
  sym: string;
  price: string;
  chg: string;
  pct: string;
  up: boolean;
  vol: string;
  pe: string;
  mkt: string;
  companyName: string;
}

// Simple metadata mapping for ticker to corporate name
const STOCK_METADATA: Record<string, string> = {
  AAPL:  "Apple Inc.",
  NVDA:  "NVIDIA Corp.",
  MSFT:  "Microsoft Corp.",
  TSLA:  "Tesla Inc.",
  AMZN:  "Amazon.com Inc.",
  GOOGL: "Alphabet Inc.",
  META:  "Meta Platforms",
  JPM:   "JPMorgan Chase",
  V:     "Visa Inc.",
  NFLX:  "Netflix Inc.",
};

// High-speed in-memory cache for quote data to reduce API calls and improve performance
interface CacheEntry {
  data: QuoteResult;
  timestamp: number;
}
const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 60 seconds

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsQuery = searchParams.get("symbols");
  
  // Default list of symbols if none provided
  const symbols = symbolsQuery 
    ? symbolsQuery.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
    : Object.keys(STOCK_METADATA);

  const apiKey = process.env.FINNHUB_API_KEY;
  const hasApiKey = !!apiKey && apiKey !== "your_finnhub_api_key_here";

  // If no API key is configured, return an offline status immediately
  if (!hasApiKey) {
    return NextResponse.json({
      success: false,
      data: [],
      isMock: false,
      error: "Finnhub API Key is missing or unconfigured in .env.local. Real-time telemetry is offline."
    }, { status: 503 });
  }

  try {
    const results: QuoteResult[] = [];
    const now = Date.now();

    // Resolve in parallel
    await Promise.all(
      symbols.map(async (symbol) => {
        // Check cache first
        const cached = quoteCache.get(symbol);
        if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
          results.push(cached.data);
          return;
        }

        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
          
          if (!res.ok) {
            throw new Error(`Finnhub error: ${res.status}`);
          }

          const data = await res.json();
          
          // If the symbol is invalid or returns no data
          if (data.c === undefined || data.c === 0) {
            throw new Error("No data returned");
          }

          // Format results perfectly
          const currentPrice = data.c.toFixed(2);
          const changeVal = data.d ?? 0;
          const pctVal = data.dp ?? 0;
          const up = changeVal >= 0;
          
          const chg = (up ? "+" : "") + changeVal.toFixed(2);
          const pct = (up ? "+" : "") + pctVal.toFixed(2) + "%";

          const companyName = STOCK_METADATA[symbol] || symbol;

          const quoteResult: QuoteResult = {
            sym: symbol,
            price: currentPrice,
            chg,
            pct,
            up,
            vol: "—",
            pe: "—",
            mkt: "—",
            companyName: companyName,
          };

          // Cache the fresh quote
          quoteCache.set(symbol, { data: quoteResult, timestamp: now });
          results.push(quoteResult);

        } catch (err) {
          // Graceful down state for this specific symbol if it fails to fetch
          results.push({
            sym: symbol,
            price: "—",
            chg: "—",
            pct: "—",
            up: false,
            vol: "—",
            pe: "—",
            mkt: "—",
            companyName: STOCK_METADATA[symbol] || symbol,
          });
        }
      })
    );

    // Keep chronological order of original symbols query
    const orderedResults = symbols.map(sym => results.find(r => r.sym === sym)).filter(Boolean) as QuoteResult[];

    return NextResponse.json({ data: orderedResults, isMock: false });

  } catch (error) {
    console.error("[Finnhub Quote Proxy] Server failure:", error);
    return NextResponse.json({
      success: false,
      data: [],
      isMock: false,
      error: "Finnhub quote feed is temporarily offline."
    }, { status: 503 });
  }
}
