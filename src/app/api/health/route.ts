import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Perform a raw database query to verify connection
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    
    return NextResponse.json(
      {
        status: "healthy",
        database: "connected",
        latency: `${latencyMs}ms`,
        uptime: `${Math.round(process.uptime())}s`,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error("Health probe failure:", error);
    
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: error?.message || "Database connection error",
        latency: `${latencyMs}ms`,
        uptime: `${Math.round(process.uptime())}s`,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}
