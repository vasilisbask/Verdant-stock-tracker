import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ["yahooSurvey"]
});

import { TransactionType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const transactionSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(12, "Symbol is too long")
    .regex(/^[A-Z0-9.-]+$/i, "Symbol contains invalid characters"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  price: z.coerce.number().positive("Price must be greater than zero"),
  companyName: z.string().trim().max(120).optional(),
  type: z.enum(["BUY", "SELL"]).optional().default("BUY"),
});

function toPortfolioTransaction(tx: {
  id: string;
  quantity: unknown;
  price: unknown;
  type: TransactionType;
  transactionDate: Date;
  stock: {
    symbol: string;
    companyName: string;
  };
}) {
  return {
    id: tx.id,
    sym: tx.stock.symbol,
    companyName: tx.stock.companyName,
    quantity: String(tx.quantity),
    price: String(tx.price),
    type: tx.type,
    transactionDate: tx.transactionDate.toISOString(),
  };
}

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
    const transactions = await db.transaction.findMany({
      where: {
        userId,
      },
      include: {
        stock: {
          select: {
            symbol: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return NextResponse.json({
      data: transactions.map(toPortfolioTransaction),
    });
  } catch (error) {
    console.error("[PORTFOLIO_GET]", error);
    return NextResponse.json(
      { error: "Could not load portfolio" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const symbol = parsed.data.symbol.toUpperCase();
    let companyName = parsed.data.companyName?.trim() || symbol;

    // Validate that the stock symbol exists in Yahoo Finance
    try {
      const quote = await yahooFinance.quote(symbol, {}, { validateResult: false });
      if (!quote || !quote.regularMarketPrice) {
        return NextResponse.json(
          { error: `Ticker symbol '${symbol}' does not exist or is delisted.` },
          { status: 400 }
        );
      }
      if (!parsed.data.companyName) {
        companyName = quote.longName || quote.shortName || quote.displayName || companyName;
      }
    } catch (err) {
      console.warn(`[PORTFOLIO_POST] Failed to validate symbol ${symbol}:`, (err as Error).message);
      return NextResponse.json(
        { error: `Ticker symbol '${symbol}' does not exist or is delisted.` },
        { status: 400 }
      );
    }

    const quantity = parsed.data.quantity.toString();
    const price = parsed.data.price.toString();
    const type = parsed.data.type || TransactionType.BUY;
    
    // For sells, verify user has enough shares first
    if (type === "SELL") {
      const allTx = await db.transaction.findMany({
        where: { userId, stock: { symbol } }
      });
      const netShares = allTx.reduce((acc, current) => {
        const qty = Number(current.quantity);
        return current.type === "BUY" ? acc + qty : acc - qty;
      }, 0);
      
      if (netShares < parsed.data.quantity) {
        return NextResponse.json(
          { error: `Insufficient shares to sell. You currently own ${netShares} shares.` },
          { status: 400 }
        );
      }
    }

    const transaction = await db.$transaction(async (tx) => {
      const stock = await tx.stock.upsert({
        where: {
          symbol,
        },
        update: {
          companyName,
          currentPrice: price,
        },
        create: {
          symbol,
          companyName,
          sector: "Other",
          currentPrice: price,
        },
      });

      return tx.transaction.create({
        data: {
          userId,
          stockId: stock.id,
          type,
          quantity,
          price,
        },
        include: {
          stock: {
            select: {
              symbol: true,
              companyName: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        data: toPortfolioTransaction(transaction),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PORTFOLIO_POST]", error);
    return NextResponse.json(
      { error: "Could not save portfolio transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get("transactionId");
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();

  if (!transactionId && !symbol) {
    return NextResponse.json(
      { error: "transactionId or symbol is required" },
      { status: 400 }
    );
  }

  try {
    if (transactionId) {
      const result = await db.transaction.deleteMany({
        where: {
          id: transactionId,
          userId,
        },
      });

      return NextResponse.json({ deleted: result.count });
    }

    const stock = await db.stock.findUnique({
      where: {
        symbol: symbol!,
      },
      select: {
        id: true,
      },
    });

    if (!stock) {
      return NextResponse.json({ deleted: 0 });
    }

    const result = await db.transaction.deleteMany({
      where: {
        userId,
        stockId: stock.id,
      },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[PORTFOLIO_DELETE]", error);
    return NextResponse.json(
      { error: "Could not remove portfolio transaction" },
      { status: 500 }
    );
  }
}
