"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import VirtualOffice3D from "@/components/virtual-office-3d";

type Agent = {
  id: number;
  name: string;
  role: string;
  department: string;
  status: string;
  description: string;
};

type Project = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_agent_id: number | null;
  assigned_agent: Agent | string | null;
  created_at: string;
};

type ActivityLog = {
  id: number;
  action: string;
  details: string | null;
  created_at: string;
};

type AIStatus = {
  provider: string;
  status: string;
};

type SocialAccountSummary = {
  platform: string;
  label: string;
  status: string;
  account_name: string;
};

type SocialPostSummary = {
  id: number;
  title: string;
  status: string;
  scheduled_at: string | null;
  platforms: string[];
};

const agentIcons: Record<string, string> = {
  "AI CEO": "👔",
  Secretary: "📋",
  "Business Analyst": "📊",
  "Excel Engineer": "📈",
  "Automation Engineer": "⚙️",
  "Dashboard Analyst": "📉",
  "QA & Documentation": "📝",
  "Social Media Specialist": "📡",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return "text-green-400 bg-green-400/10";
    case "in progress":
      return "text-blue-400 bg-blue-400/10";
    case "review":
      return "text-purple-400 bg-purple-400/10";
    case "pending":
      return "text-yellow-400 bg-yellow-400/10";
    case "planning":
      return "text-purple-400 bg-purple-400/10";
    case "failed":
    case "cancelled":
      return "text-red-400 bg-red-400/10";
    default:
      return "text-slate-400 bg-white/5";
  }
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiTestResult, setAiTestResult] = useState("");
  const [testingAi, setTestingAi] = useState(false);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountSummary[]>(
    [],
  );
  const [socialPosts, setSocialPosts] = useState<SocialPostSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [viewMode, setViewMode] = useState<"office" | "classic">("office");

  const fetchDashboardData = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      setDataError("");

      const [
        healthResponse,
        agentsResponse,
        projectsResponse,
        tasksResponse,
        logsResponse,
        aiStatusResponse,
        socialAccResponse,
        socialPostsResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/health`),
        fetch(`${API_URL}/agents`),
        fetch(`${API_URL}/projects`),
        fetch(`${API_URL}/tasks`),
        fetch(`${API_URL}/activity-logs?limit=15`),
        fetch(`${API_URL}/ai/status`),
        fetch(`${API_URL}/social/accounts`),
        fetch(`${API_URL}/social/posts`),
      ]);

      if (
        !healthResponse.ok ||
        !agentsResponse.ok ||
        !projectsResponse.ok ||
        !tasksResponse.ok
      ) {
        throw new Error("One or more API requests failed.");
      }

      const [health, agentsData, projectsData, tasksData] = await Promise.all([
        healthResponse.json(),
        agentsResponse.json(),
        projectsResponse.json(),
        tasksResponse.json(),
      ]);

      const logsData = logsResponse.ok ? await logsResponse.json() : [];
      const aiData = aiStatusResponse.ok ? await aiStatusResponse.json() : null;
      const socialAccData = socialAccResponse.ok
        ? await socialAccResponse.json()
        : [];
      const socialPostsData = socialPostsResponse.ok
        ? await socialPostsResponse.json()
        : [];

      setBackendStatus(health.status === "healthy" ? "Online" : "Error");
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setActivityLogs(Array.isArray(logsData) ? logsData : []);
      setAiStatus(aiData);
      setSocialAccounts(Array.isArray(socialAccData) ? socialAccData : []);
      setSocialPosts(Array.isArray(socialPostsData) ? socialPostsData : []);
    } catch (error) {
      console.error("Dashboard API error:", error);
      setBackendStatus("Offline");
      setDataError("Tidak dapat memuat data dashboard. Periksa koneksi backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = () => {
      Promise.all([
        fetch(`${API_URL}/health`),
        fetch(`${API_URL}/agents`),
        fetch(`${API_URL}/projects`),
        fetch(`${API_URL}/tasks`),
        fetch(`${API_URL}/activity-logs?limit=15`),
        fetch(`${API_URL}/ai/status`),
        fetch(`${API_URL}/social/accounts`),
        fetch(`${API_URL}/social/posts`),
      ])
        .then(
          async ([
            healthResponse,
            agentsResponse,
            projectsResponse,
            tasksResponse,
            logsResponse,
            aiStatusResponse,
            socialAccResponse,
            socialPostsResponse,
          ]) => {
            if (
              !healthResponse.ok ||
              !agentsResponse.ok ||
              !projectsResponse.ok ||
              !tasksResponse.ok
            ) {
              throw new Error("One or more API requests failed.");
            }

            const [health, agentsData, projectsData, tasksData] =
              await Promise.all([
                healthResponse.json(),
                agentsResponse.json(),
                projectsResponse.json(),
                tasksResponse.json(),
              ]);

            const logsData = logsResponse.ok ? await logsResponse.json() : [];
            const aiData = aiStatusResponse.ok
              ? await aiStatusResponse.json()
              : null;
            const socialAccData = socialAccResponse.ok
              ? await socialAccResponse.json()
              : [];
            const socialPostsData = socialPostsResponse.ok
              ? await socialPostsResponse.json()
              : [];

            if (!active) return;

            setDataError("");
            setBackendStatus(health.status === "healthy" ? "Online" : "Error");
            setAgents(Array.isArray(agentsData) ? agentsData : []);
            setProjects(Array.isArray(projectsData) ? projectsData : []);
            setTasks(Array.isArray(tasksData) ? tasksData : []);
            setActivityLogs(Array.isArray(logsData) ? logsData : []);
            setAiStatus(aiData);
            setSocialAccounts(
              Array.isArray(socialAccData) ? socialAccData : [],
            );
            setSocialPosts(
              Array.isArray(socialPostsData) ? socialPostsData : [],
            );
          },
        )
        .catch(() => {
          if (!active) return;
          setBackendStatus("Offline");
          setDataError(
            "Tidak dapat memuat data dashboard. Periksa koneksi backend.",
          );
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            timeout = setTimeout(poll, 8000);
          }
        });
    };

    poll();

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  async function handleTestAi() {
    try {
      setTestingAi(true);
      setAiTestResult("");
      const response = await fetch(`${API_URL}/ai/test`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Koneksi AI gagal.");
      }
      setAiTestResult(data.response || "AI CEO Online.");
    } catch (err) {
      setAiTestResult(
        err instanceof Error ? `Gagal: ${err.message}` : "Gagal menguji AI.",
      );
    } finally {
      setTestingAi(false);
    }
  }

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  const activeProjects = projects.filter(
    (project) =>
      !["completed", "cancelled"].includes(project.status.toLowerCase()),
  ).length;

  const pendingOrActiveTasks = tasks.filter((task) =>
    ["pending", "in progress"].includes(task.status.toLowerCase()),
  ).length;

  const reviewTasks = tasks.filter(
    (task) => task.status.toLowerCase() === "review",
  ).length;

  const completedTasks = tasks.filter(
    (task) => task.status.toLowerCase() === "completed",
  ).length;

  const statistics = [
    {
      label: "AI Agents",
      value: agents.length,
      description: "Registered specialists",
      icon: "🤖",
      href: "/agents",
    },
    {
      label: "Active Projects",
      value: activeProjects,
      description: "Ongoing initiatives",
      icon: "📁",
      href: "/projects",
    },
    {
      label: "Awaiting Review",
      value: reviewTasks,
      description: `${pendingOrActiveTasks} pending / in progress`,
      icon: "🟣",
      href: "/tasks",
    },
    {
      label: "Completed Tasks",
      value: completedTasks,
      description: "Approved by Founder",
      icon: "✅",
      href: "/tasks",
    },
  ];

  if (viewMode === "office") {
    return (
      <VirtualOffice3D
        onOpenClassicDashboard={() => setViewMode("classic")}
      />
    );
  }

  return (
    <section className="flex-1 min-w-0 p-6 md:p-10">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-400">
            SOLUSI MACRO / OVERVIEW
          </p>

          <h2 className="text-3xl font-bold mt-2">Virtual Office</h2>

          <p className="text-slate-400 mt-2 text-sm">
            Pusat komando AI Agents, proyek, dan eksekusi operasional Solusi
            Macro.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode("office")}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-xs font-bold text-white shadow-lg transition"
          >
            🏢 Buka Virtual Office 3D
          </button>
          <button
            type="button"
            onClick={() => void fetchDashboardData(true)}
            className="rounded-xl border border-white/10 bg-[#131316] px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
          >
            ↻ Refresh
          </button>

          <div className="rounded-xl border border-white/10 bg-[#131316] px-4 py-3 text-xs font-medium">
            {backendStatus === "Checking..."
              ? "🟡"
              : backendStatus === "Online"
                ? "🟢"
                : "🔴"}{" "}
            Backend {backendStatus}
          </div>
        </div>
      </header>

      {/* ERROR MESSAGE */}
      {dataError && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {dataError}
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statistics.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-[#131316] border border-white/10 hover:border-blue-400/40 rounded-2xl p-5 transition block"
          >
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <span className="text-xl">{stat.icon}</span>
            </div>

            <h3 className="text-3xl font-bold mt-3">
              {loading ? "..." : stat.value}
            </h3>

            <p className="text-xs text-slate-500 mt-2">{stat.description}</p>
          </Link>
        ))}
      </div>

      {/* LIVE WORKSPACE */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#131316]">
        <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-300">
              LIVE WORKSPACE
            </p>
            <h3 className="mt-1 text-xl font-bold">Virtual Office Floor</h3>
            <p className="mt-1 text-sm text-slate-400">
              Agent yang sedang mengerjakan task tampil aktif di mejanya secara
              real-time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>🟢 Working</span>
            <span>🟣 Review</span>
            <span>⚪ Standby</span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-400">
            Memuat status Virtual Office...
          </div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-sm text-slate-400">
            Belum ada agent di kantor.
          </div>
        ) : (
          <div className="office-floor grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {agents.map((agent) => {
              const activeTask = tasks.find(
                (task) =>
                  task.assigned_agent_id === agent.id &&
                  task.status === "In Progress",
              );
              const reviewTask = tasks.find(
                (task) =>
                  task.assigned_agent_id === agent.id &&
                  task.status === "Review",
              );
              const workStatus = activeTask
                ? "Working"
                : reviewTask
                  ? "Review"
                  : agent.status === "Offline"
                    ? "Offline"
                    : "Standby";
              const workerClass =
                workStatus === "Working"
                  ? "office-worker--working"
                  : workStatus === "Review"
                    ? "office-worker--review"
                    : "";

              return (
                <article
                  key={agent.id}
                  className="office-desk flex min-h-36 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#111a2b]/90 p-3 text-center"
                >
                  <div className={`office-worker ${workerClass}`}>
                    <span className="office-person" aria-hidden="true">
                      {agentIcons[agent.name] ?? "👩‍💻"}
                    </span>
                    <span className="office-laptop" aria-hidden="true">
                      💻
                    </span>
                  </div>
                  <h4 className="mt-2 max-w-full truncate text-xs font-semibold">
                    {agent.name}
                  </h4>
                  <span
                    className={`mt-1 rounded-full px-2 py-0.5 text-[10px] ${
                      workStatus === "Working"
                        ? "bg-green-400/10 text-green-300"
                        : workStatus === "Review"
                          ? "bg-purple-400/10 text-purple-300"
                          : workStatus === "Offline"
                            ? "bg-red-400/10 text-red-300"
                            : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {workStatus}
                  </span>
                  {(activeTask || reviewTask) && (
                    <p className="mt-2 line-clamp-2 text-[10px] text-slate-400">
                      {(activeTask || reviewTask)?.title}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* MAIN DASHBOARD GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* AI TEAM DIRECTORY */}
        <div className="xl:col-span-2 bg-[#131316] border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-lg">AI Team Directory</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Specialist Agents siap menerima delegasi tugas
              </p>
            </div>

            <Link
              href="/agents"
              className="text-xs text-blue-300 hover:text-white transition"
            >
              Kelola Agents ({agents.length}) →
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              Loading AI Agents...
            </div>
          ) : agents.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              No AI agents registered yet.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="border border-white/10 rounded-xl p-4 hover:border-blue-400/40 transition bg-[#131316]/60"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-2xl">
                      {agentIcons[agent.name] ?? "🤖"}
                    </span>

                    <span
                      className={`text-xs ${
                        agent.status === "Online"
                          ? "text-green-400"
                          : agent.status === "Offline"
                            ? "text-red-400"
                            : "text-slate-400"
                      }`}
                    >
                      ● {agent.status}
                    </span>
                  </div>

                  <h4 className="font-semibold mt-3">{agent.name}</h4>

                  <p className="text-xs text-blue-300/80 mt-0.5">
                    {agent.role} · {agent.department}
                  </p>

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {agent.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CEO COMMAND CENTER */}
        <div className="bg-[#131316] border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-lg">CEO Command Center</h3>

            <div className="mt-5 rounded-xl bg-blue-500/10 border border-blue-400/20 p-4">
              <p className="text-sm text-blue-300 font-medium">👔 AI CEO</p>

              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Selamat datang, Founder. Virtual Office siap menjalankan
                perencanaan proyek dan eksekusi tugas bersama Specialist Agents.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/ai-chat"
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-center text-xs font-semibold text-white transition"
                >
                  💬 Chat AI CEO
                </Link>
                <Link
                  href="/task-planner"
                  className="rounded-lg border border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 text-center text-xs font-semibold text-blue-200 transition"
                >
                  🧠 Buat Task Plan
                </Link>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold tracking-wider text-slate-500 mb-3">
                SYSTEM & AI STATUS
              </p>

              <div className="space-y-2 text-sm">
                <div className="text-green-400">● Frontend operational</div>

                <div
                  className={
                    backendStatus === "Online"
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                >
                  ● Backend {backendStatus}
                </div>

                <div
                  className={
                    backendStatus === "Online"
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                >
                  ● Database{" "}
                  {backendStatus === "Online" ? "Connected (SQLite)" : "Checking"}
                </div>

                <div
                  className={
                    aiStatus?.status === "configured"
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                >
                  ● AI Engine:{" "}
                  {aiStatus?.provider
                    ? `${aiStatus.provider} (${aiStatus.status})`
                    : "Configured"}
                </div>
              </div>

              {aiTestResult && (
                <div className="mt-3 rounded-lg border border-white/10 bg-[#09090b] p-3 text-xs text-slate-300">
                  {aiTestResult}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestAi}
            disabled={testingAi}
            className="mt-5 w-full rounded-xl border border-white/10 bg-[#09090b] hover:bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-300 disabled:opacity-50 transition"
          >
            {testingAi ? "Menguji koneksi AI..." : "⚡ Test AI Connection"}
          </button>
        </div>
      </div>

      {/* PROJECTS, TASKS, AND LIVE ACTIVITY LOG */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* RECENT PROJECTS */}
        <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">📁 Recent Projects</h3>

            <Link
              href="/projects"
              className="text-xs text-blue-300 hover:text-white transition"
            >
              Semua ({projects.length}) →
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Belum ada project. Buat project pertama Anda di menu Projects.
            </p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="border border-white/10 rounded-xl p-4 bg-[#131316]/50"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm">{project.name}</h4>

                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                        {project.description || "Tidak ada deskripsi"}
                      </p>

                      <p className="text-[11px] text-slate-500 mt-2">
                        Dibuat: {formatDate(project.created_at)}
                      </p>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap ${statusColor(project.status)}`}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECENT TASKS */}
        <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">📋 Recent Tasks</h3>

            <Link
              href="/tasks"
              className="text-xs text-blue-300 hover:text-white transition"
            >
              Semua ({tasks.length}) →
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Belum ada task. Buat task atau gunakan Task Planner.
            </p>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="border border-white/10 rounded-xl p-4 bg-[#131316]/50"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm">{task.title}</h4>

                      <p className="text-xs text-slate-400 mt-1.5">
                        Agent:{" "}
                        {typeof task.assigned_agent === "object" &&
                        task.assigned_agent !== null
                          ? task.assigned_agent.name
                          : task.assigned_agent || "Unassigned"}
                      </p>

                      <p className="text-[11px] text-slate-500 mt-1">
                        Priority: {task.priority}
                      </p>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap ${statusColor(task.status)}`}
                    >
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LIVE ACTIVITY LOGS */}
        <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg">⚡ Live Activity Log</h3>
            <span className="text-xs text-slate-500">
              {activityLogs.length} terbaru
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Memuat riwayat aktivitas...</p>
          ) : activityLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Belum ada aktivitas tercatat.
            </p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-white/10 rounded-xl p-3.5 bg-[#131316]/50"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-semibold text-blue-300">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-slate-300 mt-1.5 whitespace-pre-wrap line-clamp-3">
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* OMNICHANNEL SOCIAL HUB SUMMARY */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#131316] p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-widest text-purple-300">
                OMNICHANNEL SOCIAL HUB
              </span>
              <span className="rounded-full bg-purple-500/15 border border-purple-400/30 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                Direct API & Auto-Scheduler
              </span>
            </div>
            <h3 className="text-lg font-bold mt-1">
              📡 Status Sosmed & Jadwal Konten Otomatis
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/social-hub"
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition"
            >
              📡 Buka Social Hub →
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {socialAccounts.map((acc) => {
            const connected = acc.status === "Connected";
            return (
              <Link
                key={acc.platform}
                href="/social-hub"
                className={`rounded-xl border p-3 transition block ${
                  connected
                    ? "border-emerald-400/30 bg-emerald-500/10"
                    : "border-white/10 bg-[#131316]/60 hover:border-blue-400/30"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{acc.label}</span>
                  <span
                    className={
                      connected ? "text-emerald-300" : "text-slate-500"
                    }
                  >
                    {connected ? "🟢" : "⚪"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  {acc.account_name || acc.status}
                </p>
              </Link>
            );
          })}
        </div>

        {socialPosts.filter((p) => p.status === "Scheduled").length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs font-semibold text-purple-200 mb-2">
              ⏰ Postingan Terjadwal Berikutnya:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {socialPosts
                .filter((p) => p.status === "Scheduled")
                .slice(0, 3)
                .map((post) => (
                  <Link
                    key={post.id}
                    href="/social-hub"
                    className="rounded-xl border border-purple-400/25 bg-purple-500/10 p-3 hover:bg-purple-500/15 transition block"
                  >
                    <p className="text-xs font-semibold text-white line-clamp-1">
                      {post.title}
                    </p>
                    <p className="text-[11px] text-purple-200 mt-1">
                      ⏰{" "}
                      {post.scheduled_at
                        ? formatDateTime(post.scheduled_at)
                        : "Terjadwal"}
                    </p>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="mt-10 text-xs text-slate-600">
        SOLUSI MACRO VIRTUAL HQ · COMMAND CENTER v0.8
      </footer>
    </section>
  );
}
