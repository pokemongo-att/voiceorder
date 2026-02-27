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

// Sweetness keyword regex — ordered longest-first so หวานน้อย matches before หวาน
// Captures: (keyword)(optional number)(optional % or เปอร์เซ็นต์)
const SWEETNESS_RE =
  /(หวานน้อย|หวานมาก|หวานปกติ|เพิ่มหวาน|ไม่(?:ใส่)?(?:น้ำตาล|หวาน)|หวาน)\s*(\d+)?\s*(%|เปอร์เซ็นต์)?/g;

// Topping keyword prefixes (synonyms for "add topping")
const TOPPING_KEYWORDS = /(?:เพิ่ม|บวก|top|ท็อป|ใส่|พร้อม)\s*(?:topping|ท็อปปิ้ง)?\s*/gi;

type SweetnessInfo = {
  label: string;      // e.g. "หวานน้อย50%" or "หวานมาก"
  forceQty1: boolean;  // true when number > 10 without explicit %
};

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

  // ── Step 0: Extract ALL sweetness tokens → replace with markers ──
  // This prevents "หวาน50" from being split by the chunk regex into qty=50
  const sweetnessSlots: SweetnessInfo[] = [];

  // Use private-use Unicode chars as markers (no digits → safe from chunk regex)
  const marker = (i: number) => String.fromCharCode(0xE000 + i);

  cleaned = cleaned.replace(SWEETNESS_RE, (_full, keyword: string, numStr?: string, pctSign?: string) => {
    const idx = sweetnessSlots.length;
    let label: string;
    let forceQty1 = false;

    if (numStr) {
      const num = parseInt(numStr, 10);
      if (pctSign) {
        // Rule A: explicit % → always sweetness
        label = `${keyword}${num}%`;
      } else if (num > 10) {
        // Rule B: no %, number > 10 → treat as sweetness %, force qty=1
        label = `${keyword}${num}%`;
        forceQty1 = true;
      } else {
        // Number ≤ 10 without % → number is qty, sweetness = keyword only
        // Put the number back so chunk splitter picks it up as qty
        sweetnessSlots.push({ label: keyword, forceQty1: false });
        return `${marker(idx)}${numStr}`;
      }
    } else {
      // No number → just the keyword (e.g. "หวานน้อย", "หวานมาก")
      label = keyword;
    }

    sweetnessSlots.push({ label, forceQty1 });
    return marker(idx);
  });

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Sort product names longest first for greedy matching
  const sortedProducts = [...productNames].sort((a, b) => b.length - a.length);
  // Sort topping names longest first for greedy matching
  const sortedToppings = [...toppingNames].sort((a, b) => b.length - a.length);

  // ── Step 1: Split into raw chunks by regex: (non-digit text)(digits)(optional แก้ว) ──
  // Markers (§S0§ etc.) are non-digit so they stay with their chunk
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

  // ── Step 2: Process each chunk — extract markers, toppings, match product ──
  const items: ParsedItem[] = [];
  // Build regex that matches any of our private-use markers
  const markerChars = sweetnessSlots.map((_, i) => marker(i));
  const markerReStr = markerChars.length > 0
    ? `[${markerChars.map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")}]`
    : null;

  for (const chunk of chunks) {
    let t = chunk.raw.trim();

    // Extract sweetness markers from this chunk
    let sweetness: string | null = null;
    let forceQty1 = false;
    for (let si = 0; si < sweetnessSlots.length; si++) {
      const mc = marker(si);
      if (t.includes(mc)) {
        sweetness = sweetnessSlots[si].label;
        forceQty1 = sweetnessSlots[si].forceQty1;
      }
    }
    // Remove all marker chars from text
    for (const mc of markerChars) {
      t = t.split(mc).join(" ");
    }
    t = t.replace(/\s+/g, " ").trim();

    // If forceQty1 (Rule B), override the chunk qty
    let qty = chunk.qty;
    if (forceQty1) qty = 1;

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
        if (t.endsWith(tp)) {
          foundToppings.unshift(tp);
          t = t.slice(0, -tp.length).trim();
          changed = true;
          break;
        }
        const idx = t.indexOf(tp);
        if (idx >= 0) {
          foundToppings.push(tp);
          t = (t.slice(0, idx) + " " + t.slice(idx + tp.length)).trim();
          changed = true;
          break;
        }
      }
    }

    // Whatever remains is used as menu name if no product matched
    const leftover = t.replace(/\s+/g, " ").trim();
    const menuName = matchedProduct
      ? matchedProduct
      : leftover || null;

    if (menuName) {
      // Normal item with (possibly) sweetness
      items.push({ menuName, qty, toppings: foundToppings, sweetness });
    } else if (sweetness && items.length > 0) {
      // Rule D: sweetness-only chunk → apply to nearest previous item
      items[items.length - 1].sweetness = sweetness;
    } else if (leftover || chunk.raw.trim()) {
      // Fallback: push whatever we have
      let fallbackRaw = chunk.raw;
      for (const mc of markerChars) fallbackRaw = fallbackRaw.split(mc).join("");
      items.push({
        menuName: fallbackRaw.replace(/\s+/g, " ").trim() || "ไม่ทราบชื่อ",
        qty,
        toppings: foundToppings,
        sweetness
      });
    }
  }

  if (items.length === 0) {
    let fallbackName = cleaned;
    for (const mc of markerChars) fallbackName = fallbackName.split(mc).join("");
    fallbackName = fallbackName.replace(/\s+/g, " ").trim();
    return { items: [{ menuName: fallbackName || text.trim(), qty: 1, toppings: [], sweetness: sweetnessSlots[0]?.label ?? null }] };
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
