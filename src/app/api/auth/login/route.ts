import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession } from "@/lib/auth";

const BodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { username, password } = BodySchema.parse(json);

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const user = rows[0];
    if (!user || !user.isActive) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    await createSession({
      userId: user.id,
      username: user.username,
      role: user.role as "admin" | "staff",
      staffId: user.staffId
    });

    return NextResponse.json({ ok: true, role: user.role });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
