"use client";

import { useEffect, useState } from "react";

type OrderItem = {
  id: string;
  productNameSnapshot: string;
  priceSnapshot: string;
  qty: number;
  subtotal: string;
  toppingsSnapshot: any;
  sweetness: string | null;
  toppingTotal: string;
};

type Order = {
  id: string;
  rawText: string;
  createdBy: string;
  staffId: string | null;
  totalAmount: string;
  totalQty: number;
  status: string;
  orderNo: number | null;
  createdAt: string;
  items: OrderItem[];
};

type Staff = { id: string; name: string };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffId, setStaffId] = useState("");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/staffs").then((r) => r.json()).then((d) => {
      if (d.ok) setStaffList(d.staffs.map((s: any) => ({ id: s.id, name: s.name })));
    });
  }, []);

  async function load(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (staffId) params.set("staffId", staffId);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/orders?${params}`);
      const d = await res.json();
      if (d.ok) {
        setOrders(d.orders);
        setPagination(d.pagination);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const staffMap = new Map(staffList.map((s) => [s.id, s.name]));

  return (
    <main className="grid gap-4">
      {/* Filters */}
      <section className="card p-4 sm:p-5">
        <h2 className="card-title">รายการออเดอร์</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">วันที่</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="soft-input mt-1 w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">พนักงาน</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="soft-input mt-1 w-36">
              <option value="">ทั้งหมด</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={() => load(1)} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400">
            {loading ? "กำลังโหลด..." : "ค้นหา"}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          ทั้งหมด {pagination.total} ออเดอร์ · หน้า {pagination.page}/{pagination.totalPages || 1}
        </div>
      </section>

      {/* Orders list */}
      {orders.length === 0 ? (
        <section className="card p-5">
          <p className="text-sm text-slate-500">ไม่พบออเดอร์</p>
        </section>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => {
            const isOpen = expanded.has(o.id);
            const staffName = o.staffId ? staffMap.get(o.staffId) ?? o.createdBy : o.createdBy;
            return (
              <section key={o.id} className="card overflow-hidden">
                <button onClick={() => toggle(o.id)} className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-slate-50 sm:p-5">
                  <div className="flex items-center gap-2">
                    {o.orderNo && (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {o.orderNo}
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <b className="text-sm text-slate-900">฿{Number(o.totalAmount).toLocaleString()}</b>
                        <span className="text-xs text-slate-500">{o.totalQty} แก้ว</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${o.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {o.status}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {staffName} · {new Date(o.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 pb-4 sm:px-5">
                    {o.rawText && <p className="mt-3 text-xs text-slate-500"><b>พูดว่า:</b> {o.rawText}</p>}
                    <ul className="mt-2 space-y-1.5">
                      {o.items.map((it) => {
                        const tps = (Array.isArray(it.toppingsSnapshot) ? it.toppingsSnapshot : []) as any[];
                        return (
                          <li key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <div>
                              <span className="text-slate-700">{it.productNameSnapshot}</span>
                              {tps.length > 0 && (
                                <span className="ml-1 text-xs text-orange-600">+{tps.map((t: any) => t.name).join("+")}</span>
                              )}
                              {it.sweetness && (
                                <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">{it.sweetness}</span>
                              )}
                              <span className="ml-2 text-xs text-slate-400">
                                ฿{Number(it.priceSnapshot)}{Number(it.toppingTotal) > 0 ? `+${Number(it.toppingTotal)}` : ""}/แก้ว
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">x{it.qty}</span>
                              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">฿{Number(it.subtotal)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => load(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ← ก่อนหน้า
          </button>
          <span className="text-sm text-slate-500">{pagination.page} / {pagination.totalPages}</span>
          <button
            onClick={() => load(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ถัดไป →
          </button>
        </div>
      )}
    </main>
  );
}
