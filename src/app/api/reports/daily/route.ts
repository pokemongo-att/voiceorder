import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders, orderItems } from "@/db/schema";
import { sql, and, gte, lt, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Support single date OR from/to range
  const dateStr = searchParams.get("date");
  const fromStr = searchParams.get("from") || dateStr || new Date().toISOString().slice(0, 10);
  const toStr = searchParams.get("to") || fromStr;
  const staffId = searchParams.get("staffId");
  const period = searchParams.get("period"); // "weekly" | "monthly" | null

  const rangeStart = new Date(fromStr + "T00:00:00.000+07:00");
  const rangeEnd = new Date(toStr + "T23:59:59.999+07:00");

  // Build where conditions
  const conditions: any[] = [gte(orders.createdAt, rangeStart), lt(orders.createdAt, rangeEnd)];
  if (staffId) conditions.push(eq(orders.staffId, staffId));
  const where = and(...conditions);

  // Aggregate orders
  const orderAgg = await db
    .select({
      totalSales: sql<string>`coalesce(sum(${orders.totalAmount}::numeric), 0)`,
      totalOrders: sql<number>`count(${orders.id})`,
      totalCups: sql<number>`coalesce(sum(${orders.totalQty}), 0)`
    })
    .from(orders)
    .where(where);

  // Top products
  const itemConditions: any[] = [gte(orders.createdAt, rangeStart), lt(orders.createdAt, rangeEnd)];
  if (staffId) itemConditions.push(eq(orders.staffId, staffId));

  const topProducts = await db
    .select({
      name: orderItems.productNameSnapshot,
      qty: sql<number>`sum(${orderItems.qty})`,
      revenue: sql<string>`sum(${orderItems.subtotal}::numeric)`
    })
    .from(orderItems)
    .innerJoin(orders, sql`${orderItems.orderId} = ${orders.id}`)
    .where(and(...itemConditions))
    .groupBy(orderItems.productNameSnapshot)
    .orderBy(sql`sum(${orderItems.qty}) desc`)
    .limit(10);

  const agg = orderAgg[0];

  // Period breakdown (weekly/monthly)
  let breakdown: { label: string; sales: number; orders: number; cups: number }[] = [];
  if (period === "weekly" || period === "monthly") {
    const truncFn = period === "weekly"
      ? sql`date_trunc('week', ${orders.createdAt})`
      : sql`date_trunc('month', ${orders.createdAt})`;

    const rows = await db
      .select({
        period: truncFn.as("period"),
        sales: sql<string>`coalesce(sum(${orders.totalAmount}::numeric), 0)`,
        cnt: sql<number>`count(${orders.id})`,
        cups: sql<number>`coalesce(sum(${orders.totalQty}), 0)`
      })
      .from(orders)
      .where(where)
      .groupBy(sql`period`)
      .orderBy(sql`period`);

    breakdown = rows.map((r: any) => ({
      label: new Date(r.period).toLocaleDateString("th-TH", period === "monthly" ? { year: "numeric", month: "long" } : { year: "numeric", month: "short", day: "numeric" }),
      sales: Number(r.sales),
      orders: Number(r.cnt),
      cups: Number(r.cups)
    }));
  }

  return NextResponse.json({
    ok: true,
    from: fromStr,
    to: toStr,
    totalSales: Number(agg?.totalSales || 0),
    totalOrders: Number(agg?.totalOrders || 0),
    totalCups: Number(agg?.totalCups || 0),
    topProducts: topProducts.map((p) => ({
      name: p.name,
      qty: Number(p.qty),
      revenue: Number(p.revenue || 0)
    })),
    breakdown
  });
}
