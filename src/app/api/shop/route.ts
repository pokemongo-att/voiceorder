import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { shopSessions } from "@/db/schema";
import { isNull, desc } from "drizzle-orm";

export async function GET() {
  // Check if shop is currently open
  const openSession = await db
    .select()
    .from(shopSessions)
    .where(isNull(shopSessions.closedAt))
    .limit(1);

  // Also get last closed session for reference
  const lastSession = await db
    .select()
    .from(shopSessions)
    .orderBy(desc(shopSessions.openedAt))
    .limit(1);

  return NextResponse.json({
    ok: true,
    isOpen: openSession.length > 0,
    currentSession: openSession[0] || null,
    lastSession: lastSession[0] || null
  });
}
