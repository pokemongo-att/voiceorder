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

// Topping verb prefixes — stripped before topping extraction
// These may appear standalone (with space) OR glued directly to the topping name
const TOPPING_PREFIX_RE = /(?:เพิ่ม|บวก|ท็อป|ใส่|พร้อม)\s*(?:topping|ท็อปปิ้ง)?\s*|(?:^|\s)topping\s*/gi;

// Latin → Thai phonetic substitution — applied BEFORE topping extraction
// so "มุก Pop" becomes "มุกป๊อป" and can match "มุกป๊อป" topping name
const LATIN_TO_THAI: [RegExp, string][] = [
  [/\bpopping\b/gi, "ป๊อป"],
  [/\bpop\b/gi,     "ป๊อป"],
  [/\bstrawberry\b/gi, "สตรอ"],
  [/\bstraw\b/gi,   "สตรอ"],
  [/\bapple\b/gi,   "แอปเปิ้ล"],
  [/\btaro\b/gi,    "เผือก"],
  [/\bmatcha\b/gi,  "มัทฉะ"],
];

// Word-level Thai alias substitutions for common speech-recognition errors
// Applied before topping matching
const WORD_ALIASES: [RegExp, string][] = [
  [/กรีน/g, "ครีม"],  // กรีนชีค → ครีมชีส
  [/กรีม/g, "ครีม"],  // กรีม → ครีม
  [/ชีค/g,  "ชีส"],   // ชีค → ชีส
  [/ชี่/g,  "ชีส"],   // ชี่ → ชีส
];

// Leftover Latin fragment strip (fallback after topping extraction)
const LATIN_TOPPING_FRAGMENTS = /\b(?:pop|popping|strawberry|straw|apple|taro|matcha|coffee|choco|brown|sugar|cream|cheese|green|black|white|original|classic)\b/gi;

// ── Normalize Thai text for fuzzy matching ──
// 1. Strip ไม้ไต่คู้ (็) and ไม้ตรี (๊) and tone marks (่้๋๎)
// 2. Normalize initial cluster กร→คร (กรีน→ครีน) for ครีมชีส vs กรีนชีค
// 3. Normalize final consonant homophones
function normThai(s: string): string {
  return s
    .replace(/[็๊่้๋๎]/g, "")               // strip tone/short marks
    .replace(/^กร/u, "คร")                  // initial กร→คร (กรีน↔ครีม)
    .replace(/กร(?=[ีิ])/gu, "คร")          // mid-word กร+vowel
    .replace(/[ปบพภผกขคฆ]$/u, "บ")        // final stop cluster
    .replace(/[ดตถทฏฐฑฒ]$/u, "ด");         // final -t/-d cluster
}

// Product name aliases: speech often drops the prefix (ชา, ช้า)
// Map normalized/short form → full product name pattern to try
const PRODUCT_ALIASES: [RegExp, string][] = [
  [/^เขียว/u,        "ชาเขียว"],
  [/^เย็น(?!ชา)/u,   "ชาเย็น"],
  [/^แดงเย็น/u,      "ชาแดงเย็น"],
  [/^แร่เย็น/u,      "ชาแดงเย็น"],
  [/^แร์เย็น/u,      "ชาแดงเย็น"],
  [/^โกโก้$/u,       "โกโก้"],
  [/^โลโก้/u,        "โลโก้"],
];

// Build normalized index: normKey → canonical DB name
function buildNormIndex(names: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of names) m.set(normThai(n), n);
  return m;
}

