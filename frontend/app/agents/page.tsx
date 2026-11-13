"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Agent = {
  id: number;
  name: string;
  role: string;
  department: string;
  status: string;
  description: string | null;
  preferred_provider_id?: string | null;
  preferred_model?: string | null;
};

type ProviderModel = {
  id: string;
  label?: string;
  description?: string;
};

type ProviderConfig = {
  provider_id: string;
  name: string;
  default_model: string;
  custom_models_json?: string | null;
  is_active: boolean;
};

type AgentForm = {
  name: string;
  role: string;
  department: string;
  status: string;
  description: string;
  preferred_provider_id: string;
  preferred_model: string;
};

const EMPTY_FORM: AgentForm = {
  name: "",
  role: "",
  department: "",
  status: "Standby",
  description: "",
  preferred_provider_id: "",
  preferred_model: "",
};

const BUSINESS_CAPABILITIES = [
  { label: "Koordinasi & Perencanaan", agents: ["ai ceo", "ceo"] },
  { label: "Analisis Bisnis", agents: ["business analyst", "analyst"] },
  { label: "Solusi Excel & VBA", agents: ["excel", "macro"] },
  { label: "Otomasi Proses", agents: ["automation"] },
  { label: "Dashboard & Reporting", agents: ["dashboard", "data"] },
  { label: "QA & Dokumentasi", agents: ["qa", "quality", "documentation"] },
  { label: "Administrasi & PMO", agents: ["secretary", "pmo", "admin"] },
  { label: "Konten & Pemasaran", agents: ["social", "marketing", "content"] },
];

