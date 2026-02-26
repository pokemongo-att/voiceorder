"use client";

import { useRouter } from "next/navigation";

export function NavBar({ role, username }: { role: string | null; username: string | null }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href="/" className="pill-link">รับออเดอร์</a>
      <a href="/orders" className="pill-link">รายการออเดอร์</a>
      {role === "admin" && (
        <a href="/admin" className="pill-link">Admin</a>
      )}
      {username ? (
        <button onClick={handleLogout} className="pill-link cursor-pointer">
          ออกจากระบบ ({username})
        </button>
      ) : (
        <a href="/login" className="pill-link">เข้าสู่ระบบ</a>
      )}
    </div>
  );
}
