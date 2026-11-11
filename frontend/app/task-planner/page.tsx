"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Project = {
  id: number;
  name: string;
  status: string;
};

type Agent = {
  id: number;
  name: string;
  role?: string;
};

type PlanTask = {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  assigned_agent_id: number;
  assigned_agent_name: string;
};

type TaskPlan = {
  id: number;
  project_id: number;
  project_name: string;
  title: string;
  summary: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  items: PlanTask[];
};

type ItemFormState = {
  title: string;
  description: string;
  priority: string;
  assigned_agent_id: string;
};

const priorityStyle: Record<string, string> = {
  Low: "text-slate-300 bg-slate-400/10",
  Normal: "text-blue-300 bg-blue-400/10",
  High: "text-orange-300 bg-orange-400/10",
  Urgent: "text-red-300 bg-red-400/10",
};

function formatDate(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusStyle(status: string) {
  if (status === "Approved") return "text-green-300 bg-green-400/10";
  if (status === "Rejected") return "text-red-300 bg-red-400/10";
  return "text-yellow-300 bg-yellow-400/10";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePlan(raw: unknown): TaskPlan {
  const plan = isRecord(raw) ? raw : {};
  const rawItems = Array.isArray(plan.items)
    ? plan.items
    : Array.isArray(plan.tasks)
      ? plan.tasks
      : [];

  return {
    id: asNumber(plan.id, 0),
    project_id: asNumber(plan.project_id, 0),
    project_name: asString(
      plan.project_name,
      isRecord(plan.project)
        ? asString(plan.project.name, "Unknown Project")
        : "Unknown Project",
    ),
    title: asString(plan.title, "Untitled Plan"),
    summary: typeof plan.summary === "string" ? plan.summary : null,
    notes: typeof plan.notes === "string" ? plan.notes : null,
    status: asString(plan.status, "Pending Approval"),
    created_at: asString(plan.created_at, ""),
    approved_at:
      typeof plan.approved_at === "string" ? plan.approved_at : null,
    items: rawItems.map((rawItem, index) => {
      const item = isRecord(rawItem) ? rawItem : {};
      const assignedAgent = isRecord(item.assigned_agent)
        ? item.assigned_agent
        : {};

      return {
        id: asNumber(item.id, index + 1),
        title: asString(item.title, "Untitled Task"),
        description:
          typeof item.description === "string" ? item.description : null,
        priority: asString(item.priority, "Normal"),
        assigned_agent_id: asNumber(
          item.assigned_agent_id ?? assignedAgent.id,
          0,
        ),
        assigned_agent_name: asString(
          item.assigned_agent_name ?? item.agent_name ?? assignedAgent.name,
          "Unassigned",
        ),
      };
    }),
  };
}

function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.status === "string"
  );
}

function isAgent(value: unknown): value is Agent {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string"
  );
}

async function readJson(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Permintaan ke backend gagal.",
    );
  }

  return data;
}

async function fetchPlannerData(): Promise<{
  projects: Project[];
  plans: TaskPlan[];
  agents: Agent[];
}> {
  const [projectResponse, planResponse, agentResponse] = await Promise.all([
    fetch(`${API_URL}/projects`),
    fetch(`${API_URL}/ai/task-planner/plans`),
    fetch(`${API_URL}/ai/task-planner/agents`),
  ]);

  const [projectData, rawPlans, agentData] = await Promise.all([
    readJson(projectResponse),
    readJson(planResponse),
    readJson(agentResponse),
  ]);

  return {
    projects: Array.isArray(projectData) ? projectData.filter(isProject) : [],
    plans: Array.isArray(rawPlans) ? rawPlans.map(normalizePlan) : [],
    agents: Array.isArray(agentData) ? agentData.filter(isAgent) : [],
  };
}

