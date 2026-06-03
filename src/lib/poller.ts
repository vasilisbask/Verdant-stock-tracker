import { db } from "./db";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

export async function checkAlerts() {
  try {
    const activeAlerts = await db.alert.findMany({
      where: { triggered: false },
      include: { stock: true }
    });

    if (activeAlerts.length === 0) return;

    // Group by symbol to batch fetch quotes
    const symbols = Array.from(new Set(activeAlerts.map((a: any) => a.stock.symbol))) as string[];
    
    // Fetch prices
    const pricesMap: Record<string, number> = {};
    try {
      const quotes = await yahooFinance.quote(symbols, {}, { validateResult: false });
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes];
      quotesArray.forEach(q => {
        if (q && q.symbol && typeof q.regularMarketPrice === "number") {
          pricesMap[q.symbol.toUpperCase()] = q.regularMarketPrice;
        }
      });
    } catch (err) {
      console.error("[Poller] Failed to fetch quotes from Yahoo Finance:", (err as Error).message);
      return;
    }

    // Check alerts
    for (const alert of activeAlerts) {
      const currentPrice = pricesMap[alert.stock.symbol.toUpperCase()];
      if (currentPrice === undefined) continue;

      const target = Number(alert.targetPrice);
      let triggered = false;

      if (alert.direction === "ABOVE" && currentPrice >= target) {
        triggered = true;
      } else if (alert.direction === "BELOW" && currentPrice <= target) {
        triggered = true;
      }

      if (triggered) {
        // Trigger alert inside database transaction
        await db.$transaction([
          db.alert.update({
            where: { id: alert.id },
            data: {
              triggered: true,
              triggeredAt: new Date()
            }
          }),
          db.notification.create({
            data: {
              userId: alert.userId,
              title: `${alert.stock.symbol} Target Reached`,
              message: `${alert.stock.symbol} has crossed your target price of $${target.toFixed(2)} (Current: $${currentPrice.toFixed(2)}).`
            }
          })
        ]);
        console.log(`[Poller] Alert triggered for user ${alert.userId}: ${alert.stock.symbol} at ${currentPrice} (target was ${alert.direction} ${target})`);
      }
    }
  } catch (err) {
    console.error("[Poller] Error running checkAlerts:", err);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startPricePoller() {
  const globalAny = globalThis as any;
  // Avoid double instantiation in next dev
  if (globalAny.pricePollerStarted) {
    console.log("[Poller] Price poller already running.");
    return;
  }

  globalAny.pricePollerStarted = true;
  console.log("[Poller] Starting price poller (30-second interval)...");

  // Run immediately on startup
  checkAlerts();

  // Schedule subsequent checks
  intervalId = setInterval(checkAlerts, 30000);
}

export function stopPricePoller() {
  const globalAny = globalThis as any;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    globalAny.pricePollerStarted = false;
    console.log("[Poller] Stopped price poller.");
  }
}
