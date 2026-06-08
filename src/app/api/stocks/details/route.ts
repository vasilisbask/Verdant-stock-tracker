import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { mapYahooSector } from "@/lib/stocks";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol parameter" }, { status: 400 });
  }

  symbol = symbol.trim().toUpperCase().replace(/\./g, "-");

  try {
    // Fetch Fundamentals & Profile Summary Detail
    let profile: any = null;
    try {
      profile = await yahooFinance.quoteSummary(symbol, {
        modules: ["summaryDetail", "assetProfile", "price"]
      }, { validateResult: false });
    } catch (summaryErr) {
      console.warn(`[Yahoo Finance Details] quoteSummary failed for ${symbol}:`, (summaryErr as Error).message);
    }

    // Fetch different timeframe histories in parallel:
    // 1D (5m, last 4 days), 1W (30m, last 8 days), 1M (1h, last 32 days), 1Y (1d, last 365 days)
    const endDate = new Date();
    
    const start1D = new Date();
    start1D.setDate(endDate.getDate() - 4);

    const start1W = new Date();
    start1W.setDate(endDate.getDate() - 8);

    const start1M = new Date();
    start1M.setDate(endDate.getDate() - 32);

    const start1Y = new Date();
    start1Y.setDate(endDate.getDate() - 365);

    let res1D: any = { quotes: [] };
    let res1W: any = { quotes: [] };
    let res1M: any = { quotes: [] };
    let res1Y: any = { quotes: [] };

    try {
      const results = await Promise.allSettled([
        yahooFinance.chart(symbol, { period1: start1D.toISOString().split("T")[0], interval: "5m" }, { validateResult: false }),
        yahooFinance.chart(symbol, { period1: start1W.toISOString().split("T")[0], interval: "30m" }, { validateResult: false }),
        yahooFinance.chart(symbol, { period1: start1M.toISOString().split("T")[0], interval: "1h" }, { validateResult: false }),
        yahooFinance.chart(symbol, { period1: start1Y.toISOString().split("T")[0], interval: "1d" }, { validateResult: false })
      ]);

      if (results[0].status === "fulfilled") res1D = results[0].value;
      if (results[1].status === "fulfilled") res1W = results[1].value;
      if (results[2].status === "fulfilled") res1M = results[2].value;
      if (results[3].status === "fulfilled") res1Y = results[3].value;
    } catch (parallelErr) {
      console.warn(`[Yahoo Finance Details] Parallel chart queries failed for ${symbol}:`, (parallelErr as Error).message);
    }

    // Compile business description, sector, industry, website
    const assetProfile = profile?.assetProfile || {};
    const summaryDetail = profile?.summaryDetail || {};
    const priceInfo = profile?.price || {};

    const summary = {
      description: assetProfile.longBusinessSummary || "No business description available for this asset.",
      sector: mapYahooSector(assetProfile.sector),
      industry: assetProfile.industry || "N/A",
      website: assetProfile.website || "",
      name: priceInfo.longName || priceInfo.shortName || priceInfo.displayName || symbol
    };

    // Compile statistics
    const divPercent = summaryDetail.dividendYield 
      ? (summaryDetail.dividendYield * 100).toFixed(2) + "%" 
      : (summaryDetail.yield ? (summaryDetail.yield * 100).toFixed(2) + "%" : "—");

    let mkt = "—";
    if (summaryDetail.marketCap) {
      const val = summaryDetail.marketCap / 1e9;
      if (val >= 1000) {
        mkt = (val / 1000).toFixed(2) + "T";
      } else {
        mkt = val.toFixed(1) + "B";
      }
    }

    const stats = {
      dividendYield: divPercent,
      marketCap: mkt,
      volume: summaryDetail.volume ? summaryDetail.volume.toLocaleString() : (priceInfo.regularMarketVolume ? priceInfo.regularMarketVolume.toLocaleString() : "—"),
      trailingPE: summaryDetail.trailingPE ? summaryDetail.trailingPE.toFixed(1) : (summaryDetail.forwardPE ? summaryDetail.forwardPE.toFixed(1) : "—"),
      dayLow: summaryDetail.dayLow ? `$${summaryDetail.dayLow.toFixed(2)}` : "—",
      dayHigh: summaryDetail.dayHigh ? `$${summaryDetail.dayHigh.toFixed(2)}` : "—",
      open: summaryDetail.open ? `$${summaryDetail.open.toFixed(2)}` : "—",
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh ? `$${summaryDetail.fiftyTwoWeekHigh.toFixed(2)}` : "—",
      fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow ? `$${summaryDetail.fiftyTwoWeekLow.toFixed(2)}` : "—",
    };

    // Formulate chart historical close arrays for all requested timeframes
    const history: Record<string, Array<{ date: string; close: number }>> = {
      "1D": [],
      "1W": [],
      "1M": [],
      "1Y": []
    };

    // Helper to filter quotes by regular trading session periods
    const filterRegularSession = (quotes: any[], meta: any) => {
      const regularPeriods = meta?.tradingPeriods?.regular;
      if (!regularPeriods) return quotes;
      const periods = regularPeriods.flat().map((p: any) => ({
        start: new Date(p.start),
        end: new Date(p.end)
      }));
      const regularQuotes = quotes.filter((q: any) => {
        const qDate = new Date(q.date);
        return periods.some((p: { start: Date; end: Date }) => qDate >= p.start && qDate <= p.end);
      });
      return regularQuotes.length > 0 ? regularQuotes : quotes;
    };

    // 1. Process 1D (5m, filtered to most recent day)
    if (res1D?.quotes && res1D.quotes.length > 0) {
      const validQuotes = res1D.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
      const regularQuotes = filterRegularSession(validQuotes, res1D.meta);
      if (regularQuotes.length > 0) {
        const lastQuote = regularQuotes[regularQuotes.length - 1];
        const lastDateStr = new Date(lastQuote.date).toISOString().split("T")[0];
        history["1D"] = regularQuotes
          .filter((q: any) => new Date(q.date).toISOString().split("T")[0] === lastDateStr)
          .map((q: any) => {
            const dateObj = new Date(q.date);
            const monthStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            return {
              date: `${monthStr} ${timeStr}`,
              close: Number(q.close.toFixed(2))
            };
          });
      }
    }

    // 2. Process 1W (30m)
    if (res1W?.quotes) {
      const validQuotes = res1W.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
      const regularQuotes = filterRegularSession(validQuotes, res1W.meta);
      history["1W"] = regularQuotes.map((q: any) => {
        const dateObj = new Date(q.date);
        const monthStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        return {
          date: `${monthStr} ${timeStr}`,
          close: Number(q.close.toFixed(2))
        };
      });
    }

    // 3. Process 1M (1h, filtered to 2h)
    if (res1M?.quotes) {
      const validQuotes = res1M.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
      const regularQuotes = filterRegularSession(validQuotes, res1M.meta);
      history["1M"] = regularQuotes
        .filter((_: any, idx: number) => idx % 2 === 0)
        .map((q: any) => {
          const dateObj = new Date(q.date);
          const monthStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          return {
            date: `${monthStr} ${timeStr}`,
            close: Number(q.close.toFixed(2))
          };
        });
    }

    // 4. Process 1Y (1d)
    if (res1Y?.quotes) {
      history["1Y"] = res1Y.quotes
        .filter((q: any) => q.close !== null && q.close !== undefined)
        .map((q: any) => {
          const dateObj = new Date(q.date);
          const monthStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          return {
            date: `${monthStr} ${timeStr}`,
            close: Number(q.close.toFixed(2))
          };
        });
    }

    // Fallback: If 1Y is empty, check if we can query historical as fallback
    if (history["1Y"].length === 0) {
      try {
        const startFallback = new Date();
        startFallback.setDate(endDate.getDate() - 365);
        const fallbackRes = await yahooFinance.historical(symbol, {
          period1: startFallback.toISOString().split("T")[0],
          period2: endDate.toISOString().split("T")[0],
          interval: "1d"
        }, { validateResult: false });
        history["1Y"] = fallbackRes
          .filter((h: any) => h.close && h.date)
          .map((h: any) => {
            const dateObj = new Date(h.date);
            const monthStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            return {
              date: `${monthStr} ${timeStr}`,
              close: Number(h.close.toFixed(2))
            };
          });
      } catch (fallbackErr) {
        console.warn("[Yahoo Finance Fallback] Fallback historical query failed:", (fallbackErr as Error).message);
      }
    }

    // Fetch real-time news stories
    let news: any[] = [];
    try {
      const searchRes = (await yahooFinance.search(symbol, {}, { validateResult: false })) as any;
      if (searchRes && Array.isArray(searchRes.news)) {
        news = searchRes.news
          .map((item: any) => ({
            uuid: item.uuid,
            title: item.title,
            publisher: item.publisher,
            link: item.link,
            time: item.providerPublishTime,
            thumbnail: item.thumbnail?.resolutions?.[1]?.url || item.thumbnail?.resolutions?.[0]?.url || null
          }))
          .slice(0, 5);
      }
    } catch (newsErr) {
      console.warn(`[Yahoo Finance Details API] Failed to fetch news for ${symbol}:`, (newsErr as Error).message);
    }

    const daily = {
      price: priceInfo.regularMarketPrice ?? null,
      change: priceInfo.regularMarketChange ?? null,
      changePercent: typeof priceInfo.regularMarketChangePercent === "number"
        ? priceInfo.regularMarketChangePercent * 100
        : null
    };

    return NextResponse.json({
      success: true,
      symbol,
      summary,
      stats,
      history,
      news,
      daily
    });

  } catch (err) {
    console.error(`[Yahoo Finance Details API] Error loading details for ${symbol}:`, (err as Error).message);
    return NextResponse.json({
      success: false,
      error: `Could not retrieve details for ${symbol}.`
    }, { status: 500 });
  }
}
