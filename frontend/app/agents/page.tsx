"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

type AgentForm = Omit<Agent, "id" | "description" | "preferred_provider_id" | "preferred_model"> & {
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
  {
    label: "Koordinasi & perencanaan",
    agents: ["ai ceo"],
  },
  {
    label: "Analisis kebutuhan bisnis",
    agents: ["business analyst"],
  },
  {
    label: "Solusi Excel & spreadsheet",
    agents: ["excel engineer"],
  },
  {
    label: "Otomasi proses",
    agents: ["automation engineer"],
  },
  {
    label: "Dashboard & reporting",
    agents: ["dashboard analyst"],
  },
  {
    label: "QA & dokumentasi",
    agents: ["qa & documentation", "quality assurance"],
  },
  {
    label: "Administrasi & PMO",
    agents: ["secretary", "administration & pmo"],
  },
  {
    label: "Konten & pemasaran",
    agents: ["social media specialist", "omnichannel content"],
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [form, setForm] = useState<AgentForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const coveredCapabilities = BUSINESS_CAPABILITIES.map((capability) => ({
    ...capability,
    covered: agents.some((agent) => {
      const profile =
        `${agent.name} ${agent.role} ${agent.department}`.toLowerCase();
      return capability.agents.some((keyword) => profile.includes(keyword));
    }),
  }));

  const loadAgents = useCallback(async () => {
    const response = await fetch(`${API_URL}/agents`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Gagal memuat daftar agent.");
    }

    setAgents(data);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch(`${API_URL}/agents`),
      fetch(`${API_URL}/ai/providers`),
    ])
      .then(async ([agRes, pvRes]) => {
        const data = await agRes.json();
        if (!agRes.ok) {
          throw new Error(data.detail || "Gagal memuat daftar agent.");
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
            cause instanceof Error
              ? cause.message
              : "Tidak dapat memuat daftar agent.",
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

  function startEditing(agent: Agent) {
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
    setMessage("");
  }

  function resetForm() {
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
        editingId
          ? `${API_URL}/agents/${editingId}`
          : `${API_URL}/agents`,
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
        throw new Error(data.detail || "Gagal menyimpan agent.");
      }

      setMessage(editingId ? "Agent berhasil diperbarui." : "Agent berhasil dibuat.");
      resetForm();
      await loadAgents();
      window.dispatchEvent(new Event("vhq-branding-updated"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal menyimpan agent.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent(agent: Agent) {
    if (!window.confirm(`Hapus agent "${agent.name}"?`)) return;

    try {
      setError("");
      setMessage("");
      const response = await fetch(`${API_URL}/agents/${agent.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Gagal menghapus agent.");
      }

      if (editingId === agent.id) resetForm();
      setMessage(data.message || "Agent berhasil dihapus.");
      await loadAgents();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal menghapus agent.",
      );
    }
  }

  return (
    <section className="flex-1 min-w-0 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-blue-400">
            SOLUSI MACRO / AI AGENTS
          </p>
          <h1 className="mt-2 text-3xl font-bold">Agent Management</h1>
          <p className="mt-2 text-sm text-slate-400">
            Kelola profil dan ketersediaan specialist di Virtual HQ.
          </p>
        </header>

        {error && (
          <p role="alert" className="mb-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-5 rounded-xl bg-green-500/10 p-4 text-sm text-green-300">
            {message}
          </p>
        )}

        <section
          aria-labelledby="business-fit-title"
          className="mb-6 rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-[#131316] p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest text-indigo-300">
                KECOCOKAN DENGAN PROFIL BISNIS
              </p>
              <h2 id="business-fit-title" className="mt-2 text-lg font-semibold">
                Tim saat ini cocok untuk delivery layanan inti
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Cakupan kuat di analisis, Excel, otomasi, dashboard, QA, dan
                konten. Ini sesuai dengan layanan Solusi Macro yang tercatat di
                AI CEO.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {loading
                ? "Memuat cakupan..."
                : agents.length === 0
                  ? "Cakupan belum tersedia"
                  : `${coveredCapabilities.filter((item) => item.covered).length}/${coveredCapabilities.length} kapabilitas tercakup`}
            </span>
          </div>

          {loading ? (
            <p className="mt-4 text-xs text-slate-500">
              Memuat agent untuk memetakan cakupan bisnis...
            </p>
          ) : agents.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Cakupan belum dapat dihitung karena daftar agent kosong atau
              belum berhasil dimuat.
            </p>
          ) : (
            <>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {coveredCapabilities.map((capability) => (
                  <li
                    key={capability.label}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#09090b]/60 px-3 py-2.5 text-xs"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        capability.covered
                          ? "text-emerald-300"
                          : "text-slate-500"
                      }
                    >
                      {capability.covered ? "✓" : "—"}
                    </span>
                    <span
                      className={
                        capability.covered ? "text-slate-200" : "text-slate-500"
                      }
                    >
                      {capability.label}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2.5 text-xs leading-relaxed text-amber-100/80">
                Celah yang belum punya owner khusus: sales/CRM dan onboarding
                atau customer success. Tambahkan agent untuk area ini jika
                targetnya mencakup akuisisi dan pendampingan klien, bukan
                delivery proyek saja.
              </p>
            </>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <form
            onSubmit={handleSubmit}
            className="h-fit rounded-2xl border border-white/10 bg-[#131316] p-6"
          >
            <h2 className="mb-5 text-lg font-semibold">
              {editingId ? "Edit Agent" : "Add Agent"}
            </h2>
            <label className="mb-1 block text-sm text-slate-400" htmlFor="agent-name">
              Name
            </label>
            <input
              id="agent-name"
              required
              maxLength={120}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mb-4 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm"
            />
            <label className="mb-1 block text-sm text-slate-400" htmlFor="agent-role">
              Role
            </label>
            <input
              id="agent-role"
              required
              maxLength={120}
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="mb-4 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm"
            />
            <label className="mb-1 block text-sm text-slate-400" htmlFor="agent-department">
              Department
            </label>
            <input
              id="agent-department"
              required
              maxLength={120}
              value={form.department}
              onChange={(event) =>
                setForm({ ...form, department: event.target.value })
              }
              className="mb-4 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm"
            />
            <label className="mb-1 block text-sm text-slate-400" htmlFor="agent-status">
              Availability
            </label>
            <select
              id="agent-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="mb-4 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm"
            >
              <option>Standby</option>
              <option>Online</option>
              <option>Offline</option>
            </select>
            <label className="mb-1 block text-sm text-slate-400" htmlFor="agent-description">
              Description
            </label>
            <textarea
              id="agent-description"
              maxLength={10000}
              rows={3}
              value={form.description || ""}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              className="mb-4 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm"
            />

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
                <div className="mb-5 rounded-xl border border-indigo-400/20 bg-indigo-500/5 p-3.5 space-y-3">
                  <p className="text-xs font-bold text-indigo-200">
                    🔀 Routing Endpoint & Model AI
                  </p>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="agent-provider">
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
                      className="w-full rounded-lg border border-white/10 bg-[#09090b] p-2.5 text-xs text-white"
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
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="agent-model">
                      Model AI Spesifik
                    </label>
                    <select
                      id="agent-model"
                      value={form.preferred_model}
                      onChange={(e) =>
                        setForm({ ...form, preferred_model: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#09090b] p-2.5 text-xs text-white"
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
              );
            })()}
            <button
              disabled={saving}
              className="w-full rounded-lg bg-blue-600 p-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Agent"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="mt-2 w-full rounded-lg border border-white/10 p-3 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
            )}
          </form>

          <section className="xl:col-span-2 rounded-2xl border border-white/10 bg-[#131316] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">AI Team</h2>
              <span className="text-xs text-slate-400">{agents.length} agents</span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400">Loading agents...</p>
            ) : agents.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada agent.</p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <article
                    key={agent.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{agent.name}</h3>
                        <span className="rounded-full bg-blue-400/10 px-2 py-1 text-xs text-blue-300">
                          {agent.status}
                        </span>
                        <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] text-indigo-200">
                          {agent.preferred_provider_id ? `🔌 ${agent.preferred_provider_id}` : "🌐 Global"} ·{" "}
                          {agent.preferred_model || "⚡ Auto"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {agent.role} · {agent.department}
                      </p>
                      {agent.description && (
                        <p className="mt-2 text-xs text-slate-500">
                          {agent.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEditing(agent)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAgent(agent)}
                        className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="mt-5 text-xs text-slate-500">
              Agent yang masih dipakai task atau Task Plan tidak dapat dihapus.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
