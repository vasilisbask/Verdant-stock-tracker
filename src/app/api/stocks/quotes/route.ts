import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getCompanyMeta, cacheCompanyMeta } from "@/lib/stocks";

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

interface CacheEntry {
  data: QuoteResult;
  timestamp: number;
}

// Initialize the YahooFinance instance with customized configurations
const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15000; // Cache quotes for 15 seconds to prevent server overload

// Generate a clean placeholder quote for failed or invalid symbols
function generateErrorQuote(symbol: string): QuoteResult {
  const meta = getCompanyMeta(symbol);
  return {
    sym: symbol,
    price: "—",
    chg: "—",
    pct: "—",
    up: false,
    vol: "—",
    pe: "—",
    mkt: "—",
    companyName: meta ? meta.name : symbol,
  };
}

// Map a raw Yahoo Finance quote object to QuoteResult
function mapYahooQuote(q: any): QuoteResult {
  const symbol = q.symbol.toUpperCase();

  const price = q.regularMarketPrice ? q.regularMarketPrice.toFixed(2) : "—";
  const changeVal = q.regularMarketChange ?? 0;
  const pctVal = q.regularMarketChangePercent ?? 0;
  const up = changeVal >= 0;

  const chg = q.regularMarketPrice ? ((up ? "+" : "") + changeVal.toFixed(2)) : "—";
  const pct = q.regularMarketPrice ? ((up ? "+" : "") + pctVal.toFixed(2) + "%") : "—";

  const vol = q.regularMarketVolume ? q.regularMarketVolume.toLocaleString() : "—";
  const pe = q.trailingPE ? q.trailingPE.toFixed(1) : (q.forwardPE ? q.forwardPE.toFixed(1) : "—");
  
  // Calculate Market Cap dynamically
  let mkt = "—";
  if (q.marketCap) {
    const val = q.marketCap / 1e9;
    if (val >= 1000) {
      mkt = (val / 1000).toFixed(2) + "T";
    } else {
      mkt = val.toFixed(1) + "B";
    }
  }

  const companyName = q.displayName || q.longName || q.shortName || getCompanyMeta(symbol)?.name || symbol;

  // Cache metadata
  cacheCompanyMeta(symbol, companyName, "Other");

  return {
    sym: symbol,
    price,
    chg,
    pct,
    up,
    vol,
    pe,
    mkt,
    companyName,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsQuery = searchParams.get("symbols");
  const now = Date.now();

  // Parameterless load fetches Top 50 most active stocks dynamically
  if (!symbolsQuery) {
    try {
      const activeRes = (await yahooFinance.screener({ scrIds: 'most_actives', count: 50 }, undefined, { validateResult: false })) as any;
      const rawQuotes = activeRes?.quotes || [];
      
      const mapped = rawQuotes.map((q: any) => {
        const mappedQuote = mapYahooQuote(q);
        // Save in quoteCache
        quoteCache.set(mappedQuote.sym, { data: mappedQuote, timestamp: now });
        return mappedQuote;
      });

      if (mapped.length === 0) {
        throw new Error("Empty screener quotes list");
      }

      return NextResponse.json({ data: mapped, isMock: false });

    } catch (screenerErr) {
      console.warn("[Yahoo Finance Proxy] Predefined screener 'most_actives' failed:", (screenerErr as Error).message);
      
      // Bulk fetch standard dynamic symbols if the screener endpoint fails
      const fallbackSymbols = ["AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL", "META", "JPM", "V", "NFLX"];
      try {
        const res = await yahooFinance.quote(fallbackSymbols, {}, { validateResult: false });
        const rawQuotes = Array.isArray(res) ? res : [res];
        const mapped = rawQuotes.map((q: any) => {
          const mappedQuote = mapYahooQuote(q);
          quoteCache.set(mappedQuote.sym, { data: mappedQuote, timestamp: now });
          return mappedQuote;
        });
        return NextResponse.json({ data: mapped, isMock: false });
      } catch (_fallbackErr) {
        return NextResponse.json({
          success: false,
          data: [],
          error: "Yahoo Finance quote feed is temporarily offline."
        }, { status: 503 });
      }
    }
  }

  // Handle specific tickers query
  const symbols = symbolsQuery.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const results: QuoteResult[] = [];
  const uncachedSymbols: string[] = [];

  // Check Cache First
  symbols.forEach((symbol) => {
    const cached = quoteCache.get(symbol);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      results.push(cached.data);
    } else {
      uncachedSymbols.push(symbol);
    }
  });

  // Fetch Uncached Tickers
  if (uncachedSymbols.length > 0) {
    let rawQuotes: any[] = [];
    let isServiceOffline = false;
    
    try {
      const res = await yahooFinance.quote(uncachedSymbols, {}, { validateResult: false });
      rawQuotes = Array.isArray(res) ? res : [res];

    } catch (bulkErr) {
      console.warn("[Yahoo Finance Proxy] Bulk query failed, falling back to parallel individual queries:", (bulkErr as Error).message);

      const errorMsg = (bulkErr as Error).message.toLowerCase();
      if (errorMsg.includes("enotfound") || errorMsg.includes("econnrefused") || errorMsg.includes("network")) {
        isServiceOffline = true;
      }

      if (!isServiceOffline) {
        await Promise.all(
          uncachedSymbols.map(async (symbol) => {
            try {
              const res = await yahooFinance.quote(symbol, {}, { validateResult: false });
              if (res) {
                rawQuotes.push(res);
              }
            } catch (individualErr) {
              console.error(`[Yahoo Finance Proxy] Failed individual fetch for ${symbol}:`, (individualErr as Error).message);
              results.push(generateErrorQuote(symbol));
            }
          })
        );
      }
    }

    if (isServiceOffline) {
      return NextResponse.json({
        success: false,
        data: [],
        error: "Yahoo Finance quote feed is temporarily offline."
      }, { status: 503 });
    }

    // Process and Map Fetched Quotes
    rawQuotes.forEach((q) => {
      if (!q || !q.symbol) return;
      const mappedQuote = mapYahooQuote(q);
      quoteCache.set(mappedQuote.sym, { data: mappedQuote, timestamp: now });
      results.push(mappedQuote);
    });
  }

  if (results.length === 0 && symbols.length > 0) {
    return NextResponse.json({
      success: false,
      data: [],
      error: "Yahoo Finance quote feed is temporarily offline."
    }, { status: 503 });
  }

  const orderedResults = symbols
    .map(sym => results.find(r => r.sym === sym) || generateErrorQuote(sym))
    .filter(Boolean) as QuoteResult[];

  return NextResponse.json({ data: orderedResults, isMock: false });
}
