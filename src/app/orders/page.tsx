import { db } from "@/db/client";
import { orders, orderItems } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const latest = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20);

  const rows = [];
  for (const o of latest) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    rows.push({ o, items });
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="card-title">รายการออเดอร์ล่าสุด</h2>
            <p className="subtle mt-1">อัปเดตแบบเรียลไทม์ แสดง 20 ออเดอร์ล่าสุด</p>
          </div>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">ทั้งหมด {rows.length} ออเดอร์</span>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="card p-5">
          <p className="text-sm text-slate-500">ยังไม่มีออเดอร์</p>
        </section>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ o, items }) => (
            <section key={o.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm text-slate-900 sm:text-base">Order: {o.id}</b>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {new Date(o.createdAt as any).toLocaleString("th-TH")}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <div>
                  <b>พูดว่า:</b> {o.rawText}
                </div>
                <div>
                  <b>โดย:</b> {o.createdBy}
                </div>
              </div>

              <ul className="mt-3 space-y-1.5">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{it.menuName}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">x{it.qty}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
