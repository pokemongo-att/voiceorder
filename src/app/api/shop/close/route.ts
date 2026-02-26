import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { shopSessions, orders } from "@/db/schema";
import { eq, isNull, and, gte, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  // Find open session
  const openSessions = await db
    .select()
    .from(shopSessions)
    .where(isNull(shopSessions.closedAt))
    .limit(1);

  if (openSessions.length === 0) {
    return NextResponse.json({ ok: false, error: "ร้านยังไม่ได้เปิด" }, { status: 400 });
  }

  const openSession = openSessions[0];

  if (!session.staffId) {
    return NextResponse.json({ ok: false, error: "ไม่พบ staff_id ของผู้ใช้" }, { status: 400 });
  }

  // Calculate total sales since shop opened
  const salesAgg = await db
    .select({
      total: sql<string>`coalesce(sum(${orders.totalAmount}::numeric), 0)`
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "open"),
        gte(orders.createdAt, openSession.openedAt)
      )
    );

  const totalSales = Number(salesAgg[0]?.total || 0);

  // Close all open orders
  await db
    .update(orders)
    .set({ status: "closed" })
    .where(
      and(
        eq(orders.status, "open"),
        gte(orders.createdAt, openSession.openedAt)
      )
    );

  // Close shop session
  const closed = await db
    .update(shopSessions)
    .set({
      closedAt: new Date(),
      closedBy: session.staffId,
      totalSalesSnapshot: String(totalSales)
    })
    .where(eq(shopSessions.id, openSession.id))
    .returning();

  return NextResponse.json({
    ok: true,
    session: closed[0],
    totalSales
  });
}
