import Link from "next/link";

export default function AdminDashboard() {
  const links = [
    { href: "/admin/products", label: "จัดการสินค้า", icon: "📦", desc: "เพิ่ม/แก้ไข/ลบสินค้าและราคา" },
    { href: "/admin/staffs", label: "จัดการพนักงาน", icon: "👤", desc: "เพิ่ม/แก้ไข/ปิดการใช้งานพนักงาน" },
    { href: "/admin/reports", label: "รายงานยอดขาย", icon: "📊", desc: "ดูยอดขายรายวัน สินค้าขายดี" },
    { href: "/admin/shop", label: "เปิด/ปิดร้าน", icon: "🏪", desc: "จัดการเปิด-ปิดร้านและสรุปยอด" },
  ];

  return (
    <main className="grid gap-4">
      <section className="card p-5">
        <h2 className="card-title">Admin Dashboard</h2>
        <p className="subtle mt-1">จัดการระบบทั้งหมดจากที่เดียว</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-start gap-4 p-5 transition hover:border-orange-300">
            <span className="text-3xl">{l.icon}</span>
            <div>
              <h3 className="font-semibold text-slate-900">{l.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{l.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
