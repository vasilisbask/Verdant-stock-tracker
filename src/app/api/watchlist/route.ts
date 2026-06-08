import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchlist = await db.watchlist.findMany({
      where: { userId: session.user.id },
      include: { stock: true },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({
      data: watchlist.map(w => ({
        sym: w.stock.symbol,
        target: w.targetPrice ? String(w.targetPrice) : undefined
      }))
    });
  } catch (err) {
    console.error("[WATCHLIST_GET]", err);
    return NextResponse.json({ error: "Could not load watchlist" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { symbol, target } = await req.json();
    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // Verify stock exists in Yahoo Finance
    let companyName = cleanSymbol;
    try {
      const quote = await yahooFinance.quote(cleanSymbol, {}, { validateResult: false });
      if (!quote || !quote.regularMarketPrice) {
        return NextResponse.json({ error: "Ticker symbol does not exist" }, { status: 400 });
      }
      companyName = quote.longName || quote.shortName || quote.displayName || companyName;
    } catch (_err) {
      return NextResponse.json({ error: "Ticker symbol does not exist" }, { status: 400 });
    }

    // Find or create Stock
    const stock = await db.stock.upsert({
      where: { symbol: cleanSymbol },
      update: { companyName },
      create: {
        symbol: cleanSymbol,
        companyName,
        sector: "Other",
        currentPrice: "0.00"
      }
    });

    // Create or update Watchlist item
    const watchItem = await db.watchlist.upsert({
      where: {
        userId_stockId: {
          userId: session.user.id,
          stockId: stock.id
        }
      },
      update: {
        targetPrice: target ? String(target) : null
      },
      create: {
        userId: session.user.id,
        stockId: stock.id,
        targetPrice: target ? String(target) : null
      }
    });

    return NextResponse.json({
      data: {
        sym: stock.symbol,
        target: watchItem.targetPrice ? String(watchItem.targetPrice) : undefined
      }
    });
  } catch (err) {
    console.error("[WATCHLIST_POST]", err);
    return NextResponse.json({ error: "Could not add to watchlist" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const stock = await db.stock.findUnique({
      where: { symbol }
    });

    if (!stock) {
      return NextResponse.json({ success: true });
    }

    await db.watchlist.delete({
      where: {
        userId_stockId: {
          userId: session.user.id,
          stockId: stock.id
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[WATCHLIST_DELETE]", err);
    return NextResponse.json({ error: "Could not remove from watchlist" }, { status: 500 });
  }
}
