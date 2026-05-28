import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || !query.trim()) {
    return NextResponse.json({ data: [] });
  }

  try {
    const searchRes = (await yahooFinance.search(query, {}, { validateResult: false })) as any;
    const quotes = searchRes?.quotes || [];
    
    const symbols = Array.from(
      new Set(
        quotes
          .filter((q: any) => q.symbol && typeof q.symbol === "string")
          .map((q: any) => q.symbol.toUpperCase())
      )
    ).slice(0, 10) as string[];

    if (symbols.length === 0) {
      return NextResponse.json({ data: [] });
    }

    let rawQuotes: any[] = [];
    try {
      const quotesRes = (await yahooFinance.quote(symbols, {}, { validateResult: false })) as any;
      rawQuotes = Array.isArray(quotesRes) ? quotesRes : [quotesRes];
    } catch (bulkErr) {
      console.warn("[Yahoo Finance Search API] Bulk quote failed, falling back to parallel individual queries:", (bulkErr as Error).message);
      
      // Isolated parallel query fallback to bypass any broken or delisted tickers
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await yahooFinance.quote(symbol, {}, { validateResult: false });
            if (res) {
              rawQuotes.push(res);
            }
          } catch (individualErr) {
            console.error(`[Yahoo Finance Search API] Failed individual quote for ${symbol}:`, (individualErr as Error).message);
          }
        })
      );
    }
    
    // Map quotes to standard UI QuoteResult
    const mapped = rawQuotes.map((q: any) => {
      const symbol = q.symbol.toUpperCase();
      const price = q.regularMarketPrice ? q.regularMarketPrice.toFixed(2) : "—";
      const changeVal = q.regularMarketChange ?? 0;
      const pctVal = q.regularMarketChangePercent ?? 0;
      const up = changeVal >= 0;

      const chg = q.regularMarketPrice ? ((up ? "+" : "") + changeVal.toFixed(2)) : "—";
      const pct = q.regularMarketPrice ? ((up ? "+" : "") + pctVal.toFixed(2) + "%") : "—";

      const vol = q.regularMarketVolume ? q.regularMarketVolume.toLocaleString() : "—";
      const pe = q.trailingPE ? q.trailingPE.toFixed(1) : (q.forwardPE ? q.forwardPE.toFixed(1) : "—");
      
      let mkt = "—";
      if (q.marketCap) {
        const val = q.marketCap / 1e9;
        if (val >= 1000) {
          mkt = (val / 1000).toFixed(2) + "T";
        } else {
          mkt = val.toFixed(1) + "B";
        }
      }

      const companyName = q.displayName || q.longName || q.shortName || symbol;

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
    });

    return NextResponse.json({ data: mapped });

  } catch (err) {
    console.error("[Yahoo Finance Search API] Search endpoint failed:", (err as Error).message);
    return NextResponse.json({ data: [], error: (err as Error).message }, { status: 500 });
  }
}
