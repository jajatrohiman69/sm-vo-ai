"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

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
      return "bg-amber-100 text-amber-700";
    case "in progress":
      return "bg-blue-100 text-blue-700";
    case "review":
      return "bg-purple-100 text-purple-700";
    case "completed":
      return "bg-green-100 text-green-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function priorityClass(priority: string) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "low":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-blue-50 text-blue-700";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // Founder approval state
  const [approvalTaskId, setApprovalTaskId] = useState<number | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState("");

  // Founder revision state
  const [revisionTaskId, setRevisionTaskId] = useState<number | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState<TaskForm>({
    title: "",
    description: "",
    priority: "Normal",
    assigned_agent_id: "",
    project_id: "",
  });

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
  // CREATE TASK
  // =========================================================

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Judul task wajib diisi.");
      return;
    }

    setCreating(true);
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
      };

      const response = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "Gagal membuat task.");
      }

      setForm({
        title: "",
        description: "",
        priority: "Normal",
        assigned_agent_id: "",
        project_id: "",
      });

      setMessage("Task berhasil dibuat.");

      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setCreating(false);
    }
  }

  // =========================================================
  // FOUNDER REVIEW HANDLER
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

      // Reset approval state
      setApprovalTaskId(null);
      setApprovalFeedback("");

      // Reset revision state
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
  // TASK STATISTICS
  // =========================================================

  const totalTasks = tasks.length;

  const pendingTasks = tasks.filter((task) => task.status === "Pending").length;

  const inProgressTasks = tasks.filter(
    (task) => task.status === "In Progress",
  ).length;

  const reviewTasks = tasks.filter((task) => task.status === "Review").length;

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed",
  ).length;

  const failedTasks = tasks.filter((task) => task.status === "Failed").length;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* PAGE HEADER */}

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Solusi Macro / Virtual HQ
            </p>

            <h1 className="mt-2 text-3xl font-bold">Task Management</h1>

            <p className="mt-2 text-sm text-gray-500">
              Monitor pekerjaan dan review hasil kerja AI Agents.
            </p>
          </div>

          <button
            onClick={() => loadData(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
          >
            ↻ Refresh Data
          </button>
        </div>

        {/* ALERTS */}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* TASK STATISTICS */}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Tasks", value: totalTasks },
            { label: "Pending", value: pendingTasks },
            { label: "In Progress", value: inProgressTasks },
            { label: "For Review", value: reviewTasks },
            { label: "Completed", value: completedTasks },
            { label: "Failed", value: failedTasks },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-medium text-gray-500">{item.label}</p>

              <p className="mt-2 text-3xl font-bold">{item.value}</p>
            </div>
          ))}
        </section>

        {/* CREATE TASK */}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold">Create New Task</h2>

            <p className="mt-1 text-sm text-gray-500">
              Buat task dan tentukan AI Agent yang bertanggung jawab.
            </p>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Task Title *
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="Contoh: Analisis kebutuhan dashboard penjualan"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Description
              </label>

              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Jelaskan detail pekerjaan yang harus dilakukan..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Assign Agent
                </label>

                <select
                  value={form.assigned_agent_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      assigned_agent_id: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm"
                >
                  <option value="">Unassigned</option>

                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm"
                >
                  <option value="">No project</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating..." : "+ Create Task"}
              </button>
            </div>
          </form>
        </section>

        {/* TASK LIST */}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">All Tasks</h2>

              <p className="mt-1 text-sm text-gray-500">
                Daftar pekerjaan seluruh AI Agents.
              </p>
            </div>

            <span className="text-sm text-gray-500">{totalTasks} task(s)</span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <div className="text-4xl">📋</div>

              <h3 className="mt-3 font-semibold">Belum ada task</h3>

              <p className="mt-1 text-sm text-gray-500">
                Buat task baru atau generate Task Plan melalui AI CEO Task
                Planner.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const expanded = expandedTaskId === task.id;
                const reviewing = reviewingId === task.id;

                return (
                  <article
                    key={task.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="p-5 md:p-6">
                      <div className="flex flex-col justify-between gap-4 md:flex-row">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400">
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

                          <h3 className="mt-3 text-lg font-bold">
                            {task.title}
                          </h3>

                          {task.description && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-4 grid gap-2 text-sm text-gray-500 md:grid-cols-2">
                            <p>
                              <span className="font-medium text-gray-700">
                                Assigned Agent:
                              </span>{" "}
                              {getAgentName(task.assigned_agent)}
                            </p>

                            <p>
                              <span className="font-medium text-gray-700">
                                Project:
                              </span>{" "}
                              {getProjectName(task.project)}
                            </p>

                            <p>
                              <span className="font-medium text-gray-700">
                                Created:
                              </span>{" "}
                              {formatDate(task.created_at)}
                            </p>

                            <p>
                              <span className="font-medium text-gray-700">
                                Attempts:
                              </span>{" "}
                              {task.attempt_count ?? 0}
                            </p>
                          </div>

                          {task.status === "In Progress" && (
                            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                              AI Agent sedang mengerjakan task ini. Halaman akan
                              memperbarui status secara otomatis.
                            </div>
                          )}

                          {task.status === "Failed" && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                              <p className="text-sm font-semibold text-red-700">
                                Task execution failed
                              </p>

                              <p className="mt-1 whitespace-pre-wrap text-sm text-red-600">
                                {task.error_message ||
                                  "Tidak ada detail error dari backend."}
                              </p>
                              <button
                                onClick={() => handleRetry(task.id)}
                                disabled={retryingId === task.id}
                                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {retryingId === task.id
                                  ? "Memasukkan ke antrean..."
                                  : "↻ Retry Task"}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 items-start">
                          {(task.status === "Review" ||
                            task.status === "Completed" ||
                            task.status === "Failed") && (
                            <button
                              onClick={() =>
                                setExpandedTaskId(expanded ? null : task.id)
                              }
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                            >
                              {expanded ? "Hide Result" : "View Result"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* EXECUTION TIMESTAMPS */}

                      {(task.started_at || task.completed_at) && (
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-400">
                          {task.started_at && (
                            <span>Started: {formatDate(task.started_at)}</span>
                          )}

                          {task.completed_at && (
                            <span>
                              Last completed: {formatDate(task.completed_at)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* AI AGENT RESULT */}

                      {expanded && (
                        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <h4 className="mb-3 font-semibold">
                            AI Agent Result
                          </h4>

                          {task.result ? (
                            <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                              {task.result}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">
                              Belum ada hasil pekerjaan yang tersimpan.
                            </p>
                          )}
                        </div>
                      )}

                      {/* FOUNDER REVIEW */}

                      {task.status === "Review" && (
                        <div className="mt-5 border-t border-gray-100 pt-5">
                          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                            <h4 className="font-semibold text-purple-900">
                              Founder Review Required
                            </h4>

                            <p className="mt-1 text-sm text-purple-700">
                              Periksa hasil pekerjaan AI Agent sebelum
                              menyelesaikan task.
                            </p>

                            {/* APPROVAL NOTE FORM */}

                            {approvalTaskId === task.id && (
                              <div className="mt-4 space-y-3">
                                <div>
                                  <label className="block text-sm font-semibold text-green-900">
                                    Catatan Approval Founder
                                  </label>

                                  <p className="mt-1 text-xs text-green-700">
                                    Catatan ini akan disimpan dalam Activity
                                    Log. Boleh dikosongkan jika tidak ada
                                    catatan.
                                  </p>
                                </div>

                                <textarea
                                  value={approvalFeedback}
                                  onChange={(event) =>
                                    setApprovalFeedback(event.target.value)
                                  }
                                  rows={4}
                                  placeholder="Contoh: Disetujui dengan catatan. Lengkapi analisis Finance & Administrasi serta prioritas otomatisasi berdasarkan dampak bisnis..."
                                  className="w-full rounded-lg border border-green-300 bg-white p-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                                />

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() =>
                                      handleReview(
                                        task.id,
                                        "approve",
                                        approvalFeedback,
                                      )
                                    }
                                    disabled={reviewing}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {reviewing
                                      ? "Saving Approval..."
                                      : "✓ Konfirmasi Approval"}
                                  </button>

                                  <button
                                    onClick={() => {
                                      setApprovalTaskId(null);
                                      setApprovalFeedback("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* REVISION FORM */}

                            {revisionTaskId === task.id && (
                              <div className="mt-4 space-y-3">
                                <label className="block text-sm font-medium text-purple-900">
                                  Revision Feedback
                                </label>

                                <textarea
                                  value={revisionFeedback}
                                  onChange={(event) =>
                                    setRevisionFeedback(event.target.value)
                                  }
                                  rows={4}
                                  placeholder="Jelaskan bagian yang perlu diperbaiki..."
                                  className="w-full rounded-lg border border-purple-200 bg-white p-3 text-sm outline-none focus:border-purple-500"
                                />

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() =>
                                      handleReview(
                                        task.id,
                                        "revise",
                                        revisionFeedback,
                                      )
                                    }
                                    disabled={reviewing}
                                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                                  >
                                    {reviewing ? "Sending..." : "Send Revision"}
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRevisionTaskId(null);
                                      setRevisionFeedback("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* REVIEW ACTION BUTTONS */}

                            {approvalTaskId !== task.id &&
                              revisionTaskId !== task.id && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => {
                                      setRevisionTaskId(null);
                                      setRevisionFeedback("");
                                      setApprovalTaskId(task.id);
                                      setApprovalFeedback("");
                                      setError("");
                                      setMessage("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    ✓ Approve Result
                                  </button>

                                  <button
                                    onClick={() => {
                                      setApprovalTaskId(null);
                                      setApprovalFeedback("");
                                      setRevisionTaskId(task.id);
                                      setRevisionFeedback("");
                                      setError("");
                                      setMessage("");
                                    }}
                                    disabled={reviewing}
                                    className="rounded-lg border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
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
                        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
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

        <footer className="border-t border-gray-200 py-5 text-center text-xs text-gray-400">
          Solusi Macro Virtual HQ · Task Management · Auto refresh every 5
          seconds
        </footer>
      </div>
    </main>
  );
}