// Find best matching topping name in `text` using normalized comparison.
// Returns { canonical, pos, len } of the leftmost longest match, or null.
// Tries exact match first (longest-first), then normalized fuzzy match.
function findTopping(
  text: string,
  sortedNames: string[],
  normIndex: Map<string, string>
): { canonical: string; pos: number; len: number } | null {
  // Pass 1: exact substring match (longest-first guarantees ไข่มุกป๊อป before ไข่มุก)
  for (const tp of sortedNames) {
    const pos = text.indexOf(tp);
    if (pos >= 0) return { canonical: tp, pos, len: tp.length };
  }
  // Pass 2: normalized fuzzy match (handles มุกป๊อบ ↔ มุกป๊อป, กรีนชีค ↔ ครีมชีส)
  // Slide window of each topping's length; also try ±1 for removed tone marks
  for (const tp of sortedNames) {
    const normTp = normThai(tp);
    const len = tp.length;
    for (let i = 0; i <= text.length - len; i++) {
      if (normThai(text.slice(i, i + len)) === normTp) {
        return { canonical: tp, pos: i, len };
      }
    }
    for (const tryLen of [len - 1, len + 1]) {
      if (tryLen < 2 || tryLen > text.length) continue;
      for (let i = 0; i <= text.length - tryLen; i++) {
        if (normThai(text.slice(i, i + tryLen)) === normTp) {
          return { canonical: tp, pos: i, len: tryLen };
        }
      }
    }
  }
  return null;
}

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
  // Normalized index for fuzzy topping matching
  const toppingNormIndex = buildNormIndex(toppingNames);

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

    // ── Strip topping verb prefixes FIRST (before product match) ──
    t = t.replace(TOPPING_PREFIX_RE, " ").replace(/\s+/g, " ").trim();

    // ── Transliterate Latin topping words → Thai phonetic (e.g. Pop → ป๊อป) ──
    // Also handle Latin word that is glued to or separated from a Thai prefix:
    //   "มุก Pop" → "มุกป๊อป"  (space between Thai and Latin)
    //   "มุกPop"  → "มุกป๊อป"  (no space)
    // Strategy: replace \bLATIN\b OR Thai-adjacent Latin (preceded/followed by Thai char with optional space)
    for (const [re, thai] of LATIN_TO_THAI) {
      // Standard word-boundary replace (handles "Pop" standalone or space-separated)
      t = t.replace(re, thai);
    }
    // Collapse space between Thai consonant and the EXACT transliterated words
    // so "มุก ป๊อป" → "มุกป๊อป" but "ชาเย็น มุก" stays "ชาเย็น มุก"
    const TRANSLATED_WORDS = ["ป๊อป", "สตรอ", "แอปเปิ้ล", "เผือก", "มัทฉะ"];
    for (const tw of TRANSLATED_WORDS) {
      // Only join when directly preceded by a Thai consonant (U+0E01-U+0E2E)
      t = t.replace(new RegExp(`(?<=[\\u0E01-\\u0E2E]) ${tw}`, "gu"), tw);
    }
    t = t.replace(/\s+/g, " ").trim();

    // ── Word-level alias substitution (e.g. กรีนชีค → ครีมชีส) ──
    for (const [re, sub] of WORD_ALIASES) {
      t = t.replace(re, sub);
    }
    t = t.replace(/\s+/g, " ").trim();

    // ── Extract toppings greedily (longest-first, with fuzzy normalize) ──
    const foundToppings: string[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      const hit = findTopping(t, sortedToppings, toppingNormIndex);
      if (hit) {
        foundToppings.push(hit.canonical);
        t = (t.slice(0, hit.pos) + " " + t.slice(hit.pos + hit.len)).replace(/\s+/g, " ").trim();
        changed = true;
      }
    }

    // ── Partial suffix alias (normalized): 'มุก' → 'ไข่มุก' etc. ──
    const remainingWords = t.split(/\s+/).filter(Boolean);
    const resolvedWords: string[] = [];
    for (const word of remainingWords) {
      if (word.length < 2) { resolvedWords.push(word); continue; }
      const normWord = normThai(word);
      // Exact suffix match (normalized)
      const aliasMatch = sortedToppings.find(
        (tp) => tp !== word && normThai(tp).endsWith(normWord)
      );
      if (aliasMatch && !foundToppings.includes(aliasMatch)) {
        foundToppings.push(aliasMatch);
      } else {
        resolvedWords.push(word);
      }
    }
    t = resolvedWords.join(" ").trim();

    // ── Strip leftover Latin topping-fragment words (Pop, Strawberry …) ──
    // These remain after a topping was successfully extracted (e.g. ไข่มุก Pop → ไข่มุก consumed, "Pop" left)
    if (foundToppings.length > 0) {
      t = t.replace(LATIN_TOPPING_FRAGMENTS, " ").replace(/\s+/g, " ").trim();
    }

    // ── Match product name (longest first) from remaining text ──
    let matchedProduct: string | null = null;
    for (const pn of sortedProducts) {
      if (t.includes(pn)) {
        matchedProduct = pn;
        t = t.replace(pn, " ").replace(/\s+/g, " ").trim();
        break;
      }
    }

    // ── Try product aliases if no exact product match ──
    if (!matchedProduct) {
      for (const [re, canonical] of PRODUCT_ALIASES) {
        if (re.test(t)) {
          // Check if canonical name is in our product list (exact or prefix)
          const found = sortedProducts.find(pn => pn === canonical || pn.startsWith(canonical.replace(/[เ-ๆ]+$/u, "")));
          if (found) {
            matchedProduct = found;
            t = t.replace(re, " ").replace(/\s+/g, " ").trim();
            break;
          } else {
            // Use canonical directly even if not in DB — better than leftover garbage
            matchedProduct = canonical;
            t = t.replace(re, " ").replace(/\s+/g, " ").trim();
            break;
          }
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
