"use client";

import { useEffect, useState } from "react";

type Report = {
  from: string;
  to: string;
  totalSales: number;
  totalOrders: number;
  totalCups: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  breakdown: { label: string; sales: number; orders: number; cups: number }[];
};

type Staff = { id: string; name: string };

export default function AdminReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [staffId, setStaffId] = useState("");
  const [period, setPeriod] = useState<"" | "weekly" | "monthly">("");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/staffs").then((r) => r.json()).then((d) => {
      if (d.ok) setStaffList(d.staffs.map((s: any) => ({ id: s.id, name: s.name })));
    });
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (staffId) params.set("staffId", staffId);
      if (period) params.set("period", period);
      const res = await fetch(`/api/reports/daily?${params}`);
      const d = await res.json();
      if (d.ok) setReport(d);
    } finally {
      setLoading(false);
    }
  }

  function setQuickRange(days: number) {
    const d = new Date();
    const end = d.toISOString().slice(0, 10);
    d.setDate(d.getDate() - days + 1);
    setFrom(d.toISOString().slice(0, 10));
    setTo(end);
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">📊 รายงานยอดขาย</h2>
        <p className="subtle mt-1">ดูสรุปยอดขายตามช่วงเวลา ผู้ขาย</p>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">จาก</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="soft-input mt-1 w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">ถึง</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="soft-input mt-1 w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">พนักงาน</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="soft-input mt-1 w-36">
              <option value="">ทั้งหมด</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">ช่วง</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="soft-input mt-1 w-32">
              <option value="">รวม</option>
              <option value="weekly">รายสัปดาห์</option>
              <option value="monthly">รายเดือน</option>
            </select>
          </div>
          <button onClick={loadReport} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400">
            {loading ? "กำลังโหลด..." : "ดูรายงาน"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => { setFrom(today); setTo(today); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">วันนี้</button>
          <button onClick={() => setQuickRange(7)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">7 วัน</button>
          <button onClick={() => setQuickRange(30)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">30 วัน</button>
          <button onClick={() => setQuickRange(90)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">90 วัน</button>
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

          {report.breakdown.length > 0 && (
            <section className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">สรุปตามช่วง ({period === "weekly" ? "สัปดาห์" : "เดือน"})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                      <th className="pb-2">ช่วง</th>
                      <th className="pb-2 text-right">ยอดขาย</th>
                      <th className="pb-2 text-right">ออเดอร์</th>
                      <th className="pb-2 text-right">แก้ว</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.breakdown.map((b, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 text-slate-700">{b.label}</td>
                        <td className="py-2 text-right font-semibold">฿{b.sales.toLocaleString()}</td>
                        <td className="py-2 text-right">{b.orders}</td>
                        <td className="py-2 text-right">{b.cups}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

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
