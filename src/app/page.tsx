"use client";

import { useMemo, useState } from "react";

type ParsedItem = { menuName: string; qty: number };

function getSpeechRecognition(): any | null {
  // Android Chrome: SpeechRecognition
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function HomePage() {
  const [listening, setListening] = useState(false);
  const [rawText, setRawText] = useState("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [status, setStatus] = useState<string>("");

  const supported = useMemo(() => !!getSpeechRecognition(), []);

  async function parseText(text: string) {
    setStatus("กำลังแปลงข้อความเป็นรายการ...");
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Parse failed");
    setItems(data.items ?? []);
    setStatus("");
  }

  async function saveOrder() {
    if (!items.length) return;
    setStatus("กำลังบันทึกออเดอร์...");
    const staffKey = process.env.NEXT_PUBLIC_STAFF_API_KEY ?? "";
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-staff-key": staffKey
      },
      body: JSON.stringify({
        rawText,
        createdBy: "android-staff",
        items
      })
    });
    const data = await res.json();
    if (!data.ok) {
      if (res.status === 401) {
        setStatus("Unauthorized: ตรวจสอบให้ NEXT_PUBLIC_STAFF_API_KEY ตรงกับ STAFF_API_KEY");
        return;
      }
      setStatus(data.error || "บันทึกไม่สำเร็จ");
      return;
    }
    const confirmedAt = data.confirmedAt ? new Date(data.confirmedAt) : new Date();
    setStatus(`✅ บันทึกแล้ว: ${data.orderId} (${confirmedAt.toLocaleString("th-TH")})`);
    setRawText("");
    setItems([]);
  }

  const statusTone = status.startsWith("✅")
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status.includes("Unauthorized")
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-sky-200 bg-sky-50 text-sky-700";

  function startListening() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const rec = new SR();
    rec.lang = "th-TH";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setStatus("กำลังฟัง...");
    };

    rec.onresult = async (e: any) => {
      const text: string = (e.results?.[0]?.[0]?.transcript || "").trim();
      setRawText(text);
      setListening(false);
      try {
        await parseText(text);
      } catch (err: any) {
        setStatus(err?.message || "Parse error");
      }
    };

    rec.onerror = (e: any) => {
      setListening(false);
      setStatus("เกิดข้อผิดพลาดในการรับเสียง: " + (e?.error || "unknown"));
    };

    rec.onend = () => {
      setListening(false);
    };

    rec.start();
  }

  return (
    <main className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="card-title">🎤 รับออเดอร์ด้วยเสียง (Android)</h2>
            <p className="mt-1 text-sm text-slate-600">พูดชื่อเมนูและจำนวน แล้วระบบจะแปลงเป็นรายการทันที</p>
          </div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Live Voice Input</span>
        </div>

        {!supported && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับ SpeechRecognition (แนะนำ Chrome บน Android)
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={startListening}
            disabled={!supported || listening}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {listening ? "กำลังฟัง..." : "เริ่มพูด"}
          </button>

          <button
            onClick={() => rawText && parseText(rawText)}
            disabled={!rawText}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            แปลงข้อความใหม่
          </button>

          <button
            onClick={saveOrder}
            disabled={!items.length}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            ยืนยันบันทึก
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          ตัวอย่าง: <b>ชานม 2 แก้ว โกโก้ 1 แก้ว</b> หรือ <b>ชาไทย</b> (ถ้าไม่พูดจำนวน ระบบจะใส่ <b>1</b>)
        </p>
      </section>

      <section className="card p-5">
        <h3 className="card-title">ข้อความจากเสียง</h3>
        <p className="subtle mt-1">แก้ไขเองได้ก่อนกดบันทึก</p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="พิมพ์เองได้ เช่น ชานม 2 แก้ว"
          rows={4}
          className="soft-input mt-3 resize-y"
        />
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="card-title">Preview รายการ</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{items.length} รายการ</span>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการ</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((it, idx) => (
              <li key={idx} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <b className="text-slate-800">{it.menuName || "(ไม่พบชื่อเมนู)"}</b>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    จำนวน
                    <input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || "1", 10));
                        setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: v } : x)));
                      }}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}

        {status && <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-medium ${statusTone}`}>{status}</p>}
      </section>
    </main>
  );
}
