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

    // Fetch 45 days of daily historical closing prices (to ensure we have at least 30 trading days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 45);

    let rawHistory: any[] = [];
    try {
      rawHistory = await yahooFinance.historical(symbol, {
        period1: startDate.toISOString().split("T")[0],
        period2: endDate.toISOString().split("T")[0],
        interval: "1d"
      }, { validateResult: false });
    } catch (historyErr) {
      console.warn(`[Yahoo Finance Details] historical failed for ${symbol}:`, (historyErr as Error).message);
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

    // Formulate chart historical close arrays
    // Sort chronologically and slice the final 30 trading days
    const history = rawHistory
      .filter((h: any) => h.close && h.date)
      .map((h: any) => ({
        date: new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        close: Number(h.close.toFixed(2))
      }))
      .slice(-30);

    return NextResponse.json({
      success: true,
      symbol,
      summary,
      stats,
      history
    });

  } catch (err) {
    console.error(`[Yahoo Finance Details API] Error loading details for ${symbol}:`, (err as Error).message);
    return NextResponse.json({
      success: false,
      error: `Could not retrieve details for ${symbol}.`
    }, { status: 500 });
  }
}
