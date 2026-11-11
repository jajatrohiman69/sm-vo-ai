"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

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

const agentIcons: Record<string, string> = {
  "AI CEO": "👔",
  Secretary: "📋",
  "Business Analyst": "📊",
  "Excel Engineer": "📈",
  "Automation Engineer": "⚙️",
  "Dashboard Analyst": "📉",
  "QA & Documentation": "📝",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusColor(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return "text-green-400 bg-green-400/10";
    case "in progress":
      return "text-blue-400 bg-blue-400/10";
    case "pending":
      return "text-yellow-400 bg-yellow-400/10";
    case "planning":
      return "text-purple-400 bg-purple-400/10";
    case "cancelled":
      return "text-red-400 bg-red-400/10";
    default:
      return "text-slate-400 bg-white/5";
  }
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("Checking...");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // ========================================
  // FETCH ALL DASHBOARD DATA
  // ========================================

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setDataError("");

        const [
          healthResponse,
          agentsResponse,
          projectsResponse,
          tasksResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/health`),
          fetch(`${API_URL}/agents`),
          fetch(`${API_URL}/projects`),
          fetch(`${API_URL}/tasks`),
        ]);

        if (
          !healthResponse.ok ||
          !agentsResponse.ok ||
          !projectsResponse.ok ||
          !tasksResponse.ok
        ) {
          throw new Error("One or more API requests failed.");
        }

        const [health, agentsData, projectsData, tasksData] = await Promise.all(
          [
            healthResponse.json(),
            agentsResponse.json(),
            projectsResponse.json(),
            tasksResponse.json(),
          ],
        );

        if (!mounted) return;

        setBackendStatus(health.status === "healthy" ? "Online" : "Error");

        setAgents(agentsData);
        setProjects(projectsData);
        setTasks(tasksData);
      } catch (error) {
        console.error("Dashboard API error:", error);

        if (!mounted) return;

        setBackendStatus("Offline");
        setDataError(
          "Unable to load dashboard data. Please check your backend.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      mounted = false;
    };
  }, []);

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  const activeProjects = projects.filter(
    (project) =>
      !["completed", "cancelled"].includes(project.status.toLowerCase()),
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status.toLowerCase() === "pending",
  ).length;

  const completedTasks = tasks.filter(
    (task) => task.status.toLowerCase() === "completed",
  ).length;

  const statistics = [
    {
      label: "AI Agents",
      value: agents.length,
      description: "Registered agents",
      icon: "🤖",
    },
    {
      label: "Active Projects",
      value: activeProjects,
      description: "Ongoing projects",
      icon: "📁",
    },
    {
      label: "Pending Tasks",
      value: pendingTasks,
      description: "Tasks awaiting action",
      icon: "📋",
    },
    {
      label: "Completed Tasks",
      value: completedTasks,
      description: "Successfully completed",
      icon: "✅",
    },
  ];

  // ========================================
  // RENDER
  // ========================================

  return (
    <main className="min-h-screen bg-[#0b1020] text-white flex">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-white/10 p-6 hidden md:block shrink-0">
        <h1 className="text-xl font-bold">
          SOLUSI <span className="text-blue-400">MACRO</span>
        </h1>

        <p className="text-xs text-slate-500 mt-1">VIRTUAL HQ</p>

        <nav className="mt-12 space-y-3 text-sm">
          <Link
            href="/"
            className="block bg-blue-500/20 text-blue-300 rounded-lg p-3"
          >
            🏠 Overview
          </Link>

          <div className="p-3 text-slate-400">🤖 AI Agents</div>

          <Link
            href="/projects"
            className="block p-3 text-slate-400 hover:text-white"
          >
            📁 Projects
          </Link>

          <Link
            href="/tasks"
            className="block p-3 text-slate-400 hover:text-white"
          >
            📋 Tasks
          </Link>
          <Link
            href="/agents"
            className="block p-3 text-slate-400 hover:text-white"
          >
            🤖 AI Agents
          </Link>

          <div className="p-3 text-slate-400">💬 AI CEO Chat</div>
          <Link
            href="/task-planner"
            className="block p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            🧠 AI CEO Task Planner
          </Link>
          <div className="p-3 text-slate-400">⚙️ Settings</div>
        </nav>

        <div className="absolute bottom-6 text-xs text-slate-500">
          Internal Management System
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <section className="flex-1 min-w-0 p-6 md:p-10">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10">
          <div>
            <p className="text-sm text-slate-400">SOLUSI MACRO / OVERVIEW</p>

            <h2 className="text-3xl font-bold mt-2">Virtual Office</h2>

            <p className="text-slate-400 mt-2">
              Welcome to your AI-powered workspace.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 px-4 py-3 text-sm">
            {backendStatus === "Checking..."
              ? "🟡"
              : backendStatus === "Online"
                ? "🟢"
                : "🔴"}{" "}
            Backend {backendStatus}
          </div>
        </header>

        {/* ERROR MESSAGE */}
        {dataError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {dataError}
          </div>
        )}

        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
          {statistics.map((stat) => (
            <div
              key={stat.label}
              className="bg-[#151d32] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <span className="text-xl">{stat.icon}</span>
              </div>

              <h3 className="text-3xl font-bold mt-3">
                {loading ? "..." : stat.value}
              </h3>

              <p className="text-xs text-slate-500 mt-2">{stat.description}</p>
            </div>
          ))}
        </div>

        <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#151d32]">
          <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest text-blue-300">
                LIVE WORKSPACE
              </p>
              <h3 className="mt-1 text-xl font-bold">Virtual Office</h3>
              <p className="mt-1 text-sm text-slate-400">
                Agent yang sedang mengerjakan task akan tampil aktif di mejanya.
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
                      <p className="mt-2 line-clamp-2 text-[10px] text-slate-500">
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
          <div className="xl:col-span-2 bg-[#151d32] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">AI Team Directory</h3>

              <span className="text-xs text-slate-500">
                {agents.length} Registered
              </span>
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
                    className="border border-white/10 rounded-xl p-4 hover:border-blue-400/40 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">
                        {agentIcons[agent.name] ?? "🤖"}
                      </span>

                      <span
                        className={`text-xs ${
                          agent.status === "Online"
                            ? "text-green-400"
                            : "text-slate-500"
                        }`}
                      >
                        ● {agent.status}
                      </span>
                    </div>

                    <h4 className="font-semibold mt-4">{agent.name}</h4>

                    <p className="text-xs text-slate-400 mt-1">{agent.role}</p>

                    <p className="text-xs text-slate-500 mt-2">
                      {agent.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CEO COMMAND CENTER */}
          <div className="bg-[#151d32] border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-lg">CEO Command Center</h3>

            <div className="mt-6 rounded-xl bg-blue-500/10 border border-blue-400/20 p-4">
              <p className="text-sm text-blue-300 font-medium">👔 AI CEO</p>

              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                Welcome, Founder. Your virtual office is ready. Awaiting your
                first instruction.
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-3">SYSTEM STATUS</p>

              <div className="text-sm text-green-400">
                ● Frontend operational
              </div>

              <div
                className={`text-sm mt-2 ${
                  backendStatus === "Online"
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}
              >
                ● Backend {backendStatus}
              </div>

              <div
                className={`text-sm mt-2 ${
                  backendStatus === "Online"
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}
              >
                ● Database{" "}
                {backendStatus === "Online" ? "Connected" : "Checking"}
              </div>

              <div className="text-sm text-yellow-400 mt-2">
                ● AI integration pending
              </div>
            </div>
          </div>
        </div>

        {/* PROJECTS AND TASKS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          {/* RECENT PROJECTS */}
          <div className="bg-[#151d32] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">📁 Recent Projects</h3>

              <span className="text-xs text-slate-500">
                {projects.length} Total
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No projects yet. Your projects will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="border border-white/10 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm">{project.name}</h4>

                        <p className="text-xs text-slate-500 mt-2">
                          {project.description || "No description"}
                        </p>

                        <p className="text-xs text-slate-600 mt-2">
                          Created: {formatDate(project.created_at)}
                        </p>
                      </div>

                      <span
                        className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap ${statusColor(project.status)}`}
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
          <div className="bg-[#151d32] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">📋 Recent Tasks</h3>

              <span className="text-xs text-slate-500">
                {tasks.length} Total
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No tasks yet. Your tasks will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="border border-white/10 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm">{task.title}</h4>

                        <p className="text-xs text-slate-500 mt-2">
                          Assigned to:{" "}
                          {typeof task.assigned_agent === "object" &&
                          task.assigned_agent !== null
                            ? task.assigned_agent.name
                            : task.assigned_agent || "Unassigned"}
                        </p>

                        <p className="text-xs text-slate-600 mt-2">
                          Priority: {task.priority}
                        </p>
                      </div>

                      <span
                        className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap ${statusColor(task.status)}`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="mt-10 text-xs text-slate-600">
          SOLUSI MACRO VIRTUAL HQ · MVP VERSION 0.2
        </footer>
      </section>
    </main>
  );
}
