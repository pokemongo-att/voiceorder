"use client";

import { useState } from "react";

export default function AdminOrdersPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`ยืนยันลบออเดอร์ทั้งหมดของวันที่ ${date}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/orders?date=${date}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) {
        setMsg(`❌ ${d.error}`);
        return;
      }
      setMsg(`✅ ลบสำเร็จ ${d.deleted} ออเดอร์`);
    } catch (err: any) {
      setMsg(`❌ ${err?.message || "Error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">🗑️ ลบออเดอร์</h2>
        <p className="subtle mt-1">ลบออเดอร์ตามวันที่ (รวม order items ทั้งหมด)</p>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">เลือกวันที่</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="soft-input mt-1 w-44" />
          </div>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:bg-rose-300"
          >
            {loading ? "กำลังลบ..." : "ลบออเดอร์วันนี้"}
          </button>
        </div>
        {msg && (
          <p className={`mt-3 rounded-xl border px-3 py-2 text-sm font-medium ${msg.startsWith("✅") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {msg}
          </p>
        )}
      </section>

      <section className="card border-amber-200 bg-amber-50 p-5">
        <p className="text-sm text-amber-800">
          <b>⚠️ คำเตือน:</b> การลบออเดอร์จะลบข้อมูลถาวร ไม่สามารถกู้คืนได้ กรุณาตรวจสอบวันที่ให้ถูกต้องก่อนกดลบ
        </p>
      </section>
    </main>
  );
}
