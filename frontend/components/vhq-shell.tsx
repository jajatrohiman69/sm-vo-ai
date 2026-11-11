"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type SidebarAgent = {
  id: number;
  name: string;
  role: string;
  status: string;
};

const AGENT_AVATARS = [
  { alias: "Raka", color: "bg-indigo-500/30 border-indigo-400/40", crown: true },
  { alias: "Hendra", color: "bg-emerald-500/30 border-emerald-400/40", crown: false },
  { alias: "Nadia", color: "bg-rose-500/30 border-rose-400/40", crown: false },
  { alias: "Sari", color: "bg-purple-500/30 border-purple-400/40", crown: false },
  { alias: "Bima", color: "bg-sky-500/30 border-sky-400/40", crown: false },
  { alias: "Dinda", color: "bg-amber-500/30 border-amber-400/40", crown: false },
  { alias: "Reza", color: "bg-teal-500/30 border-teal-400/40", crown: false },
  { alias: "Tania", color: "bg-pink-500/30 border-pink-400/40", crown: false },
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
  const [agents, setAgents] = useState<SidebarAgent[]>([]);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [taskCount, setTaskCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const loadSidebarStats = async () => {
      try {
        const [agRes, prRes, tkRes] = await Promise.all([
          fetch(`${API_URL}/agents`),
          fetch(`${API_URL}/projects`),
          fetch(`${API_URL}/tasks`),
        ]);
        if (!active) return;
        if (agRes.ok) {
          const agData = await agRes.json();
          if (Array.isArray(agData)) setAgents(agData);
        }
        if (prRes.ok) {
          const prData = await prRes.json();
          if (Array.isArray(prData)) setProjectCount(prData.length);
        }
        if (tkRes.ok) {
          const tkData = await tkRes.json();
          if (Array.isArray(tkData)) setTaskCount(tkData.length);
        }
      } catch {
        // ignore
      }
    };
    void loadSidebarStats();
    const timer = setInterval(loadSidebarStats, 12000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const onlineAgentCount = agents.filter((a) => a.status !== "Offline").length;

  const navItems = [
    { href: "/", label: "Dashboard", icon: "⊞", badge: null },
    {
      href: "/projects",
      label: "Semua Proyek",
      icon: " BRIEF",
      emoji: "🧳",
      badge: projectCount > 0 ? String(projectCount) : null,
    },
    {
      href: "/agents",
      label: "Kelola Tim",
      emoji: "👥",
      badge:
        agents.length > 0 ? `${onlineAgentCount}/${agents.length}` : null,
    },
    {
      href: "/tasks",
      label: "Papan Tugas",
      emoji: "☰",
      badge: taskCount > 0 ? String(taskCount) : null,
    },
    {
      href: "/task-planner",
      label: "AI Task Planner",
      emoji: "🧠",
      badge: null,
    },
    {
      href: "/ai-chat",
      label: "AI CEO Chat",
      emoji: "💬",
      badge: null,
    },
    {
      href: "/social-hub",
      label: "Social Hub",
      emoji: "📡",
      badge: "5 API",
    },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/" || pathname === "/virtual-office";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[#0b0e1a] text-white flex flex-col md:flex-row">
      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between border-b border-white/10 bg-[#131316] px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-extrabold text-sm">
            SM
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide block">
              SolusiMacro
            </span>
            <span className="text-[10px] text-slate-400 block">
              Virtual Office · AI Team
            </span>
          </div>
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
        <div className="md:hidden border-b border-white/10 bg-[#131316] px-4 py-4 space-y-2 z-30">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#131316] text-white border border-blue-400/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span>{item.emoji || item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* DESKTOP SIDEBAR (Styled like KolegAI Virtual Office reference) */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-white/10 bg-[#131316] px-4 py-5 flex-col justify-between sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-4">
          {/* BRAND HEADER */}
          <Link href="/" className="flex items-center gap-3 px-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-extrabold text-base shadow-lg shadow-indigo-500/20">
              SM
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                SolusiMacro
              </h1>
              <p className="text-[11px] text-slate-400">
                Virtual Office · AI Team
              </p>
            </div>
          </Link>

          {/* + PROYEK BARU BUTTON */}
          <Link
            href="/projects"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition"
          >
            <span>＋</span>
            <span>Proyek Baru</span>
          </Link>

          {/* NAVIGATION */}
          <nav className="space-y-1 text-xs">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 font-medium transition ${
                    active
                      ? "bg-[#131316] text-white border border-indigo-400/25 shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-sm opacity-85">
                      {item.emoji || item.icon}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className="rounded-full bg-[#131316] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* AGENT AI LIVE ROSTER (Exact match to screenshot) */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between px-1 mb-2.5">
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                AGENT AI
              </span>
              <Link
                href="/agents"
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Kelola
              </Link>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {agents.slice(0, 6).map((agent, idx) => {
                const av = AGENT_AVATARS[idx % AGENT_AVATARS.length];
                const isOnline = agent.status !== "Offline";
                return (
                  <Link
                    key={agent.id}
                    href={`/ai-chat`}
                    className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-white/5 transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-8 w-8 shrink-0 rounded-full border ${av.color} flex items-center justify-center text-xs font-bold text-white`}
                      >
                        {av.alias[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                          <span>{av.alias}</span>
                          {av.crown && <span title="AI CEO">👑</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[92px]">
                          {agent.role}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${
                        isOnline
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Online</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM MODEL & FOUNDER BAR */}
        <div className="pt-3 border-t border-white/10 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate font-mono text-[11px]">
                claude-opus-5-5
              </span>
            </div>
            <span className="rounded bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              5-Model
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#131316] px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                👤 Founder · CEO
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-red-500/20 hover:text-red-200 transition"
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
