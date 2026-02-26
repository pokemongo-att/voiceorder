import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  text: z.string().default("")
});

// Regex-based parser for Thai beverage orders.
// Handles input with or without spaces, e.g. "ชาเย็น2แก้วกาแฟ3แก้ว"
// Pattern: (non-digit chars = name)(digits = qty)(optional แก้ว)
function parseThaiOrder(text: string) {
  const fillers = /(เอา|ขอ|หน่อย|ครับ|ค่ะ|นะ|ด้วย|กับ|และ)/g;
  const cleaned = (text || "")
    .replace(fillers, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return { items: [] };

  type Item = { menuName: string; qty: number };
  const items: Item[] = [];

  // Primary regex: (name)(qty)(optional แก้ว variants)
  const pattern = /(\D+?)(\d+)(?:แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?)?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleaned)) !== null) {
    // Capture any unmatched text before this match as a separate item with qty=1
    if (match.index > lastIndex) {
      const gap = cleaned.slice(lastIndex, match.index).replace(/แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?/g, "").trim();
      if (gap) items.push({ menuName: gap, qty: 1 });
    }

    const name = match[1].replace(/แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?/g, "").trim();
    const qty = Math.max(1, parseInt(match[2], 10));
    if (name) items.push({ menuName: name, qty });

    lastIndex = pattern.lastIndex;
  }

  // Remaining text after last match
  if (lastIndex < cleaned.length) {
    const remaining = cleaned.slice(lastIndex).replace(/แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?/g, "").trim();
    if (remaining) items.push({ menuName: remaining, qty: 1 });
  }

  // Fallback: if nothing parsed, return whole text as single item
  if (items.length === 0) {
    return { items: [{ menuName: cleaned, qty: 1 }] };
  }

  return { items };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { text } = BodySchema.parse(json);
    const data = parseThaiOrder(text);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
