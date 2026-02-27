"use client";

import { useEffect, useState } from "react";

type Topping = { id: string; name: string; price: string; isActive: boolean };

export default function AdminToppingsPage() {
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("10");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/toppings");
    const d = await res.json();
    if (d.ok) setToppings(d.toppings);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/toppings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price) })
    });
    const d = await res.json();
    if (!d.ok) { setMsg(d.error); return; }
    setName(""); setPrice("10");
    load();
  }

  async function handleUpdate(id: string) {
    const res = await fetch(`/api/toppings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, price: Number(editPrice) })
    });
    const d = await res.json();
    if (!d.ok) { setMsg(d.error); return; }
    setEditId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("ต้องการลบ topping นี้?")) return;
    await fetch(`/api/toppings/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">🧋 จัดการ Topping</h2>
        <p className="subtle mt-1">เพิ่ม แก้ไข และลบ topping (soft delete)</p>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700">เพิ่ม Topping ใหม่</h3>
        <form onSubmit={handleCreate} className="mt-3 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ Topping" className="soft-input max-w-xs" required />
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} placeholder="ราคา" className="soft-input w-28" required />
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">เพิ่ม</button>
        </form>
        {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">รายการ Topping ({toppings.length})</h3>
        {toppings.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มี topping</p>
        ) : (
          <ul className="space-y-2">
            {toppings.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                {editId === t.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="soft-input max-w-[160px]" />
                    <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} type="number" className="soft-input w-24" />
                    <button onClick={() => handleUpdate(t.id)} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">บันทึก</button>
                    <button onClick={() => setEditId(null)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs">ยกเลิก</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <b className="text-slate-800">{t.name}</b>
                      <span className="ml-2 text-sm text-slate-500">+฿{Number(t.price).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(t.id); setEditName(t.name); setEditPrice(t.price); }} className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:border-orange-300">แก้ไข</button>
                      <button onClick={() => handleDelete(t.id)} className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50">ลบ</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
