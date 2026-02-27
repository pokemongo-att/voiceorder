import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders, orderItems } from "@/db/schema";
import { and, gte, lt, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ ok: false, error: "date parameter required" }, { status: 400 });
  }

  const dayStart = new Date(dateStr + "T00:00:00.000+07:00");
  const dayEnd = new Date(dateStr + "T23:59:59.999+07:00");

  try {
    // Get order IDs for the date
    const ordersToDelete = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(gte(orders.createdAt, dayStart), lt(orders.createdAt, dayEnd)));

    const ids = ordersToDelete.map((o) => o.id);

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    // Delete order_items first (FK constraint)
    for (const id of ids) {
      await db.delete(orderItems).where(eq(orderItems.orderId, id));
    }

    // Delete orders
    let deleted = 0;
    for (const id of ids) {
      await db.delete(orders).where(eq(orders.id, id));
      deleted++;
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Delete failed" }, { status: 500 });
  }
}