function getAgentAvatar(agent: Pick<Agent, "name" | "role" | "department">): string {
  const txt = `${agent.name} ${agent.role} ${agent.department}`.toLowerCase();
  if (txt.includes("ceo")) return "👔";
  if (txt.includes("secretary") || txt.includes("pmo") || txt.includes("admin")) return "📋";
  if (txt.includes("excel") || txt.includes("macro")) return "📈";
  if (txt.includes("automation") || txt.includes("engineer")) return "⚙️";
  if (txt.includes("dashboard") || txt.includes("bi")) return "📉";
  if (txt.includes("business") || txt.includes("analyst")) return "📊";
  if (txt.includes("qa") || txt.includes("quality") || txt.includes("doc")) return "📝";
  if (txt.includes("social") || txt.includes("marketing") || txt.includes("content")) return "📡";
  if (txt.includes("sales") || txt.includes("crm")) return "🤝";
  return "🤖";
}

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "online" || s === "active" || s === "working") {
    return {
      dot: "bg-emerald-400",
      pill: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
    };
  }
  if (s === "offline") {
    return {
      dot: "bg-slate-500",
      pill: "border-slate-500/30 bg-slate-500/15 text-slate-400",
    };
  }
  return {
    dot: "bg-sky-400",
    pill: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  };
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const coveredCapabilities = useMemo(
    () =>
      BUSINESS_CAPABILITIES.map((capability) => ({
        ...capability,
        covered: agents.some((agent) => {
          const profile = `${agent.name} ${agent.role} ${agent.department}`.toLowerCase();
          return capability.agents.some((keyword) => profile.includes(keyword));
        }),
      })),
    [agents],
  );

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const a of agents) {
      if (a.department?.trim()) set.add(a.department.trim());
    }
    return Array.from(set);
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      if (departmentFilter !== "ALL" && agent.department.trim() !== departmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.role.toLowerCase().includes(q) ||
        agent.department.toLowerCase().includes(q) ||
        (agent.description || "").toLowerCase().includes(q)
      );
    });
  }, [agents, departmentFilter, searchQuery]);

  const customRoutedCount = useMemo(
    () => agents.filter((a) => a.preferred_provider_id || a.preferred_model).length,
    [agents],
  );

  const loadAgents = useCallback(async () => {
    const response = await fetch(`${API_URL}/agents`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Gagal memuat daftar agen.");
    }
    setAgents(data);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([fetch(`${API_URL}/agents`), fetch(`${API_URL}/ai/providers`)])
      .then(async ([agRes, pvRes]) => {
        const data = await agRes.json();
        if (!agRes.ok) {
          throw new Error(data.detail || "Gagal memuat daftar agen.");
        }
        if (active) setAgents(data);
        if (pvRes.ok) {
          const pvData = await pvRes.json();
          if (active && Array.isArray(pvData.providers)) {
            setProviders(pvData.providers);
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Tidak dapat memuat daftar agen.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(agent: Agent) {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      role: agent.role,
      department: agent.department,
      status: agent.status,
      description: agent.description || "",
      preferred_provider_id: agent.preferred_provider_id || "",
      preferred_model: agent.preferred_model || "",
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        editingId ? `${API_URL}/agents/${editingId}` : `${API_URL}/agents`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            name: form.name.trim(),
            role: form.role.trim(),
            department: form.department.trim(),
            description: form.description.trim() || null,
            preferred_provider_id: form.preferred_provider_id || "",
            preferred_model: form.preferred_model || "",
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Gagal menyimpan agen.");
      }

      setMessage(
        editingId
          ? `Profil "${form.name.trim()}" berhasil diperbarui.`
          : `Agen "${form.name.trim()}" berhasil ditambahkan ke tim.`,
      );
      closeModal();
      await loadAgents();
      window.dispatchEvent(new Event("vhq-branding-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan agen.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent(agent: Agent) {
    if (!window.confirm(`Hapus agen "${agent.name}" dari tim?`)) return;

    try {
      setError("");
      setMessage("");
      const response = await fetch(`${API_URL}/agents/${agent.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Gagal menghapus agen.");
      }

      if (editingId === agent.id) closeModal();
      setMessage(data.message || `Agen "${agent.name}" berhasil dihapus.`);
      await loadAgents();
      window.dispatchEvent(new Event("vhq-branding-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus agen.");
    }
  }

  const getProviderLabel = (providerId?: string | null) => {
    if (!providerId) return "Global Default";
    const found = providers.find((p) => p.provider_id === providerId);
    return found ? found.name : providerId;
  };

  return (
    <section className="flex-1 min-w-0 p-5 md:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              AI TEAM DIRECTORY & MODEL ROUTING
            </p>
            <h1 className="mt-1.5 text-2xl md:text-3xl font-bold text-white tracking-tight">
              Kelola Tim & Spesialis AI
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Atur identitas, peran, keahlian, serta endpoint & model AI masing-masing agen dalam satu tempat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCoverage((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#131316] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5 transition"
            >
              <span>📊</span>
              <span>
                Cakupan Tim ({coveredCapabilities.filter((c) => c.covered).length}/{coveredCapabilities.length})
              </span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition"
            >
              <span>+</span>
              <span>Tambah Agen Baru</span>
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <span>⚠️ {error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-xs text-red-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        {message && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            <span>✅ {message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="text-xs text-emerald-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* COLLAPSIBLE CAPABILITY COVERAGE */}
        {showCoverage && !loading && (
          <section
            aria-labelledby="business-fit-title"
            className="rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-[#131316] p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 id="business-fit-title" className="text-sm font-bold text-white">
                  Peta Kapabilitas Tim Saat Ini
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ringkasan area fungsional yang sudah memiliki agen penanggung jawab.
                </p>
              </div>
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
                {coveredCapabilities.filter((c) => c.covered).length}/{coveredCapabilities.length} Tercakup
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {coveredCapabilities.map((capability) => (
                <div
                  key={capability.label}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs ${
                    capability.covered
                      ? "border-emerald-400/20 bg-emerald-500/5 text-slate-200"
                      : "border-white/5 bg-[#09090b]/60 text-slate-500"
                  }`}
                >
                  <span className={capability.covered ? "text-emerald-400" : "text-slate-600"}>
                    {capability.covered ? "✓" : "○"}
                  </span>
                  <span>{capability.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* STATS + SEARCH & FILTER BAR */}
        <div className="rounded-2xl border border-white/10 bg-[#131316] p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama agen, role, atau keahlian..."
                className="w-full rounded-xl border border-white/10 bg-[#09090b] pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-lg border border-white/10 bg-[#09090b] px-3 py-1.5">
                👥 <strong className="text-white">{agents.length}</strong> Total Agen
              </span>
              <span className="rounded-lg border border-white/10 bg-[#09090b] px-3 py-1.5">
                🔀 <strong className="text-indigo-300">{customRoutedCount}</strong> Routing Khusus
              </span>
            </div>
          </div>

          {departments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={() => setDepartmentFilter("ALL")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  departmentFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-[#09090b] text-slate-400 hover:text-white border border-white/5"
                }`}
              >
                Semua ({agents.length})
              </button>
              {departments.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartmentFilter(dept)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    departmentFilter === dept
                      ? "bg-blue-600 text-white"
                      : "bg-[#09090b] text-slate-400 hover:text-white border border-white/5"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AGENT CARDS GRID */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-52 animate-pulse rounded-2xl border border-white/10 bg-[#131316]"
              />
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#131316]/60 p-12 text-center">
            <p className="text-2xl mb-2">🤖</p>
            <p className="text-sm font-semibold text-white">
              {agents.length === 0 ? "Belum ada agen di tim Anda" : "Tidak ada agen yang cocok"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {agents.length === 0
                ? "Tambahkan agen pertama untuk mulai mendelegasikan pekerjaan."
                : "Coba ubah kata kunci pencarian atau pilih filter departemen lain."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => {
              const badge = getStatusBadge(agent.status);
              const avatar = getAgentAvatar(agent);

              return (
                <article
                  key={agent.id}
                  className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-[#131316] p-5 hover:border-blue-400/35 hover:bg-[#161820] transition"
                >
                  <div>
                    {/* TOP ROW: AVATAR + NAME + STATUS */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-xl">
                          {avatar}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-white">
                            {agent.name}
                          </h3>
                          <p className="truncate text-xs text-slate-400">
                            {agent.role}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.pill}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {agent.status}
                      </span>
                    </div>

                    {/* DEPARTMENT */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-white/10 bg-[#09090b] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                        🏢 {agent.department}
                      </span>
                    </div>

                    {/* DESCRIPTION */}
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-400 min-h-[3.2rem]">
                      {agent.description || "Belum ada deskripsi tugas khusus."}
                    </p>

                    {/* AI ROUTING BADGE */}
                    <div className="mt-3.5 rounded-xl border border-indigo-400/20 bg-indigo-500/5 px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2 text-indigo-200">
                        <span className="truncate font-semibold">
                          🔌 {getProviderLabel(agent.preferred_provider_id)}
                        </span>
                        <span className="truncate rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-100">
                          {agent.preferred_model || "⚡ Auto"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS FOOTER */}
                  <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center gap-2">
                    <Link
                      href="/ai-chat"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 transition"
                    >
                      💬 Chat
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEditModal(agent)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAgent(agent)}
                      title="Hapus agen"
                      className="inline-flex items-center justify-center rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2 text-xs text-red-300 hover:bg-red-500/15 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-500 text-center pt-2">
          Catatan: Agen yang masih terikat pada task atau Task Plan aktif tidak dapat dihapus sebelum dipindahkan.
        </p>
      </div>

      {/* SLIDE-OVER / MODAL FORM FOR CREATE & EDIT */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#131316] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#131316]/95 backdrop-blur px-6 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  {editingId ? "Edit Profil & Routing Agen" : "Rekrut Agen Spesialis Baru"}
                </p>
                <h2 className="text-lg font-bold text-white">
                  {editingId ? form.name || "Edit Agen" : "Tambah Agen Baru"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="agent-name">
                    Nama Agen
                  </label>
                  <input
                    id="agent-name"
                    required
                    maxLength={120}
                    placeholder="cth. Excel Engineer"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 py-2.5 text-sm text-white focus:border-blue-400/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="agent-status">
                    Status Ketersediaan
                  </label>
                  <select
                    id="agent-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 py-2.5 text-sm text-white focus:border-blue-400/50 focus:outline-none"
                  >
                    <option value="Standby">Standby</option>
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="agent-role">
                    Jabatan / Role
                  </label>
                  <input
                    id="agent-role"
                    required
                    maxLength={120}
                    placeholder="cth. Senior Macro & Formula Specialist"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 py-2.5 text-sm text-white focus:border-blue-400/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="agent-department">
                    Departemen
                  </label>
                  <input
                    id="agent-department"
                    required
                    maxLength={120}
                    placeholder="cth. Engineering"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 py-2.5 text-sm text-white focus:border-blue-400/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="agent-description">
                  Deskripsi Tugas & Keahlian
                </label>
                <textarea
                  id="agent-description"
                  maxLength={10000}
                  rows={3}
                  placeholder="Jelaskan spesialisasi agen agar AI merespons sesuai perannya..."
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 py-2.5 text-sm text-white focus:border-blue-400/50 focus:outline-none"
                />
              </div>

              {/* ROUTING ENDPOINT & MODEL AI */}
              {(() => {
                const targetProv = form.preferred_provider_id
                  ? providers.find((p) => p.provider_id === form.preferred_provider_id)
                  : providers.find((p) => p.is_active) || providers[0];
                let provModels: ProviderModel[] = [];
                if (targetProv?.custom_models_json) {
                  try {
                    const parsed = JSON.parse(targetProv.custom_models_json);
                    if (Array.isArray(parsed)) provModels = parsed;
                  } catch {
                    // ignore
                  }
                }
                if (
                  targetProv?.default_model &&
                  !provModels.some((m) => m.id === targetProv.default_model)
                ) {
                  provModels = [
                    { id: targetProv.default_model, label: targetProv.default_model },
                    ...provModels,
                  ];
                }
                return (
                  <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/5 p-4 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-indigo-200">
                        🔀 Routing Endpoint & Model AI
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Arahkan agen ini ke provider & model tertentu (atau biarkan mengikuti pengaturan global).
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-300" htmlFor="agent-provider">
                          Provider / Endpoint
                        </label>
                        <select
                          id="agent-provider"
                          value={form.preferred_provider_id}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              preferred_provider_id: e.target.value,
                              preferred_model: "",
                            })
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#09090b] p-2.5 text-xs text-white"
                        >
                          <option value="">🌐 Ikut Pengaturan Global</option>
                          {providers.map((p) => (
                            <option key={p.provider_id} value={p.provider_id}>
                              🔌 {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-300" htmlFor="agent-model">
                          Model AI Spesifik
                        </label>
                        <select
                          id="agent-model"
                          value={form.preferred_model}
                          onChange={(e) => setForm({ ...form, preferred_model: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-[#09090b] p-2.5 text-xs text-white"
                        >
                          <option value="">⚡ Auto (Sesuai Role / Default)</option>
                          {provModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label || m.id}
                            </option>
                          ))}
                          {form.preferred_model &&
                            !provModels.some((m) => m.id === form.preferred_model) && (
                              <option value={form.preferred_model}>{form.preferred_model}</option>
                            )}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5 transition"
                >
                  Batal
                </button>
                <button
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Buat Agen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
