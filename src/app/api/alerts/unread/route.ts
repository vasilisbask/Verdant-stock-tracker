import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, read: false }
    });

    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    return NextResponse.json({
      unreadCount,
      notifications
    });
  } catch (err) {
    console.error("[ALERTS_UNREAD_GET]", err);
    return NextResponse.json({ error: "Could not fetch unread alerts" }, { status: 500 });
  }
}
