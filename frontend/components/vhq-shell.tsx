"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: "🏠" },
  { href: "/agents", label: "AI Agents", icon: "🤖" },
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/tasks", label: "Tasks", icon: "📋" },
  { href: "/task-planner", label: "AI CEO Task Planner", icon: "🧠" },
  { href: "/ai-chat", label: "AI CEO Chat", icon: "💬" },
  { href: "/social-hub", label: "Social Hub", icon: "📡" },
];

export default function VhqShell({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-white flex flex-col md:flex-row">
      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between border-b border-white/10 bg-[#0d1428] px-4 py-3 sticky top-0 z-40">
        <div>
          <span className="text-base font-bold tracking-wide">
            SOLUSI <span className="text-blue-400">MACRO</span>
          </span>
          <span className="ml-2 rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
            VIRTUAL HQ
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          {mobileMenuOpen ? "✕ Tutup" : "☰ Menu"}
        </button>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-[#0d1428] px-4 py-4 space-y-2 z-30">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              <span className="text-green-400">●</span> Sesi Founder Aktif
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
            >
              Keluar
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-white/10 bg-[#0d1428]/90 p-6 flex-col justify-between sticky top-0 h-screen">
        <div>
          <Link href="/" className="block">
            <h1 className="text-xl font-bold tracking-wide">
              SOLUSI <span className="text-blue-400">MACRO</span>
            </h1>
            <p className="text-[11px] font-semibold tracking-widest text-slate-500 mt-1">
              VIRTUAL HQ · v0.8
            </p>
          </Link>

          <nav className="mt-10 space-y-1.5 text-sm">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 font-medium transition ${
                    active
                      ? "bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 border-t border-white/10 pt-5">
          <div className="rounded-xl bg-[#151d32] border border-white/10 p-3.5">
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              AI Engine
            </p>
            <p className="text-xs font-semibold text-slate-200 mt-1">
              Claude Sonnet 5.5
            </p>
            <p className="text-[11px] text-green-400 mt-0.5">
              ● OCTA Connected
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#11182b] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                👤 Founder
              </p>
              <p className="text-[10px] text-slate-400">Executive Access</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-red-500/20 hover:border-red-400/30 hover:text-red-200 transition"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT */}
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
