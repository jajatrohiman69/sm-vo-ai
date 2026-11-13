"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import MarkdownDeliverable from "@/components/markdown-deliverable";
import { useWorkspaceBranding } from "@/components/branding-runtime";

type Agent = {
  id: number;
  name: string;
  role?: string;
  status?: string;
};

type Project = {
  id: number;
  name: string;
};

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_agent_id: number | null;
  assigned_agent: Agent | string | null;
  project_id?: number | null;
  project?: Project | string | null;
  result?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  attempt_count?: number;
};

type TaskForm = {
  title: string;
  description: string;
  priority: string;
  assigned_agent_id: string;
  project_id: string;
  auto_execute: boolean;
};

const INITIAL_FORM: TaskForm = {
  title: "",
  description: "",
  priority: "Normal",
  assigned_agent_id: "",
  project_id: "",
  auto_execute: true,
};

function getAgentName(agent: Task["assigned_agent"]) {
  if (!agent) return "Unassigned";
  if (typeof agent === "string") return agent;
  return agent.name || "Unassigned";
}

function getProjectName(project: Task["project"]) {
  if (!project) return "No project";
  if (typeof project === "string") return project;
  return project.name || "No project";
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string) {
  switch (status?.toLowerCase()) {
    case "pending":
      return "bg-yellow-400/10 text-yellow-300 border border-yellow-400/20";
    case "in progress":
      return "bg-blue-400/10 text-blue-300 border border-blue-400/20";
    case "review":
      return "bg-purple-400/10 text-purple-300 border border-purple-400/20";
    case "completed":
      return "bg-green-400/10 text-green-300 border border-green-400/20";
    case "failed":
      return "bg-red-400/10 text-red-300 border border-red-400/20";
    default:
      return "bg-white/5 text-slate-300 border border-white/10";
  }
}

function priorityClass(priority: string) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "bg-red-500/15 text-red-300";
    case "high":
      return "bg-orange-500/15 text-orange-300";
    case "low":
      return "bg-slate-500/15 text-slate-400";
    default:
      return "bg-blue-500/15 text-blue-300";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAgent(value: unknown): value is Agent {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string"
  );
}

function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string"
  );
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.priority === "string"
  );
}

async function fetchTaskData(): Promise<{
  tasks: Task[];
  agents: Agent[];
  projects: Project[];
}> {
  const [tasksResponse, agentsResponse, projectsResponse] = await Promise.all([
    fetch(`${API_URL}/tasks`),
    fetch(`${API_URL}/agents`),
    fetch(`${API_URL}/projects`),
  ]);

  if (!tasksResponse.ok || !agentsResponse.ok || !projectsResponse.ok) {
    throw new Error("Gagal mengambil data dari backend.");
  }

  const [tasksData, agentsData, projectsData] = await Promise.all([
    tasksResponse.json(),
    agentsResponse.json(),
    projectsResponse.json(),
  ]);

  return {
    tasks: Array.isArray(tasksData) ? tasksData.filter(isTask) : [],
    agents: Array.isArray(agentsData) ? agentsData.filter(isAgent) : [],
    projects: Array.isArray(projectsData) ? projectsData.filter(isProject) : [],
  };
}

