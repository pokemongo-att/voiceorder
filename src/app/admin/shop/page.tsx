"use client";

import { useEffect, useState } from "react";

export default function AdminShopPage() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [lastSession, setLastSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadStatus() {
    const res = await fetch("/api/shop");
    const d = await res.json();
    if (d.ok) {
      setIsOpen(d.isOpen);
      setLastSession(d.lastSession);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function handleOpen() {
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/shop/open", { method: "POST" });
      const d = await res.json();
      if (!d.ok) { setMsg(d.error); return; }
      setMsg("เปิดร้านเรียบร้อย!");
      loadStatus();
    } finally { setLoading(false); }
  }

  async function handleClose() {
    if (!confirm("ต้องการปิดร้าน? ระบบจะสรุปยอดและปิดออเดอร์ทั้งหมด")) return;
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/shop/close", { method: "POST" });
      const d = await res.json();
      if (!d.ok) { setMsg(d.error); return; }
      setMsg(`ปิดร้านเรียบร้อย! ยอดขายวันนี้: ฿${d.totalSales.toLocaleString()}`);
      loadStatus();
    } finally { setLoading(false); }
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">🏪 เปิด/ปิดร้าน</h2>
        <p className="subtle mt-1">จัดการสถานะร้านค้าและดูสรุปยอดขาย</p>
      </section>

      <section className="card p-6 text-center">
        {isOpen === null ? (
          <p className="text-sm text-slate-500">กำลังโหลด...</p>
        ) : isOpen ? (
          <div>
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">🟢</div>
            <h3 className="mt-3 text-lg font-bold text-emerald-700">ร้านเปิดอยู่</h3>
            <button
              onClick={handleClose}
              disabled={loading}
              className="mt-4 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:bg-rose-300"
            >
              {loading ? "กำลังปิดร้าน..." : "ปิดร้าน"}
            </button>
          </div>
        ) : (
          <div>
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">🔴</div>
            <h3 className="mt-3 text-lg font-bold text-slate-700">ร้านปิดอยู่</h3>
            <button
              onClick={handleOpen}
              disabled={loading}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:bg-emerald-300"
            >
              {loading ? "กำลังเปิดร้าน..." : "เปิดร้าน"}
            </button>
          </div>
        )}

        {msg && <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">{msg}</p>}
      </section>

      {lastSession && (
        <section className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Session ล่าสุด</h3>
          <div className="space-y-1 text-sm text-slate-600">
            <div><b>เปิด:</b> {new Date(lastSession.openedAt).toLocaleString("th-TH")}</div>
            {lastSession.closedAt && <div><b>ปิด:</b> {new Date(lastSession.closedAt).toLocaleString("th-TH")}</div>}
            {lastSession.totalSalesSnapshot && <div><b>ยอดขาย:</b> ฿{Number(lastSession.totalSalesSnapshot).toLocaleString()}</div>}
          </div>
        </section>
      )}
    </main>
  );
}
