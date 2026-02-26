import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { shopSessions } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  // Check not already open
  const existing = await db
    .select()
    .from(shopSessions)
    .where(isNull(shopSessions.closedAt))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ ok: false, error: "ร้านเปิดอยู่แล้ว" }, { status: 400 });
  }

  if (!session.staffId) {
    return NextResponse.json({ ok: false, error: "ไม่พบ staff_id ของผู้ใช้" }, { status: 400 });
  }

  const created = await db
    .insert(shopSessions)
    .values({ openedBy: session.staffId })
    .returning();

  return NextResponse.json({ ok: true, session: created[0] });
}
