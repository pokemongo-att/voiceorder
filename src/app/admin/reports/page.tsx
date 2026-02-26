"use client";

import { useState } from "react";

type Report = {
  date: string;
  totalSales: number;
  totalOrders: number;
  totalCups: number;
  topProducts: { name: string; qty: number; revenue: number }[];
};

export default function AdminReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/daily?date=${date}`);
      const d = await res.json();
      if (d.ok) setReport(d);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">📊 รายงานยอดขาย</h2>
        <p className="subtle mt-1">ดูสรุปยอดขายรายวัน</p>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">เลือกวันที่</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="soft-input mt-1 w-44" />
          </div>
          <button onClick={loadReport} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400">
            {loading ? "กำลังโหลด..." : "ดูรายงาน"}
          </button>
        </div>
      </section>

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-slate-500">ยอดขายรวม</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">฿{report.totalSales.toLocaleString()}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-slate-500">จำนวนออเดอร์</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{report.totalOrders}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-slate-500">จำนวนแก้ว</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{report.totalCups}</p>
            </div>
          </div>

          <section className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">สินค้าขายดี</h3>
            {report.topProducts.length === 0 ? (
              <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>
            ) : (
              <ul className="space-y-2">
                {report.topProducts.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div>
                      <b className="text-slate-800">{p.name}</b>
                      <span className="ml-2 text-xs text-slate-500">{p.qty} แก้ว</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">฿{p.revenue.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
