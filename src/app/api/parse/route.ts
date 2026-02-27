import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { toppings } from "@/db/schema";
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

// Sweetness patterns — detected and stripped, no price impact
const SWEETNESS_PATTERNS: [RegExp, string][] = [
  [/ไม่(?:ใส่)?(?:น้ำตาล|หวาน)/g, "ไม่หวาน"],
  [/หวานน้อย/g, "หวานน้อย"],
  [/หวานปกติ/g, "หวานปกติ"],
  [/เพิ่มหวาน/g, "เพิ่มหวาน"],
  [/หวาน\s*(\d+)\s*(?:เปอร์เซ็นต์|%)?/g, "หวาน$1%"],
];

// Topping keyword prefixes (synonyms for "add topping")
const TOPPING_KEYWORDS = /(?:เพิ่ม|บวก|top|ท็อป|ใส่|พร้อม)\s*(?:topping|ท็อปปิ้ง)?\s*/gi;

function parseThaiOrder(text: string, toppingNames: string[]): { items: ParsedItem[] } {
  const fillers = /(เอา|ขอ|หน่อย|ครับ|ค่ะ|นะ|ด้วย|กับ|และ)/g;
  let cleaned = (text || "")
    .replace(fillers, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return { items: [] };

  // Sort topping names longest first for greedy matching
  const sortedToppings = [...toppingNames].sort((a, b) => b.length - a.length);

  // Split into raw chunks by regex: (non-digit text)(digits)(optional แก้ว)
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

  // Process each chunk: extract toppings + sweetness
  const items: ParsedItem[] = [];

  for (const chunk of chunks) {
    let text = chunk.raw.trim();

    // 1. Extract sweetness
    let sweetness: string | null = null;
    for (const [pat, label] of SWEETNESS_PATTERNS) {
      const re = new RegExp(pat.source, pat.flags);
      const m = re.exec(text);
      if (m) {
        sweetness = label.includes("$1") && m[1] ? label.replace("$1", m[1]) : label;
        text = text.replace(re, " ").trim();
        break;
      }
    }

    // 2. Remove topping keyword prefixes
    text = text.replace(TOPPING_KEYWORDS, " ").trim();

    // 3. Extract toppings from end of text (greedy, longest first)
    const foundToppings: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const tp of sortedToppings) {
        if (text.endsWith(tp)) {
          foundToppings.unshift(tp);
          text = text.slice(0, -tp.length).trim();
          changed = true;
          break;
        }
      }
    }

    // 4. Also check for toppings that appear anywhere (e.g. after keyword removal)
    // Check remaining text for standalone topping names with spaces
    const words = text.split(/\s+/);
    const menuWords: string[] = [];
    for (const w of words) {
      const lower = w.toLowerCase();
      const isTopping = sortedToppings.some((tp) => tp === w || tp.toLowerCase() === lower);
      if (isTopping && menuWords.length > 0) {
        foundToppings.push(w);
      } else {
        menuWords.push(w);
      }
    }

    const menuName = menuWords.join(" ").trim();
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
    return { items: [{ menuName: cleaned, qty: 1, toppings: [], sweetness: null }] };
  }

  return { items };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { text } = BodySchema.parse(json);

    // Fetch active topping names from DB for matching
    const toppingRows = await db.select({ name: toppings.name }).from(toppings).where(eq(toppings.isActive, true));
    const toppingNames = toppingRows.map((t) => t.name);

    const data = parseThaiOrder(text, toppingNames);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}
