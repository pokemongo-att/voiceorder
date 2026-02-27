"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type ParsedItem = {
  menuName: string;
  qty: number;
  price?: number;
  subtotal?: number;
  toppings?: string[];
  toppingPrices?: number[];
  toppingTotal?: number;
  sweetness?: string | null;
  entryId: string; // links item back to the speech entry it came from
};
type StaffOption = { id: string; name: string };
type ToppingInfo = { name: string; price: number };
type SpeechEntry = { id: string; text: string };

let _entrySeq = 0;
function nextEntryId() { return `e${++_entrySeq}_${Date.now()}`; }

function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function HomePage() {
  const [listening, setListening] = useState(false);
  const [manualText, setManualText] = useState("");
  const [entries, setEntries] = useState<SpeechEntry[]>([]);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [shopOpen, setShopOpen] = useState<boolean | null>(null);
  const [toppingList, setToppingList] = useState<ToppingInfo[]>([]);

  const supported = useMemo(() => !!getSpeechRecognition(), []);

  // Load staffs + shop status + toppings on mount
  useEffect(() => {
    fetch("/api/staffs").then((r) => r.json()).then((d) => {
      if (d.ok) setStaffList(d.staffs.map((s: any) => ({ id: s.id, name: s.name })));
    });
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      if (d.ok) setShopOpen(d.isOpen);
    });
    fetch("/api/toppings").then((r) => r.json()).then((d) => {
      if (d.ok) setToppingList(d.toppings.map((t: any) => ({ name: t.name, price: Number(t.price) })));
    });
  }, []);

  const total = items.reduce((s, i) => s + (i.subtotal ?? 0), 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  const toppingMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of toppingList) m.set(t.name, t.price);
    return m;
  }, [toppingList]);

  const addEntryAndParse = useCallback(async (text: string) => {
    const entryId = nextEntryId();
    setEntries((prev) => [...prev, { id: entryId, text }]);

    setStatus("กำลังแปลงข้อความเป็นรายการ...");
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Parse failed");

    // Fetch product prices
    const prodRes = await fetch("/api/products");
    const prodData = await prodRes.json();
    const productMap = new Map<string, number>();
    if (prodData.ok) {
      for (const p of prodData.products) productMap.set(p.name, Number(p.price));
    }
    const defaultPrice = 20;

    const newItems: ParsedItem[] = [];
    for (const it of data.items ?? []) {
      const drinkPrice = productMap.get(it.menuName) ?? defaultPrice;
      const tps: string[] = it.toppings ?? [];
      const tpPrices: number[] = tps.map((t: string) => toppingMap.get(t) ?? 0);
      const tpTotal = tpPrices.reduce((s: number, p: number) => s + p, 0);
      const unitPrice = drinkPrice + tpTotal;
      newItems.push({
        menuName: it.menuName,
        qty: it.qty,
        price: drinkPrice,
        toppings: tps,
        toppingPrices: tpPrices,
        toppingTotal: tpTotal,
        sweetness: it.sweetness || null,
        subtotal: unitPrice * it.qty,
        entryId
      });
    }

    setItems((prev) => [...prev, ...newItems]);
    setStatus("");
  }, [toppingMap]);

  async function saveOrder() {
    if (!items.length) return;
    setStatus("กำลังบันทึกออเดอร์...");
    const rawText = entries.map((e) => e.text).join(", ");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText,
        staffId: selectedStaff || undefined,
        items: items.map((i) => ({
          menuName: i.menuName,
          qty: i.qty,
          toppings: i.toppings ?? [],
          sweetness: i.sweetness ?? null
        }))
      })
    });
    const data = await res.json();
    if (!data.ok) {
      setStatus(data.error || "บันทึกไม่สำเร็จ");
      return;
    }
    const confirmedAt = data.confirmedAt ? new Date(data.confirmedAt) : new Date();
    setStatus(`✅ บันทึกแล้ว (${confirmedAt.toLocaleString("th-TH")}) — ยอดรวม ฿${data.totalAmount}`);
    setEntries([]);
    setItems([]);
    setManualText("");
  }

  const statusTone = status.startsWith("✅")
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status.includes("ไม่") || status.includes("Unauthorized") || status.includes("error")
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-sky-200 bg-sky-50 text-sky-700";

  function startListening() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const rec = new SR();
    rec.lang = "th-TH";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => { setListening(true); setStatus("กำลังฟัง..."); };
    rec.onresult = async (e: any) => {
      const text: string = (e.results?.[0]?.[0]?.transcript || "").trim();
      setListening(false);
      if (text) {
        try { await addEntryAndParse(text); } catch (err: any) { setStatus(err?.message || "Parse error"); }
      }
    };
    rec.onerror = (e: any) => { setListening(false); setStatus("เกิดข้อผิดพลาด: " + (e?.error || "unknown")); };
    rec.onend = () => { setListening(false); };
    rec.start();
  }

  function removeEntry(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    setItems((prev) => prev.filter((i) => i.entryId !== entryId));
  }

  function removeItemAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setEntries([]);
    setItems([]);
    setManualText("");
    setStatus("ล้างรายการทั้งหมดแล้ว");
  }

  // Shop closed banner
  if (shopOpen === false) {
    return (
      <main className="grid gap-4">
        <section className="card border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-xl font-bold text-amber-800">ร้านยังไม่เปิด</h2>
          <p className="mt-2 text-sm text-amber-700">กรุณาให้ Admin เปิดร้านก่อนเริ่มรับออเดอร์</p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid gap-4 pb-24 lg:grid-cols-[1.2fr_1fr]">
      {/* Staff selector + voice input */}
      <section className="card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="card-title">🎤 รับออเดอร์ด้วยเสียง</h2>
            <p className="mt-1 text-sm text-slate-600">พูดได้หลายรอบ รายการจะต่อกันจนกว่าจะกดบันทึก</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">พนักงาน:</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">-- เลือก --</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!supported && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            อุปกรณ์นี้ไม่รองรับ SpeechRecognition (แนะนำ Chrome บน Android)
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={startListening}
            disabled={!supported || listening}
            className={`mic-btn flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white transition ${listening ? "animate-pulse-mic bg-emerald-500" : "bg-slate-900 hover:bg-slate-800"} disabled:cursor-not-allowed disabled:bg-slate-400`}
          >
            🎤
          </button>
          <div className="text-sm text-slate-600">
            {listening ? <span className="font-semibold text-emerald-600">กำลังฟัง...</span> : "กดปุ่มไมค์แล้วพูด"}
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          ตัวอย่าง: <b>ชาเย็นบุก2แก้ว</b> / <b>ชาเขียวหวานน้อย 2</b> / <b>โกโก้ เพิ่มครีมชีส 1</b>
        </p>
      </section>

      {/* Voice entries list + manual input */}
      <section className="card p-5">
        <h3 className="card-title">ข้อความจากเสียง</h3>
        <p className="subtle mt-1">แต่ละรอบพูดจะต่อเป็นรายการ ลบได้ทีละรอบ</p>

        {entries.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                <span className="text-sm text-slate-700">{entry.text}</span>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="shrink-0 rounded-md border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50"
                >
                  ❌
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualText.trim()) {
                addEntryAndParse(manualText.trim());
                setManualText("");
              }
            }}
            placeholder="พิมพ์เพิ่มเอง เช่น ชาเย็นบุก 2"
            className="soft-input flex-1"
          />
          <button
            onClick={() => {
              if (manualText.trim()) {
                addEntryAndParse(manualText.trim());
                setManualText("");
              }
            }}
            disabled={!manualText.trim()}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 disabled:opacity-40"
          >
            เพิ่ม
          </button>
        </div>
      </section>

      {/* Preview */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="card-title">Preview รายการ</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{totalQty} แก้ว</span>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการ</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {items.map((it, idx) => {
                const unitPrice = (it.price ?? 0) + (it.toppingTotal ?? 0);
                return (
                  <li key={idx} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <b className="text-slate-800">{it.menuName}</b>
                        {(it.toppings?.length ?? 0) > 0 && (
                          <span className="ml-1 text-xs text-orange-600">+{it.toppings!.join("+")}</span>
                        )}
                        {it.sweetness && (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{it.sweetness}</span>
                        )}
                        <span className="ml-2 text-xs text-slate-500">฿{unitPrice}/แก้ว</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value || "1", 10));
                            setItems((prev) => prev.map((x, i) => {
                              if (i !== idx) return x;
                              const up = (x.price ?? 0) + (x.toppingTotal ?? 0);
                              return { ...x, qty: v, subtotal: up * v };
                            }));
                          }}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm"
                        />
                        <span className="min-w-[60px] text-right text-sm font-semibold text-slate-700">฿{it.subtotal ?? 0}</span>
                        <button
                          onClick={() => removeItemAt(idx)}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <div>
                <span className="text-sm font-medium">รวมทั้งหมด</span>
                <span className="ml-2 text-lg font-bold">฿{total.toLocaleString()}</span>
              </div>
              <button
                onClick={clearAll}
                className="rounded-lg border border-white/30 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </>
        )}

        {status && <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-medium ${statusTone}`}>{status}</p>}
      </section>

      {/* Sticky confirm button */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:col-span-2">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              <b>{totalQty}</b> แก้ว — <b>฿{total.toLocaleString()}</b>
            </div>
            <button
              onClick={saveOrder}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
            >
              ยืนยันบันทึก
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
