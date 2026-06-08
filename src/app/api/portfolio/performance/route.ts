import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import YahooFinance from "yahoo-finance2";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch user transactions
    const transactions = await db.transaction.findMany({
      where: { userId },
      include: {
        stock: {
          select: {
            symbol: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        transactionDate: "asc",
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        data: {
          "1D": [],
          "1W": [],
          "1M": [],
          "1Y": []
        }
      });
    }

    // 2. Identify unique symbols
    const uniqueSymbols = Array.from(new Set(transactions.map(t => t.stock.symbol)));

    // 3. Define time range queries matching details route
    const endDate = new Date();
    const start1D = new Date(); start1D.setDate(endDate.getDate() - 4);
    const start1W = new Date(); start1W.setDate(endDate.getDate() - 8);
    const start1M = new Date(); start1M.setDate(endDate.getDate() - 32);
    const start1Y = new Date(); start1Y.setDate(endDate.getDate() - 365);

    interface QuotePoint {
      date: Date;
      close: number;
    }

    interface SymbolCharts {
      "1D": QuotePoint[];
      "1W": QuotePoint[];
      "1M": QuotePoint[];
      "1Y": QuotePoint[];
    }

    const chartsMap: Record<string, SymbolCharts> = {};

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

    // 4. Fetch different timeframe histories in parallel for all symbols
    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        chartsMap[symbol] = { "1D": [], "1W": [], "1M": [], "1Y": [] };
        try {
          const results = await Promise.allSettled([
            yahooFinance.chart(symbol, { period1: start1D.toISOString().split("T")[0], interval: "5m" }, { validateResult: false }),
            yahooFinance.chart(symbol, { period1: start1W.toISOString().split("T")[0], interval: "30m" }, { validateResult: false }),
            yahooFinance.chart(symbol, { period1: start1M.toISOString().split("T")[0], interval: "1h" }, { validateResult: false }),
            yahooFinance.chart(symbol, { period1: start1Y.toISOString().split("T")[0], interval: "1d" }, { validateResult: false })
          ]);

          const res1D: any = results[0].status === "fulfilled" ? results[0].value : null;
          const res1W: any = results[1].status === "fulfilled" ? results[1].value : null;
          const res1M: any = results[2].status === "fulfilled" ? results[2].value : null;
          const res1Y: any = results[3].status === "fulfilled" ? results[3].value : null;

          // 1D (5m, filtered to most recent trading day)
          if (res1D?.quotes) {
            const valid = res1D.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
            const regular = filterRegularSession(valid, res1D.meta);
            if (regular.length > 0) {
              const lastDateStr = new Date(regular[regular.length - 1].date).toISOString().split("T")[0];
              chartsMap[symbol]["1D"] = regular
                .filter((q: any) => new Date(q.date).toISOString().split("T")[0] === lastDateStr)
                .map((q: any) => ({ date: new Date(q.date), close: Number(q.close) }));
            }
          }

          // 1W (30m)
          if (res1W?.quotes) {
            const valid = res1W.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
            const regular = filterRegularSession(valid, res1W.meta);
            chartsMap[symbol]["1W"] = regular.map((q: any) => ({ date: new Date(q.date), close: Number(q.close) }));
          }

          // 1M (1h, filtered to 2h)
          if (res1M?.quotes) {
            const valid = res1M.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
            const regular = filterRegularSession(valid, res1M.meta);
            chartsMap[symbol]["1M"] = regular
              .filter((_: any, idx: number) => idx % 2 === 0)
              .map((q: any) => ({ date: new Date(q.date), close: Number(q.close) }));
          }

          // 1Y (1d)
          if (res1Y?.quotes) {
            const valid = res1Y.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
            chartsMap[symbol]["1Y"] = valid.map((q: any) => ({ date: new Date(q.date), close: Number(q.close) }));
          }

          // Fallback 1Y
          if (chartsMap[symbol]["1Y"].length === 0) {
            try {
              const startFallback = new Date();
              startFallback.setDate(endDate.getDate() - 365);
              const fallbackRes = await yahooFinance.historical(symbol, {
                period1: startFallback.toISOString().split("T")[0],
                period2: endDate.toISOString().split("T")[0],
                interval: "1d"
              }, { validateResult: false });
              chartsMap[symbol]["1Y"] = fallbackRes
                .filter((h: any) => h.close && h.date)
                .map((h: any) => ({ date: new Date(h.date), close: Number(h.close) }));
            } catch (fallbackErr) {
              console.warn(`[PORTFOLIO_PERFORMANCE] Fallback historical query failed for ${symbol}:`, (fallbackErr as Error).message);
            }
          }

        } catch (err) {
          console.warn(`[PORTFOLIO_PERFORMANCE] Parallel fetches failed for ${symbol}:`, (err as Error).message);
        }
      })
    );

    // 5. Generate portfolio curves per timeframe
    const history: Record<string, { date: string; value: number }[]> = {
      "1D": [],
      "1W": [],
      "1M": [],
      "1Y": []
    };

    const timeframes = ["1D", "1W", "1M", "1Y"] as const;

    for (const tf of timeframes) {
      const timestampSet = new Set<number>();
      for (const symbol of uniqueSymbols) {
        const quotes = chartsMap[symbol]?.[tf] || [];
        for (const q of quotes) {
          timestampSet.add(q.date.getTime());
        }
      }

      if (timestampSet.size === 0) continue;

      const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

      history[tf] = sortedTimestamps.map((ms) => {
        const currentDateObj = new Date(ms);

        // Sum up shares owned of all stocks at this point in time
        const sharesMap: Record<string, number> = {};
        for (const tx of transactions) {
          if (new Date(tx.transactionDate) <= currentDateObj) {
            const qty = Number(tx.quantity);
            if (tx.type === "BUY") {
              sharesMap[tx.stock.symbol] = (sharesMap[tx.stock.symbol] || 0) + qty;
            } else {
              sharesMap[tx.stock.symbol] = (sharesMap[tx.stock.symbol] || 0) - qty;
            }
          }
        }

        // Sum up total valuation
        let totalValue = 0;
        for (const [symbol, shares] of Object.entries(sharesMap)) {
          if (shares <= 0) continue;

          const quotes = chartsMap[symbol]?.[tf] || [];
          
          let bestQuote = quotes.find(q => q.date.getTime() === ms);
          if (!bestQuote) {
            const quotesBefore = quotes.filter(q => q.date.getTime() < ms);
            if (quotesBefore.length > 0) {
              bestQuote = quotesBefore[quotesBefore.length - 1];
            }
          }

          if (bestQuote) {
            totalValue += shares * bestQuote.close;
          } else {
            const fallbackClose = quotes[0]?.close || 
              Number(transactions.find(t => t.stock.symbol === symbol)?.price) || 
              0;
            totalValue += shares * fallbackClose;
          }
        }

        const monthStr = currentDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const timeStr = currentDateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

        return {
          date: `${monthStr} ${timeStr}`,
          value: Number(totalValue.toFixed(2))
        };
      });
    }

    return NextResponse.json({
      data: history,
    });
  } catch (error) {
    console.error("[PORTFOLIO_PERFORMANCE_GET]", error);
    return NextResponse.json(
      { error: "Could not calculate portfolio performance" },
      { status: 500 }
    );
  }
}
