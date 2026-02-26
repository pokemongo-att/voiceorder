import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  text: z.string().default("")
});

// MVP parser for Thai beverage orders (multi-items).
// Supports phrases like:
// - "ชานม 2 แก้ว โกโก้ 1 แก้ว"
// - "ชาไทย 2 โกโก้ 1"
// - "ชาไทย โกโก้"  -> qty defaults to 1 for each (assumes menu names are single tokens)
function parseThaiOrder(text: string) {
  const cleaned = (text || "")
    .replace(/(เอา|ขอ|หน่อย|ครับ|ค่ะ|นะ|ด้วย)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const unitWords = new Set(["แก้ว", "แก้วนึง", "แก้วหนึ่ง", "แก้วค่ะ", "แก้วครับ"]);
  const conjWords = new Set(["กับ", "และ", ",", "ๆ"]);

  const tokens = cleaned.split(" ").map((t) => t.trim()).filter(Boolean);

  type Item = { menuName: string; qty: number };
  const items: Item[] = [];

  let nameTokens: string[] = [];
  let sawQtyForCurrent = false;

  function finalize(defaultQty = 1) {
    const menuName = nameTokens.join(" ").trim();
    if (menuName) {
      items.push({ menuName, qty: defaultQty });
    }
    nameTokens = [];
    sawQtyForCurrent = false;
  }

  for (const tok of tokens) {
    if (!tok) continue;

    // Ignore unit words
    if (unitWords.has(tok)) continue;

    // Conjunction / separator -> finalize current if any
    if (conjWords.has(tok)) {
      if (nameTokens.length) finalize(1);
      continue;
    }

    // Number token
    if (/^\d+$/.test(tok)) {
      const qty = Math.max(1, parseInt(tok, 10));
      if (nameTokens.length) {
        items.push({ menuName: nameTokens.join(" ").trim(), qty });
        nameTokens = [];
        sawQtyForCurrent = true;
        continue;
      }
      // If a number comes without a name, ignore it
      continue;
    }

    // Heuristic: if we already have a single-token menuName without qty,
    // and we see another word token, treat it as a new menu (qty defaults to 1)
    // This makes "ชาไทย โกโก้" become 2 items.
    if (nameTokens.length === 1 && !sawQtyForCurrent) {
      // finalize previous token as an item with qty=1, start new
      finalize(1);
    }

    nameTokens.push(tok);
  }

  // finalize remaining
  if (nameTokens.length) finalize(1);

  // If nothing parsed but there is text, return single item fallback
  if (items.length === 0 && cleaned) {
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
