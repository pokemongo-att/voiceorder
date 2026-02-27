import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { toppings, products } from "@/db/schema";
import { eq } from "drizzle-orm";

const BodySchema = z.object({
  text: z.string().default("")
});

type ParsedItem = {
  menuName: string;
  qty: number;
  toppings: string[];
  sweetness: string | null;
};

// Sweetness patterns — detected and stripped BEFORE qty regex, no price impact
const SWEETNESS_PATTERNS: [RegExp, string][] = [
  [/ไม่(?:ใส่)?(?:น้ำตาล|หวาน)/g, "ไม่หวาน"],
  [/หวานน้อย/g, "หวานน้อย"],
  [/หวานปกติ/g, "หวานปกติ"],
  [/เพิ่มหวาน/g, "เพิ่มหวาน"],
  // "หวาน50" / "หวาน 25%" — any number after หวาน
  [/หวาน\s*(\d+)\s*(?:เปอร์เซ็นต์|%)?/g, "__SWEET_NUM__"],
];

// Topping keyword prefixes (synonyms for "add topping")
const TOPPING_KEYWORDS = /(?:เพิ่ม|บวก|top|ท็อป|ใส่|พร้อม)\s*(?:topping|ท็อปปิ้ง)?\s*/gi;

function parseThaiOrder(
  text: string,
  toppingNames: string[],
  productNames: string[]
): { items: ParsedItem[] } {
  const fillers = /(เอา|ขอ|หน่อย|ครับ|ค่ะ|นะ|ด้วย|กับ|และ)/g;
  let cleaned = (text || "")
    .replace(fillers, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return { items: [] };

  // ── Step 0: Extract sweetness BEFORE splitting by numbers ──
  // This prevents "หวาน50" from being interpreted as qty=50
  let globalSweetness: string | null = null;
  for (const [pat, label] of SWEETNESS_PATTERNS) {
    const re = new RegExp(pat.source, pat.flags);
    const m = re.exec(cleaned);
    if (m) {
      if (label === "__SWEET_NUM__") {
        const num = parseInt(m[1], 10);
        // Numbers > 10 are always sweetness %, not quantity
        // Numbers <= 10 after หวาน are also sweetness if preceded by หวาน
        globalSweetness = `หวาน${num}%`;
      } else {
        globalSweetness = label;
      }
      cleaned = cleaned.replace(re, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  // Sort product names longest first for greedy matching
  const sortedProducts = [...productNames].sort((a, b) => b.length - a.length);
  // Sort topping names longest first for greedy matching
  const sortedToppings = [...toppingNames].sort((a, b) => b.length - a.length);

  // ── Step 1: Split into raw chunks by regex: (non-digit text)(digits)(optional แก้ว) ──
  type RawChunk = { raw: string; qty: number };
  const chunks: RawChunk[] = [];

  const pattern = /(\D+?)(\d+)(?:แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?)?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      const gap = cleaned.slice(lastIndex, match.index).replace(/แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?/g, "").trim();
      if (gap) chunks.push({ raw: gap, qty: 1 });
    }
    const raw = match[1].replace(/แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?/g, "").trim();
    const qty = Math.max(1, parseInt(match[2], 10));
    if (raw) chunks.push({ raw, qty });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    const remaining = cleaned.slice(lastIndex).replace(/แก้ว(?:นึง|หนึ่ง|ค่ะ|ครับ)?/g, "").trim();
    if (remaining) chunks.push({ raw: remaining, qty: 1 });
  }

  if (chunks.length === 0 && cleaned) {
    chunks.push({ raw: cleaned, qty: 1 });
  }

  // ── Step 2: Process each chunk — extract toppings, match product ──
  const items: ParsedItem[] = [];

  for (const chunk of chunks) {
    let t = chunk.raw.trim();

    // Per-chunk sweetness override (if not already found globally)
    let sweetness = globalSweetness;
    if (!sweetness) {
      for (const [pat, label] of SWEETNESS_PATTERNS) {
        const re = new RegExp(pat.source, pat.flags);
        const m = re.exec(t);
        if (m) {
          if (label === "__SWEET_NUM__") {
            sweetness = `หวาน${m[1]}%`;
          } else {
            sweetness = label;
          }
          t = t.replace(re, " ").trim();
          break;
        }
      }
    }

    // Remove topping keyword prefixes
    t = t.replace(TOPPING_KEYWORDS, " ").trim();

    // Try to match a known product name (longest first) from anywhere in the chunk
    let matchedProduct: string | null = null;
    for (const pn of sortedProducts) {
      if (t.includes(pn)) {
        matchedProduct = pn;
        t = t.replace(pn, " ").trim();
        break;
      }
    }

    // Extract toppings from remaining text (greedy, longest first)
    const foundToppings: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const tp of sortedToppings) {
        // Check as suffix
        if (t.endsWith(tp)) {
          foundToppings.unshift(tp);
          t = t.slice(0, -tp.length).trim();
          changed = true;
          break;
        }
        // Check anywhere
        const idx = t.indexOf(tp);
        if (idx >= 0) {
          foundToppings.push(tp);
          t = (t.slice(0, idx) + " " + t.slice(idx + tp.length)).trim();
          changed = true;
          break;
        }
      }
    }

    // Whatever remains (after removing product + toppings) is used as menu name if no product matched
    const leftover = t.replace(/\s+/g, " ").trim();
    const menuName = matchedProduct
      ? matchedProduct
      : leftover || chunk.raw.trim();

    if (menuName) {
      items.push({
        menuName,
        qty: chunk.qty,
        toppings: foundToppings,
        sweetness
      });
    }
  }

  if (items.length === 0) {
    return { items: [{ menuName: cleaned, qty: 1, toppings: [], sweetness: globalSweetness }] };
  }

  return { items };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { text } = BodySchema.parse(json);

    // Fetch active topping names + product names from DB for matching
    const toppingRows = await db.select({ name: toppings.name }).from(toppings).where(eq(toppings.isActive, true));
    const toppingNames = toppingRows.map((r) => r.name);

    const productRows = await db.select({ name: products.name }).from(products).where(eq(products.isActive, true));
    const productNames = productRows.map((r) => r.name);

    const data = parseThaiOrder(text, toppingNames, productNames);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
