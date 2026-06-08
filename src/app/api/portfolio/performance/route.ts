import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ data: [] });
    }

    // 2. Identify unique symbols
    const uniqueSymbols = Array.from(new Set(transactions.map(t => t.stock.symbol)));

    // 3. Fetch historical quotes for the last 45 days for all symbols
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 45);

    const historyMap: Record<string, { dateStr: string; close: number }[]> = {};
    
    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
          const rawHistory = await yahooFinance.historical(
            symbol,
            {
              period1: startDate.toISOString().split("T")[0],
              period2: endDate.toISOString().split("T")[0],
              interval: "1d",
            },
            { validateResult: false }
          );

          historyMap[symbol] = rawHistory
            .filter((h: any) => h.close && h.date)
            .map((h: any) => ({
              dateStr: new Date(h.date).toISOString().split("T")[0],
              close: Number(h.close),
            }))
            .sort((a: any, b: any) => a.dateStr.localeCompare(b.dateStr));
        } catch (err) {
          console.warn(`[PORTFOLIO_PERFORMANCE] Failed history fetch for ${symbol}:`, (err as Error).message);
          historyMap[symbol] = [];
        }
      })
    );

    // 4. Generate daily calendar dates for the last 30 days
    const dates: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    // 5. Compute portfolio value for each of the last 30 days
    const performanceData = dates.map((dateStr) => {
      const dateEndLimit = new Date(dateStr + "T23:59:59.999Z");

      // Compute shares owned at the end of this day
      const sharesMap: Record<string, number> = {};
      for (const tx of transactions) {
        if (new Date(tx.transactionDate) <= dateEndLimit) {
          const qty = Number(tx.quantity);
          if (tx.type === "BUY") {
            sharesMap[tx.stock.symbol] = (sharesMap[tx.stock.symbol] || 0) + qty;
          } else {
            sharesMap[tx.stock.symbol] = (sharesMap[tx.stock.symbol] || 0) - qty;
          }
        }
      }

      // Compute total portfolio value
      let totalValue = 0;
      for (const [symbol, shares] of Object.entries(sharesMap)) {
        if (shares <= 0) continue;

        const quotes = historyMap[symbol] || [];
        // Find closing price on or before this day
        const quote = quotes
          .filter((q) => q.dateStr <= dateStr)
          .sort((a: any, b: any) => b.dateStr.localeCompare(a.dateStr))[0];

        if (quote) {
          totalValue += shares * quote.close;
        } else {
          // Fallback to the first available history quote, or first tx price
          const fallbackQuote =
            quotes[0]?.close ||
            Number(transactions.find((t) => t.stock.symbol === symbol)?.price) ||
            0;
          totalValue += shares * fallbackQuote;
        }
      }

      return {
        date: new Date(dateStr).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: Number(totalValue.toFixed(2)),
      };
    });

    return NextResponse.json({
      data: performanceData,
    });
  } catch (error) {
    console.error("[PORTFOLIO_PERFORMANCE_GET]", error);
    return NextResponse.json(
      { error: "Could not calculate portfolio performance" },
      { status: 500 }
    );
  }
}
