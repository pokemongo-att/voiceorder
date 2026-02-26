import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { NavBar } from "./NavBar";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Voice Order",
  description: "Voice order for beverage shop (Android)"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="th">
      <body className={sarabun.className}>
        <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-8 pt-6 sm:px-6">
          <header className="card mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-300 via-amber-200 to-sky-200 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">Beverage Staff Panel</p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900">🥤 Voice Order</h1>
                </div>
                <NavBar role={session?.role || null} username={session?.username || null} />
              </div>
            </div>
          </header>
          <main>{children}</main>
          <footer className="mt-8 text-center text-xs text-slate-500">Voice Order • Next.js + Neon + Drizzle</footer>
        </div>
      </body>
    </html>
  );
}
