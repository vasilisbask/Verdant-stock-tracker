import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "Finnhub token not configured" }, { status: 500 });
  }

  return NextResponse.json({ token });
}
