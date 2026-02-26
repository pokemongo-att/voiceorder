import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { staffs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const rows = await db.select().from(staffs).where(eq(staffs.isActive, true));
  return NextResponse.json({ ok: true, staffs: rows });
}

const CreateSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["admin", "staff"]).default("staff")
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const body = CreateSchema.parse(json);
    const created = await db.insert(staffs).values(body).returning();
    return NextResponse.json({ ok: true, staff: created[0] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