export default function TaskPlannerPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TaskPlan | null>(null);

  const [projectId, setProjectId] = useState("");
  const [instruction, setInstruction] = useState(
    "Buat breakdown pekerjaan proyek secara realistis. " +
      "Bagikan setiap task kepada specialist agent yang paling sesuai.",
  );

  // Plan Header Edit state
  const [editingPlanMeta, setEditingPlanMeta] = useState(false);
  const [planMetaForm, setPlanMetaForm] = useState({
    title: "",
    summary: "",
    notes: "",
  });

  // Plan Item Edit / Add state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    title: "",
    description: "",
    priority: "Normal",
    assigned_agent_id: "",
  });

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyPlannerData = useCallback(
    (data: { projects: Project[]; plans: TaskPlan[]; agents: Agent[] }) => {
      setProjects(data.projects);
      setPlans(data.plans);
      setAgents(data.agents);

      setProjectId((current) => {
        if (current || data.projects.length === 0) return current;
        return String(data.projects[0].id);
      });

      setSelectedPlan((current) => {
        if (!current) return current;
        return data.plans.find((plan) => plan.id === current.id) ?? current;
      });
    },
    [],
  );

  const loadData = useCallback(async () => {
    try {
      const data = await fetchPlannerData();
      setError("");
      applyPlannerData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil data backend.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyPlannerData]);

  useEffect(() => {
    let active = true;

    fetchPlannerData()
      .then((data) => {
        if (active) {
          setError("");
          applyPlannerData(data);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal mengambil data backend.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyPlannerData]);

  async function refreshPlans() {
    const response = await fetch(`${API_URL}/ai/task-planner/plans`);
    const rawPlans = await readJson(response);

    const normalizedPlans = Array.isArray(rawPlans)
      ? rawPlans.map(normalizePlan)
      : [];

    setPlans(normalizedPlans);

    setSelectedPlan((current) => {
      if (!current) return current;
      return normalizedPlans.find((plan) => plan.id === current.id) ?? current;
    });
  }

  async function generatePlan() {
    if (!projectId || !instruction.trim()) {
      setError("Pilih proyek dan isi instruksi terlebih dahulu.");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setMessage("");

      const response = await fetch(`${API_URL}/ai/task-planner/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: Number(projectId),
          instruction: instruction.trim(),
        }),
      });

      const data = await readJson(response);

      setMessage(data.message || "Usulan task berhasil dibuat.");

      if (data.plan) {
        setSelectedPlan(normalizePlan(data.plan));
      }

      await refreshPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat task plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function openPlan(planId: number) {
    try {
      setError("");
      setEditingPlanMeta(false);
      setEditingItemId(null);
      setAddingItem(false);

      const response = await fetch(
        `${API_URL}/ai/task-planner/plans/${planId}`,
      );

      const data = await readJson(response);
      setSelectedPlan(normalizePlan(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil detail.");
    }
  }

  // ========================================
  // EDIT PLAN METADATA & DELETE PLAN
  // ========================================

  function startEditingPlanMeta(plan: TaskPlan) {
    setEditingPlanMeta(true);
    setPlanMetaForm({
      title: plan.title,
      summary: plan.summary || "",
      notes: plan.notes || "",
    });
  }

  async function savePlanMeta() {
    if (!selectedPlan || !planMetaForm.title.trim()) return;

    try {
      setActionLoading(true);
      setError("");
      const response = await fetch(
        `${API_URL}/ai/task-planner/plans/${selectedPlan.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: planMetaForm.title.trim(),
            summary: planMetaForm.summary.trim(),
            notes: planMetaForm.notes.trim(),
          }),
        },
      );
      const updated = normalizePlan(await readJson(response));
      setSelectedPlan(updated);
      setEditingPlanMeta(false);
      setMessage("Detail Task Plan berhasil diperbarui.");
      await refreshPlans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui Task Plan.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeletePlan(plan: TaskPlan) {
    if (!window.confirm(`Hapus Task Plan "${plan.title}"?`)) return;

    try {
      setActionLoading(true);
      setError("");
      const response = await fetch(
        `${API_URL}/ai/task-planner/plans/${plan.id}`,
        { method: "DELETE" },
      );
      await readJson(response);
      setSelectedPlan(null);
      setMessage("Task Plan berhasil dihapus.");
      await refreshPlans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus Task Plan.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ========================================
  // ADD / EDIT / DELETE PLAN ITEMS
  // ========================================

  function startAddingItem() {
    setEditingItemId(null);
    setAddingItem(true);
    setItemForm({
      title: "",
      description: "",
      priority: "Normal",
      assigned_agent_id: agents[0] ? String(agents[0].id) : "",
    });
  }

  function startEditingItem(item: PlanTask) {
    setAddingItem(false);
    setEditingItemId(item.id);
    setItemForm({
      title: item.title,
      description: item.description || "",
      priority: item.priority || "Normal",
      assigned_agent_id: String(item.assigned_agent_id),
    });
  }

  async function saveItem() {
    if (!selectedPlan || !itemForm.title.trim() || !itemForm.assigned_agent_id) {
      setError("Judul task dan Assigned Agent wajib diisi.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const url = editingItemId
        ? `${API_URL}/ai/task-planner/plans/${selectedPlan.id}/items/${editingItemId}`
        : `${API_URL}/ai/task-planner/plans/${selectedPlan.id}/items`;

      const response = await fetch(url, {
        method: editingItemId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: itemForm.title.trim(),
          description: itemForm.description.trim() || null,
          priority: itemForm.priority,
          assigned_agent_id: Number(itemForm.assigned_agent_id),
        }),
      });

      const updated = normalizePlan(await readJson(response));
      setSelectedPlan(updated);
      setEditingItemId(null);
      setAddingItem(false);
      setMessage(
        editingItemId
          ? "Item task pada rencana berhasil diperbarui."
          : "Item task baru berhasil ditambahkan ke rencana.",
      );
      await refreshPlans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan item task.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteItem(item: PlanTask) {
    if (!selectedPlan) return;
    if (!window.confirm(`Hapus task "${item.title}" dari rencana ini?`)) return;

    try {
      setActionLoading(true);
      setError("");
      const response = await fetch(
        `${API_URL}/ai/task-planner/plans/${selectedPlan.id}/items/${item.id}`,
        { method: "DELETE" },
      );
      const updated = normalizePlan(await readJson(response));
      setSelectedPlan(updated);
      setMessage("Item task berhasil dihapus dari rencana.");
      await refreshPlans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus item task.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ========================================
  // APPROVE / REJECT PLAN
  // ========================================

  async function handlePlanAction(action: "approve" | "reject") {
    if (!selectedPlan) return;

    const taskCount = selectedPlan.items.length;

    if (action === "approve" && taskCount === 0) {
      setError("Task Plan ini tidak memiliki item. Approval dibatalkan.");
      return;
    }

    const confirmation =
      action === "approve"
        ? `Setujui rencana "${selectedPlan.title}"? Semua ${taskCount} usulan task akan dibuat menjadi task aktif dan dieksekusi otomatis oleh specialist agents.`
        : `Tolak rencana "${selectedPlan.title}"?`;

    if (!window.confirm(confirmation)) return;

    try {
      setActionLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/ai/task-planner/plans/${selectedPlan.id}/${action}`,
        { method: "POST" },
      );

      const data = await readJson(response);

      setMessage(
        data.message ||
          (action === "approve"
            ? "Rencana berhasil disetujui."
            : "Rencana berhasil ditolak."),
      );

      await refreshPlans();

      const detailResponse = await fetch(
        `${API_URL}/ai/task-planner/plans/${selectedPlan.id}`,
      );

      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        setSelectedPlan(normalizePlan(detailData));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tindakan gagal diproses.");
    } finally {
      setActionLoading(false);
    }
  }

  const pendingCount = plans.filter(
    (plan) => plan.status === "Pending Approval",
  ).length;

  const isPendingPlan = selectedPlan?.status === "Pending Approval";

  return (
    <section className="flex-1 min-w-0 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-400">
              SOLUSI MACRO / AI CEO / TASK PLANNER
            </p>
            <h1 className="text-3xl font-bold mt-2">AI CEO Task Planner</h1>
            <p className="text-slate-400 mt-2 text-sm">
              Generate, sesuaikan rincian item task, dan setujui rencana kerja
              untuk dieksekusi AI Specialist Agents.
            </p>
          </div>

          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3">
            <p className="text-xs text-yellow-300">Pending Approval</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {message}
          </div>
        )}

        {/* GENERATOR */}
        <section className="bg-[#131316] border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">✨</span>
            <div>
              <h2 className="text-lg font-semibold">Generate Task Plan</h2>
              <p className="text-xs text-slate-400">
                Powered by Claude Sonnet 5.5 via OCTA
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-2">
              Pilih Project
            </label>

            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full rounded-xl bg-[#09090b] border border-white/10 p-3 text-sm outline-none focus:border-blue-400"
            >
              <option value="">-- Pilih Project --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-sm text-slate-300 mb-2">
              Instruksi untuk AI CEO
            </label>

            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={4}
              placeholder="Jelaskan pekerjaan yang perlu direncanakan..."
              className="w-full rounded-xl bg-[#09090b] border border-white/10 p-4 text-sm outline-none resize-y focus:border-blue-400"
            />
          </div>

          <button
            type="button"
            onClick={generatePlan}
            disabled={generating || loading || projects.length === 0}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold transition"
          >
            {generating
              ? "⏳ AI CEO sedang menyusun rencana..."
              : "✨ Generate Task Plan"}
          </button>

          {projects.length === 0 && !loading && (
            <p className="text-xs text-yellow-300 mt-3">
              Belum ada project. Buat project terlebih dahulu.
            </p>
          )}
        </section>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* PLAN LIST */}
          <section className="bg-[#131316] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-semibold">📋 Usulan Task Plan</h2>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void loadData();
                }}
                disabled={loading}
                className="text-xs text-blue-300 hover:text-white disabled:opacity-50"
              >
                ↻ Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Belum ada usulan task plan.
              </p>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => void openPlan(plan.id)}
                    className={`w-full text-left rounded-xl border p-4 transition ${
                      selectedPlan?.id === plan.id
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <span className="text-sm font-medium">{plan.title}</span>
                      <span className="text-xs text-slate-500">#{plan.id}</span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2">
                      {plan.project_name}
                    </p>

                    <div className="flex justify-between items-center mt-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-lg ${statusStyle(plan.status)}`}
                      >
                        {plan.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {plan.items.length} tasks
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* PLAN DETAIL */}
          <section className="xl:col-span-2 bg-[#131316] border border-white/10 rounded-2xl p-6">
            {!selectedPlan ? (
              <div className="min-h-64 flex flex-col items-center justify-center text-center">
                <span className="text-5xl mb-4">🗂️</span>
                <h2 className="font-semibold">Detail Task Plan</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Pilih usulan dari daftar untuk melihat dan menyesuaikan
                  detailnya.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs text-slate-500">
                      PLAN #{selectedPlan.id} · {selectedPlan.project_name}
                    </p>
                    <h2 className="text-xl font-bold mt-2">
                      {selectedPlan.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-2">
                      Dibuat: {formatDate(selectedPlan.created_at)}
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span
                      className={`text-xs px-3 py-2 rounded-lg ${statusStyle(selectedPlan.status)}`}
                    >
                      {selectedPlan.status}
                    </span>

                    {isPendingPlan && !editingPlanMeta && (
                      <button
                        type="button"
                        onClick={() => startEditingPlanMeta(selectedPlan)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                      >
                        ✏️ Edit Info
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleDeletePlan(selectedPlan)}
                      disabled={actionLoading}
                      className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* EDIT PLAN METADATA FORM */}
                {editingPlanMeta ? (
                  <div className="rounded-xl border border-blue-400/30 bg-[#09090b] p-4 mb-5 space-y-3">
                    <p className="text-xs font-semibold text-blue-300">
                      EDIT INFORMASI RENCANA KERJA
                    </p>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Judul Rencana
                      </label>
                      <input
                        value={planMetaForm.title}
                        onChange={(e) =>
                          setPlanMetaForm({
                            ...planMetaForm,
                            title: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Ringkasan
                      </label>
                      <textarea
                        rows={2}
                        value={planMetaForm.summary}
                        onChange={(e) =>
                          setPlanMetaForm({
                            ...planMetaForm,
                            summary: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Catatan / Asumsi
                      </label>
                      <textarea
                        rows={2}
                        value={planMetaForm.notes}
                        onChange={(e) =>
                          setPlanMetaForm({
                            ...planMetaForm,
                            notes: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void savePlanMeta()}
                        disabled={actionLoading}
                        className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold"
                      >
                        Simpan Perubahan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPlanMeta(false)}
                        className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#09090b] p-4 mb-5">
                    <p className="text-xs text-slate-500 mb-2">RINGKASAN</p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedPlan.summary || "Tidak ada ringkasan."}
                    </p>

                    {selectedPlan.notes && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-xs text-slate-500 mb-2">
                          CATATAN AI CEO
                        </p>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {selectedPlan.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* TASK BREAKDOWN HEADER */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold">Task Breakdown</h3>
                    <p className="text-xs text-slate-500">
                      {selectedPlan.items.length} item pekerjaan dalam rencana
                      ini
                    </p>
                  </div>

                  {isPendingPlan && !addingItem && (
                    <button
                      type="button"
                      onClick={startAddingItem}
                      className="rounded-xl bg-blue-600/20 border border-blue-400/30 hover:bg-blue-600/30 px-3.5 py-2 text-xs font-semibold text-blue-200 transition"
                    >
                      ＋ Tambah Item Task
                    </button>
                  )}
                </div>

                {/* ADD / EDIT ITEM FORM */}
                {(addingItem || editingItemId !== null) && isPendingPlan && (
                  <div className="mb-4 rounded-xl border border-blue-400/30 bg-[#09090b] p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-300">
                      {editingItemId
                        ? "EDIT ITEM TASK"
                        : "TAMBAH ITEM TASK BARU KE RENCANA"}
                    </p>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Judul Task *
                      </label>
                      <input
                        value={itemForm.title}
                        onChange={(e) =>
                          setItemForm({ ...itemForm, title: e.target.value })
                        }
                        placeholder="Judul pekerjaan..."
                        className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Deskripsi Pekerjaan
                      </label>
                      <textarea
                        rows={3}
                        value={itemForm.description}
                        onChange={(e) =>
                          setItemForm({
                            ...itemForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Detail instruksi dan deliverable yang diharapkan..."
                        className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Specialist Agent *
                        </label>
                        <select
                          value={itemForm.assigned_agent_id}
                          onChange={(e) =>
                            setItemForm({
                              ...itemForm,
                              assigned_agent_id: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                        >
                          {agents.map((agent) => (
                            <option key={agent.id} value={String(agent.id)}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Prioritas
                        </label>
                        <select
                          value={itemForm.priority}
                          onChange={(e) =>
                            setItemForm({
                              ...itemForm,
                              priority: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-white/10 bg-[#131316] p-2.5 text-sm text-white outline-none focus:border-blue-400"
                        >
                          <option value="Low">Low</option>
                          <option value="Normal">Normal</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void saveItem()}
                        disabled={actionLoading}
                        className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold"
                      >
                        {actionLoading ? "Menyimpan..." : "Simpan Item"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingItem(false);
                          setEditingItemId(null);
                        }}
                        className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {selectedPlan.items.length === 0 ? (
                    <p className="text-sm text-slate-500 py-5 text-center">
                      Belum ada item task dalam rencana ini.
                    </p>
                  ) : (
                    selectedPlan.items.map((task, index) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-white/10 p-4 bg-[#131316]/60"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                          <div className="flex gap-3">
                            <span className="text-sm font-semibold text-slate-500">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <h4 className="text-sm font-medium text-white">
                                {task.title}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed whitespace-pre-wrap">
                                {task.description || "Tidak ada deskripsi."}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`self-start text-xs px-2.5 py-1 rounded-lg whitespace-nowrap ${
                              priorityStyle[task.priority] ||
                              priorityStyle.Normal
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap justify-between gap-2 items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">
                              Assigned Agent:
                            </span>
                            <span className="rounded-lg bg-blue-500/10 text-blue-300 px-2.5 py-1">
                              🤖 {task.assigned_agent_name}
                            </span>
                          </div>

                          {isPendingPlan && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingItem(task)}
                                className="rounded-lg border border-white/10 px-2.5 py-1 text-slate-300 hover:bg-white/5"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteItem(task)}
                                className="rounded-lg border border-red-400/20 px-2.5 py-1 text-red-300 hover:bg-red-500/10"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {isPendingPlan && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => void handlePlanAction("approve")}
                      disabled={
                        actionLoading || selectedPlan.items.length === 0
                      }
                      className="flex-1 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 px-5 py-3 text-sm font-semibold transition"
                    >
                      {actionLoading
                        ? "Processing..."
                        : `✓ Approve & Execute Plan (${selectedPlan.items.length} Tasks)`}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handlePlanAction("reject")}
                      disabled={actionLoading}
                      className="rounded-xl border border-red-400/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 px-5 py-3 text-sm font-semibold transition"
                    >
                      ✕ Reject Plan
                    </button>
                  </div>
                )}

                {selectedPlan.status === "Approved" && (
                  <div className="mt-6 rounded-xl bg-green-500/10 border border-green-400/20 p-4 text-sm text-green-300">
                    ✓ Rencana telah disetujui. Seluruh task sudah dibuat dan
                    dieksekusi secara otomatis oleh AI Specialist Agents.
                  </div>
                )}

                {selectedPlan.status === "Rejected" && (
                  <div className="mt-6 rounded-xl bg-red-500/10 border border-red-400/20 p-4 text-sm text-red-300">
                    Rencana ini telah ditolak oleh Founder.
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* AGENT DIRECTORY */}
        <section className="mt-6 bg-[#131316] border border-white/10 rounded-2xl p-6">
          <h2 className="font-semibold mb-4">🤖 Available Specialist Agents</h2>

          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <span
                key={agent.id}
                className="rounded-lg bg-[#09090b] border border-white/10 px-3 py-2 text-xs text-slate-300"
              >
                {agent.name}
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Anda dapat mengubah agen penanggung jawab, menambah, atau menghapus
            item pekerjaan di atas sebelum menekan tombol Approve.
          </p>
        </section>

        <footer className="mt-8 text-xs text-slate-600">
          SOLUSI MACRO VIRTUAL HQ · AI CEO TASK PLANNER
        </footer>
      </div>
    </section>
  );
}
