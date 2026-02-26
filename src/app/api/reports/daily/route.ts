import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders, orderItems } from "@/db/schema";
import { sql, and, gte, lt } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  // Parse date range
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");

  // Aggregate orders
  const orderAgg = await db
    .select({
      totalSales: sql<string>`coalesce(sum(${orders.totalAmount}::numeric), 0)`,
      totalOrders: sql<number>`count(${orders.id})`,
      totalCups: sql<number>`coalesce(sum(${orders.totalQty}), 0)`
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, dayStart),
        lt(orders.createdAt, dayEnd)
      )
    );

  // Top products
  const topProducts = await db
    .select({
      name: orderItems.productNameSnapshot,
      qty: sql<number>`sum(${orderItems.qty})`,
      revenue: sql<string>`sum(${orderItems.subtotal}::numeric)`
    })
    .from(orderItems)
    .innerJoin(orders, sql`${orderItems.orderId} = ${orders.id}`)
    .where(
      and(
        gte(orders.createdAt, dayStart),
        lt(orders.createdAt, dayEnd)
      )
    )
    .groupBy(orderItems.productNameSnapshot)
    .orderBy(sql`sum(${orderItems.qty}) desc`)
    .limit(10);

  const agg = orderAgg[0];

  return NextResponse.json({
    ok: true,
    date: dateStr,
    totalSales: Number(agg?.totalSales || 0),
    totalOrders: Number(agg?.totalOrders || 0),
    totalCups: Number(agg?.totalCups || 0),
    topProducts: topProducts.map((p) => ({
      name: p.name,
      qty: Number(p.qty),
      revenue: Number(p.revenue || 0)
    }))
  });
}
