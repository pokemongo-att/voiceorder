"use client";

import { useEffect, useState } from "react";

type Staff = { id: string; name: string; role: string; isActive: boolean };

export default function AdminStaffsPage() {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/staffs");
    const d = await res.json();
    if (d.ok) setStaffs(d.staffs);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/staffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role })
    });
    const d = await res.json();
    if (!d.ok) { setMsg(d.error); return; }
    setName(""); setRole("staff");
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/staffs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current })
    });
    load();
  }

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">👤 จัดการพนักงาน</h2>
        <p className="subtle mt-1">เพิ่ม แก้ไข และปิดการใช้งานพนักงาน</p>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700">เพิ่มพนักงานใหม่</h3>
        <form onSubmit={handleCreate} className="mt-3 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อพนักงาน" className="soft-input max-w-xs" required />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">เพิ่ม</button>
        </form>
        {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">รายชื่อพนักงาน ({staffs.length})</h3>
        {staffs.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีพนักงาน</p>
        ) : (
          <ul className="space-y-2">
            {staffs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div>
                  <b className="text-slate-800">{s.name}</b>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${s.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>{s.role}</span>
                </div>
                <button
                  onClick={() => toggleActive(s.id, s.isActive)}
                  className={`rounded-lg border px-3 py-1 text-xs ${s.isActive ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                >
                  {s.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
