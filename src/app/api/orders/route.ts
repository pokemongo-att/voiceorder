import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { products, orders, orderItems, shopSessions } from "@/db/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

const DEFAULT_PRICE = Number(process.env.DEFAULT_PRICE || "20");

const BodySchema = z.object({
  rawText: z.string().default(""),
  staffId: z.string().optional(),
  items: z.array(z.object({
    menuName: z.string().min(1),
    qty: z.number().int().min(1).default(1)
  })).min(1)
});

export async function GET() {
  const rows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(50);
  return NextResponse.json({ ok: true, orders: rows });
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

    // Resolve prices and build items
    let totalAmount = 0;
    let totalQty = 0;
    const resolvedItems: { productId: string; productNameSnapshot: string; priceSnapshot: string; qty: number; subtotal: string }[] = [];

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
      const subtotal = price * it.qty;
      totalAmount += subtotal;
      totalQty += it.qty;

      resolvedItems.push({
        productId: product.id,
        productNameSnapshot: name,
        priceSnapshot: String(price),
        qty: it.qty,
        subtotal: String(subtotal)
      });
    }

    // Create order
    const created = await db.insert(orders).values({
      rawText: body.rawText,
      createdBy: session.username,
      staffId,
      totalAmount: String(totalAmount),
      totalQty,
      status: "open"
    }).returning({ id: orders.id, createdAt: orders.createdAt });

    const orderId = created[0]?.id;
    const confirmedAt = created[0]?.createdAt;
    if (!orderId) throw new Error("Failed to create order");

    // Insert order items
    for (const item of resolvedItems) {
      await db.insert(orderItems).values({
        orderId,
        ...item
      });
    }

    return NextResponse.json({
      ok: true,
      orderId,
      confirmedAt,
      totalAmount,
      totalQty,
      items: resolvedItems.map((i) => ({
        name: i.productNameSnapshot,
        price: Number(i.priceSnapshot),
        qty: i.qty,
        subtotal: Number(i.subtotal)
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
