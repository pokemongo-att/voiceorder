import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { products, orders, orderItems, shopSessions, toppings } from "@/db/schema";
import { eq, isNull, desc, and, gte, lt, sql, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";

const DEFAULT_PRICE = Number(process.env.DEFAULT_PRICE || "20");

const BodySchema = z.object({
  rawText: z.string().default(""),
  staffId: z.string().optional(),
  items: z.array(z.object({
    menuName: z.string().min(1),
    qty: z.number().int().min(1).default(1),
    toppings: z.array(z.string()).default([]),
    sweetness: z.string().nullable().default(null)
  })).min(1)
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const staffId = searchParams.get("staffId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions: any[] = [];
  if (dateStr) {
    const dayStart = new Date(dateStr + "T00:00:00.000+07:00");
    const dayEnd = new Date(dateStr + "T23:59:59.999+07:00");
    conditions.push(gte(orders.createdAt, dayStart));
    conditions.push(lt(orders.createdAt, dayEnd));
  }
  if (staffId) {
    conditions.push(eq(orders.staffId, staffId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const totalResult = await db.select({ count: count() }).from(orders).where(where);
  const total = Number(totalResult[0]?.count ?? 0);

  // Fetch orders
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch items per order
  const ordersWithItems = [];
  for (const o of rows) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    ordersWithItems.push({ ...o, items });
  }

  return NextResponse.json({
    ok: true,
    orders: ordersWithItems,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check shop is open
    const openSessions = await db
      .select()
      .from(shopSessions)
      .where(isNull(shopSessions.closedAt))
      .limit(1);

    if (openSessions.length === 0) {
      return NextResponse.json({ ok: false, error: "ร้านยังไม่เปิด กรุณาให้ Admin เปิดร้านก่อน" }, { status: 400 });
    }

    const json = await req.json();
    const body = BodySchema.parse(json);

    const staffId = body.staffId || session.staffId || null;

    // Load all active toppings for price lookup
    const allToppings = await db.select().from(toppings).where(eq(toppings.isActive, true));
    const toppingPriceMap = new Map<string, number>();
    for (const t of allToppings) toppingPriceMap.set(t.name, Number(t.price));

    // Resolve prices and build items
    let totalAmount = 0;
    let totalQty = 0;
    const resolvedItems: {
      productId: string; productNameSnapshot: string; priceSnapshot: string;
      qty: number; subtotal: string;
      toppingsSnapshot: { name: string; price: number }[];
      sweetness: string | null;
      toppingTotal: string;
    }[] = [];

    for (const it of body.items) {
      const name = it.menuName.trim();

      // Lookup product
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.name, name))
        .limit(1);

      let product = existing[0];

      if (!product) {
        // Auto-create with default price
        const inserted = await db
          .insert(products)
          .values({ name, price: String(DEFAULT_PRICE), isActive: true })
          .returning();
        product = inserted[0];
      }

      if (!product) throw new Error("Failed to resolve product: " + name);

      const price = Number(product.price);

      // Resolve topping prices
      const toppingsSnapshot: { name: string; price: number }[] = [];
      let toppingTotal = 0;
      for (const tpName of it.toppings) {
        const tpPrice = toppingPriceMap.get(tpName) ?? 0;
        toppingsSnapshot.push({ name: tpName, price: tpPrice });
        toppingTotal += tpPrice;
      }

      const unitPrice = price + toppingTotal;
      const subtotal = unitPrice * it.qty;
      totalAmount += subtotal;
      totalQty += it.qty;

      resolvedItems.push({
        productId: product.id,
        productNameSnapshot: name,
        priceSnapshot: String(price),
        qty: it.qty,
        subtotal: String(subtotal),
        toppingsSnapshot,
        sweetness: it.sweetness,
        toppingTotal: String(toppingTotal)
      });
    }

    // Calculate order_no for current session
    const sessionOpenedAt = openSessions[0].openedAt;
    const orderCountResult = await db
      .select({ cnt: count() })
      .from(orders)
      .where(gte(orders.createdAt, sessionOpenedAt));
    const orderNo = Number(orderCountResult[0]?.cnt ?? 0) + 1;

    // Create order
    const created = await db.insert(orders).values({
      rawText: body.rawText,
      createdBy: session.username,
      staffId,
      totalAmount: String(totalAmount),
      totalQty,
      status: "open",
      orderNo
    }).returning({ id: orders.id, createdAt: orders.createdAt, orderNo: orders.orderNo });

    const orderId = created[0]?.id;
    const confirmedAt = created[0]?.createdAt;
    if (!orderId) throw new Error("Failed to create order");

    // Insert order items
    for (const item of resolvedItems) {
      await db.insert(orderItems).values({
        orderId,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        priceSnapshot: item.priceSnapshot,
        qty: item.qty,
        subtotal: item.subtotal,
        toppingsSnapshot: item.toppingsSnapshot,
        sweetness: item.sweetness,
        toppingTotal: item.toppingTotal
      });
    }

    return NextResponse.json({
      ok: true,
      orderId,
      orderNo: created[0]?.orderNo,
      confirmedAt,
      totalAmount,
      totalQty,
      items: resolvedItems.map((i) => ({
        name: i.productNameSnapshot,
        price: Number(i.priceSnapshot),
        qty: i.qty,
        subtotal: Number(i.subtotal),
        toppings: i.toppingsSnapshot,
        sweetness: i.sweetness,
        toppingTotal: Number(i.toppingTotal)
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