export default function TasksPage() {
  const branding = useWorkspaceBranding();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [executingId, setExecutingId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");

  // Founder approval state
  const [approvalTaskId, setApprovalTaskId] = useState<number | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState("");

  // Founder revision state
  const [revisionTaskId, setRevisionTaskId] = useState<number | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState<TaskForm>(INITIAL_FORM);

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const data = await fetchTaskData();
      setTasks(data.tasks);
      setAgents(data.agents);
      setProjects(data.projects);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tidak dapat terhubung ke backend.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = () => {
      fetchTaskData()
        .then((data) => {
          if (active) {
            setTasks(data.tasks);
            setAgents(data.agents);
            setProjects(data.projects);
            setError("");
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : "Tidak dapat terhubung ke backend.",
            );
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            timeout = setTimeout(poll, 5000);
          }
        });
    };

    poll();

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  // =========================================================
  // CREATE / UPDATE TASK
  // =========================================================

  function startEditing(task: Task) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "Normal",
      assigned_agent_id: task.assigned_agent_id
        ? String(task.assigned_agent_id)
        : "",
      project_id: task.project_id ? String(task.project_id) : "",
      auto_execute: false,
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setForm(INITIAL_FORM);
  }

  async function handleSubmitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Judul task wajib diisi.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        assigned_agent_id: form.assigned_agent_id
          ? Number(form.assigned_agent_id)
          : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        ...(editingTaskId
          ? {}
          : {
              auto_execute: Boolean(
                form.auto_execute && form.assigned_agent_id,
              ),
            }),
      };

      const response = await fetch(
        editingTaskId
          ? `${API_URL}/tasks/${editingTaskId}`
          : `${API_URL}/tasks`,
        {
          method: editingTaskId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Gagal menyimpan task.",
        );
      }

      const wasEditing = Boolean(editingTaskId);
      const willAutoExecute =
        !wasEditing && form.auto_execute && Boolean(form.assigned_agent_id);

      setEditingTaskId(null);
      setForm(INITIAL_FORM);

      setMessage(
        wasEditing
          ? "Task berhasil diperbarui."
          : willAutoExecute
            ? "Task berhasil dibuat dan langsung dijalankan oleh AI Agent."
            : "Task berhasil dibuat.",
      );

      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // DELETE TASK
  // =========================================================

  async function handleDeleteTask(task: Task) {
    if (!window.confirm(`Hapus task "${task.title}"?`)) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Gagal menghapus task.");
      }

      if (editingTaskId === task.id) cancelEditing();
      setMessage(data?.message || "Task berhasil dihapus.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus task.");
    }
  }

  // =========================================================
  // EXECUTE PENDING TASK
  // =========================================================

  async function handleExecuteTask(taskId: number) {
    setExecutingId(taskId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}/execute`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Gagal menjalankan task.");
      }

      setMessage(data?.message || "Task mulai dikerjakan oleh AI Agent.");
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menjalankan task.");
    } finally {
      setExecutingId(null);
    }
  }

  async function handleExecuteAllPending() {
    if (
      !window.confirm(
        "Jalankan semua task berstatus Pending yang sudah memiliki AI Agent?",
      )
    ) {
      return;
    }

    setBulkLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/tasks/execute-pending`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Gagal menjalankan task Pending.");
      }

      setMessage(
        data?.message || "Seluruh task Pending mulai dikerjakan AI Agents.",
      );
      await loadData(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menjalankan task Pending.",
      );
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleRetryAllFailed() {
    if (!window.confirm("Jalankan ulang semua task yang berstatus Failed?")) {
      return;
    }

    setBulkLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/tasks/retry-failed`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Gagal menjalankan ulang task Failed.",
        );
      }

      setMessage(
        data?.message || "Seluruh task Failed dimasukkan kembali ke antrean.",
      );
      await loadData(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menjalankan ulang task Failed.",
      );
    } finally {
      setBulkLoading(false);
    }
  }

  // =========================================================
  // FOUNDER REVIEW & RETRY HANDLERS
  // =========================================================

  async function handleReview(
    taskId: number,
    action: "approve" | "revise",
    feedback = "",
  ) {
    if (action === "revise" && !feedback.trim()) {
      setError("Tuliskan feedback revisi terlebih dahulu.");
      return;
    }

    const confirmation =
      action === "approve"
        ? "Konfirmasi approval hasil pekerjaan AI Agent?"
        : "Kirim feedback dan minta AI Agent mengerjakan ulang?";

    if (!window.confirm(confirmation)) return;

    setReviewingId(taskId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          feedback: feedback.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Gagal memproses review task.",
        );
      }

      setMessage(
        action === "approve"
          ? "Hasil pekerjaan disetujui. Catatan Founder berhasil disimpan."
          : "Feedback terkirim. AI Agent akan mengerjakan revisi.",
      );

      setApprovalTaskId(null);
      setApprovalFeedback("");
      setRevisionTaskId(null);
      setRevisionFeedback("");

      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleRetry(taskId: number) {
    if (!window.confirm("Jalankan ulang task ini dengan AI Agent?")) return;

    setRetryingId(taskId);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}/retry`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Gagal menjalankan ulang task.");
      }

      setMessage(data.message || "Task dimasukkan kembali ke antrean.");
      await loadData(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Gagal menjalankan ulang task.",
      );
    } finally {
      setRetryingId(null);
    }
  }

  // =========================================================
  // TASK STATISTICS & FILTERING
  // =========================================================

  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((task) => task.status === "Pending").length;
  const executablePendingCount = tasks.filter(
    (task) => task.status === "Pending" && Boolean(task.assigned_agent_id),
  ).length;
  const inProgressTasks = tasks.filter(
    (task) => task.status === "In Progress",
  ).length;
  const reviewTasks = tasks.filter((task) => task.status === "Review").length;
  const completedTasks = tasks.filter(
    (task) => task.status === "Completed",
  ).length;
  const failedTasks = tasks.filter((task) => task.status === "Failed").length;

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "All" && task.status !== statusFilter) return false;
    if (
      projectFilter !== "All" &&
      String(task.project_id ?? "") !== projectFilter
    ) {
      return false;
    }
    if (
      agentFilter !== "All" &&
      String(task.assigned_agent_id ?? "") !== agentFilter
    ) {
      return false;
    }
    return true;
  });

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="flex-1 min-w-0 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* PAGE HEADER */}
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              SOLUSI MACRO / TASKS
            </p>

            <h1 className="mt-2 text-3xl font-bold">Task Management</h1>

            <p className="mt-2 text-sm text-slate-400">
              Kelola tugas, jalankan AI Specialist Agents, dan tinjau hasil
              pekerjaan secara langsung.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {executablePendingCount > 0 && (
              <button
                type="button"
                onClick={handleExecuteAllPending}
                disabled={bulkLoading}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition"
              >
                ▶ Execute All Pending ({executablePendingCount})
              </button>
            )}

            {failedTasks > 0 && (
              <button
                type="button"
                onClick={handleRetryAllFailed}
                disabled={bulkLoading}
                className="rounded-xl border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-red-300 transition"
              >
                ↻ Retry All Failed ({failedTasks})
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadData(true)}
              className="rounded-xl border border-white/10 bg-[#131316] px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {message && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* TASK STATISTICS */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Tasks", value: totalTasks, filter: "All" },
            { label: "Pending", value: pendingTasks, filter: "Pending" },
            {
              label: "In Progress",
              value: inProgressTasks,
              filter: "In Progress",
            },
            { label: "For Review", value: reviewTasks, filter: "Review" },
            { label: "Completed", value: completedTasks, filter: "Completed" },
            { label: "Failed", value: failedTasks, filter: "Failed" },
          ].map((item) => {
            const active = statusFilter === item.filter;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setStatusFilter(item.filter)}
                className={`rounded-2xl border p-5 text-left transition ${
                  active
                    ? "border-blue-400 bg-blue-500/10"
                    : "border-white/10 bg-[#131316] hover:border-white/25"
                }`}
              >
                <p className="text-xs font-medium text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-bold">{item.value}</p>
              </button>
            );
          })}
        </section>

        {/* CREATE / EDIT TASK */}
        <section className="rounded-2xl border border-white/10 bg-[#131316] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {editingTaskId
                  ? `Edit Task #${editingTaskId}`
                  : "＋ Create New Task"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Buat task dan tugaskan ke AI Specialist Agent untuk dikerjakan.
              </p>
            </div>

            {editingTaskId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitTask} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Task Title *
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="Contoh: Analisis kebutuhan dashboard penjualan UMKM"
                className="w-full rounded-xl border border-white/10 bg-[#09090b] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-400"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Description / Instruksi Detail
              </label>

              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Jelaskan detail pekerjaan, konteks bisnis, dan hasil konkret yang diharapkan..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-[#09090b] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-400"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Assign Specialist Agent
                </label>

                <select
                  value={form.assigned_agent_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      assigned_agent_id: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3 py-3 text-sm text-white outline-none focus:border-blue-400"
                >
                  <option value="">-- Unassigned --</option>

                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} {agent.role ? `(${agent.role})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Project
                </label>

                <select
                  value={form.project_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      project_id: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3 py-3 text-sm text-white outline-none focus:border-blue-400"
                >
                  <option value="">-- No project --</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Priority
                </label>

                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3 py-3 text-sm text-white outline-none focus:border-blue-400"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              {!editingTaskId ? (
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      form.auto_execute && Boolean(form.assigned_agent_id)
                    }
                    disabled={!form.assigned_agent_id}
                    onChange={(event) =>
                      setForm({ ...form, auto_execute: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-white/20 bg-[#09090b] text-blue-600"
                  />
                  <span>
                    Jalankan otomatis dengan AI Agent sekarang{" "}
                    {!form.assigned_agent_id && (
                      <span className="text-slate-500">
                        (pilih Agent terlebih dahulu)
                      </span>
                    )}
                  </span>
                </label>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                {saving
                  ? "Saving..."
                  : editingTaskId
                    ? "Save Changes"
                    : form.auto_execute && form.assigned_agent_id
                      ? "⚡ Create & Execute Task"
                      : "+ Create Task"}
              </button>
            </div>
          </form>
        </section>

        {/* TASK LIST & FILTERS */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">All Tasks</h2>
              <p className="mt-1 text-xs text-slate-400">
                Menampilkan {filteredTasks.length} dari {totalTasks} task.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#131316] px-3 py-2 text-xs text-slate-200 outline-none"
              >
                <option value="All">Semua Status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">For Review</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </select>

              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#131316] px-3 py-2 text-xs text-slate-200 outline-none"
              >
                <option value="All">Semua Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.name}
                  </option>
                ))}
              </select>

              <select
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#131316] px-3 py-2 text-xs text-slate-200 outline-none"
              >
                <option value="All">Semua Agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#131316] p-10 text-center text-sm text-slate-400">
              Loading tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#131316]/60 p-12 text-center">
              <div className="text-4xl">📋</div>
              <h3 className="mt-3 font-semibold text-white">
                Tidak ada task yang sesuai
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Buat task baru di atas atau gunakan AI CEO Task Planner untuk
                membuat rencana kerja otomatis.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => {
                const expanded = expandedTaskId === task.id;
                const reviewing = reviewingId === task.id;
                const executing = executingId === task.id;

                return (
                  <article
                    key={task.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-[#131316]"
                  >
                    <div className="p-5 md:p-6">
                      <div className="flex flex-col justify-between gap-4 md:flex-row">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              TASK #{task.id}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(task.status)}`}
                            >
                              {task.status}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClass(task.priority)}`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-bold text-white">
                            {task.title}
                          </h3>

                          {task.description && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                            <p>
                              <span className="font-medium text-slate-300">
                                Assigned Agent:
                              </span>{" "}
                              <span className="text-blue-300">
                                🤖 {getAgentName(task.assigned_agent)}
                              </span>
                            </p>

                            <p>
                              <span className="font-medium text-slate-300">
                                Project:
                              </span>{" "}
                              {getProjectName(task.project)}
                            </p>

                            <p>
                              <span className="font-medium text-slate-300">
                                Created:
                              </span>{" "}
                              {formatDate(task.created_at)}
                            </p>

                            <p>
                              <span className="font-medium text-slate-300">
                                Attempts:
                              </span>{" "}
                              {task.attempt_count ?? 0}
                            </p>
                          </div>

                          {task.status === "In Progress" && (
                            <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3.5 text-xs text-blue-300 animate-pulse">
                              ⚙️ AI Agent sedang mengerjakan task ini. Halaman
                              akan memperbarui status secara otomatis...
                            </div>
                          )}

                          {task.status === "Failed" && (
                            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                              <p className="text-xs font-semibold text-red-300">
                                Task execution failed
                              </p>

                              <p className="mt-1 whitespace-pre-wrap text-xs text-red-200/90">
                                {task.error_message ||
                                  "Tidak ada detail error dari backend."}
                              </p>
                              <button
                                type="button"
                                onClick={() => void handleRetry(task.id)}
                                disabled={retryingId === task.id}
                                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {retryingId === task.id
                                  ? "Memasukkan ke antrean..."
                                  : "↻ Retry Task"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-wrap shrink-0 items-start gap-2">
                          {task.status === "Pending" &&
                            Boolean(task.assigned_agent_id) && (
                              <button
                                type="button"
                                onClick={() => void handleExecuteTask(task.id)}
                                disabled={executing}
                                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition"
                              >
                                {executing ? "Starting..." : "▶ Execute"}
                              </button>
                            )}

                          {(task.status === "Review" ||
                            task.status === "Completed" ||
                            task.status === "Failed") && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTaskId(expanded ? null : task.id)
                              }
                              className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/20 transition"
                            >
                              {expanded ? "Hide Result" : "📄 View Result"}
                            </button>
                          )}

                          {task.status !== "In Progress" && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditing(task)}
                                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteTask(task)}
                                className="rounded-xl border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* EXECUTION TIMESTAMPS */}
                      {(task.started_at || task.completed_at) && (
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-3 text-[11px] text-slate-500">
                          {task.started_at && (
                            <span>Started: {formatDate(task.started_at)}</span>
                          )}

                          {task.completed_at && (
                            <span>
                              Completed: {formatDate(task.completed_at)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* AI AGENT RESULT (MARKDOWN) */}
                      {expanded && (
                        task.result ? (
                          <MarkdownDeliverable
                            content={task.result}
                            title={task.title}
                            agentName={getAgentName(task.assigned_agent)}
                            completedAt={formatDate(task.completed_at)}
                            taskId={task.id}
                          />
                        ) : (
                          <div className="mt-5 rounded-xl border border-white/10 bg-[#09090b] p-5 text-xs text-slate-500">
                            Belum ada hasil pekerjaan yang tersimpan.
                          </div>
                        )
                      )}

                      {/* FOUNDER REVIEW */}
                      {task.status === "Review" && (
                        <div className="mt-5 border-t border-white/10 pt-5">
                          <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-4">
                            <h4 className="text-sm font-semibold text-purple-200">
                              🟣 Founder Review Required
                            </h4>

                            <p className="mt-1 text-xs text-purple-300/80">
                              Periksa hasil pekerjaan AI Agent sebelum
                              menyetujui atau meminta revisi.
                            </p>

                            {/* APPROVAL NOTE FORM */}
                            {approvalTaskId === task.id && (
                              <div className="mt-4 space-y-3">
                                <div>
                                  <label className="block text-xs font-semibold text-green-300">
                                    Catatan Approval Founder (Opsional)
                                  </label>

                                  <p className="mt-0.5 text-[11px] text-slate-400">
                                    Catatan ini akan disimpan dalam Activity
                                    Log.
                                  </p>
                                </div>

                                <textarea
                                  value={approvalFeedback}
                                  onChange={(event) =>
                                    setApprovalFeedback(event.target.value)
                                  }
                                  rows={3}
                                  placeholder="Contoh: Disetujui. Lanjutkan ke tahap implementasi..."
                                  className="w-full rounded-xl border border-green-400/30 bg-[#09090b] p-3 text-xs text-white outline-none focus:border-green-400"
                                />

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleReview(
                                        task.id,
                                        "approve",
                                        approvalFeedback,
                                      )
                                    }
                                    disabled={reviewing}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                                  >
                                    {reviewing
                                      ? "Saving Approval..."
                                      : "✓ Konfirmasi Approval"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setApprovalTaskId(null);
                                      setApprovalFeedback("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* REVISION FORM */}
                            {revisionTaskId === task.id && (
                              <div className="mt-4 space-y-3">
                                <label className="block text-xs font-semibold text-purple-200">
                                  Instruksi Revisi untuk AI Agent *
                                </label>

                                <textarea
                                  value={revisionFeedback}
                                  onChange={(event) =>
                                    setRevisionFeedback(event.target.value)
                                  }
                                  rows={3}
                                  placeholder="Jelaskan bagian yang perlu diperbaiki atau dilengkapi oleh AI Agent..."
                                  className="w-full rounded-xl border border-purple-400/30 bg-[#09090b] p-3 text-xs text-white outline-none focus:border-purple-400"
                                />

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleReview(
                                        task.id,
                                        "revise",
                                        revisionFeedback,
                                      )
                                    }
                                    disabled={reviewing}
                                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                                  >
                                    {reviewing
                                      ? "Sending..."
                                      : "↻ Kirim Revisi & Jalankan Ulang"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevisionTaskId(null);
                                      setRevisionFeedback("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* REVIEW ACTION BUTTONS */}
                            {approvalTaskId !== task.id &&
                              revisionTaskId !== task.id && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevisionTaskId(null);
                                      setRevisionFeedback("");
                                      setApprovalTaskId(task.id);
                                      setApprovalFeedback("");
                                      setError("");
                                      setMessage("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                                  >
                                    ✓ Approve Result
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setApprovalTaskId(null);
                                      setApprovalFeedback("");
                                      setRevisionTaskId(task.id);
                                      setRevisionFeedback("");
                                      setError("");
                                      setMessage("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
                                  >
                                    ↻ Request Revision
                                  </button>
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* COMPLETED */}
                      {task.status === "Completed" && (
                        <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-300">
                          ✓ Hasil pekerjaan telah disetujui Founder.
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
          {branding.office_name} · {branding.office_badge} · Auto refresh setiap
          5 detik
        </footer>
      </div>
    </section>
  );
}
