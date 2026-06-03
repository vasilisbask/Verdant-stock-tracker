import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const alertSchema = z.object({
  symbol: z.string().trim().toUpperCase().min(1).max(12),
  targetPrice: z.coerce.number().positive(),
  direction: z.enum(["ABOVE", "BELOW"]),
  channel: z.string().optional().default("in_app")
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = alertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
    }

    const { symbol, targetPrice, direction, channel } = parsed.data;

    // Find or create Stock
    let stock = await db.stock.findUnique({ where: { symbol } });
    if (!stock) {
      stock = await db.stock.create({
        data: {
          symbol,
          companyName: symbol,
          sector: "Other",
          currentPrice: targetPrice.toString()
        }
      });
    }

    const alert = await db.alert.create({
      data: {
        userId: session.user.id,
        stockId: stock.id,
        targetPrice,
        direction,
        channel
      },
      include: {
        stock: true
      }
    });

    return NextResponse.json({ data: alert }, { status: 201 });
  } catch (err) {
    console.error("[ALERTS_POST]", err);
    return NextResponse.json({ error: "Could not create alert" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alerts = await db.alert.findMany({
      where: { userId: session.user.id },
      include: { stock: true },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ data: alerts });
  } catch (err) {
    console.error("[ALERTS_GET]", err);
    return NextResponse.json({ error: "Could not load alerts" }, { status: 500 });
  }
}
