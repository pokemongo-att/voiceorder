import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { staffs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "staff"]).optional(),
  isActive: z.boolean().optional()
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const json = await req.json();
    const body = UpdateSchema.parse(json);

    const values: Record<string, unknown> = {};
    if (body.name !== undefined) values.name = body.name;
    if (body.role !== undefined) values.role = body.role;
    if (body.isActive !== undefined) values.isActive = body.isActive;

    const updated = await db
      .update(staffs)
      .set(values)
      .where(eq(staffs.id, id))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, staff: updated[0] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
