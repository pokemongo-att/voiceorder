import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { menus, orders, orderItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge"; // works well with Neon HTTP

const BodySchema = z.object({
  rawText: z.string().default(""),
  createdBy: z.string().default("staff"),
  items: z.array(z.object({
    menuName: z.string().min(1),
    qty: z.number().int().min(1).default(1)
  })).min(1)
});

function staffAuth(req: Request): boolean {
  // Optional lightweight auth for staff devices
  // If STAFF_API_KEY is not set, allow all (demo)
  const key = process.env.STAFF_API_KEY?.trim();
  if (!key || key === "change-me") return true;
  const provided = (req.headers.get("x-staff-key") || "").trim();
  return provided === key;
}

export async function POST(req: Request) {
  try {
    if (!staffAuth(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const body = BodySchema.parse(json);

    // Create order
    const created = await db.insert(orders).values({
      rawText: body.rawText,
      createdBy: body.createdBy
    }).returning({ id: orders.id, createdAt: orders.createdAt });

    const orderId = created[0]?.id;
    const confirmedAt = created[0]?.createdAt;
    if (!orderId) throw new Error("Failed to create order");

    for (const it of body.items) {
      const menuName = it.menuName.trim();

      // Upsert menu by name (simple)
      const existing = await db.select({ id: menus.id, name: menus.name }).from(menus).where(eq(menus.name, menuName)).limit(1);
      let menuId = existing[0]?.id;

      if (!menuId) {
        const inserted = await db.insert(menus).values({ name: menuName, isActive: true }).returning({ id: menus.id });
        menuId = inserted[0]?.id;
      }

      if (!menuId) throw new Error("Failed to resolve menu");

      await db.insert(orderItems).values({
        orderId,
        menuId,
        menuName,
        qty: it.qty
      });
    }

    return NextResponse.json({ ok: true, orderId, confirmedAt });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
