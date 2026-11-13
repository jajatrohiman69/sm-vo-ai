"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  API_URL,
  DEFAULT_WORKSPACE_SETTINGS,
  resolveLogoUrl,
  type WorkspaceSettings,
} from "@/lib/api";

type ProviderModel = {
  id: string;
  label?: string;
  description?: string;
};

type ProviderConfig = {
  id: number;
  provider_id: string;
  name: string;
  base_url: string;
  api_key: string;
  default_model: string;
  custom_models_json?: string | null;
  is_active: boolean;
  status: string;
  last_tested_at?: string | null;
  updated_at?: string | null;
};

export default function AISettingsPage() {
  const [activeTab, setActiveTab] = useState<"providers" | "branding">("providers");
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Branding state
  const [branding, setBranding] = useState<WorkspaceSettings>(
    DEFAULT_WORKSPACE_SETTINGS,
  );
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Selected provider to edit
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [editName, setEditName] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editDefaultModel, setEditDefaultModel] = useState("");
  const [editModelsJson, setEditModelsJson] = useState("");
  const [saving, setSaving] = useState(false);

  // Testing connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    detected_models?: ProviderModel[];
  } | null>(null);

  // New provider modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("https://");
  const [newApiKey, setNewApiKey] = useState("");
  const [newDefaultModel, setNewDefaultModel] = useState("");
  const [adding, setAdding] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 5000);
  }

  function selectForEdit(p: ProviderConfig) {
    setSelectedProvider(p);
    setEditName(p.name);
    setEditBaseUrl(p.base_url);
    setEditApiKey(p.api_key || "");
    setEditDefaultModel(p.default_model);
    setEditModelsJson(p.custom_models_json || "");
    setTestResult(null);
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchInitialProviders() {
      try {
        const [res, wsRes] = await Promise.all([
          fetch(`${API_URL}/ai/providers`),
          fetch(`${API_URL}/workspace/settings`),
        ]);
        if (!res.ok) throw new Error("Gagal mengambil daftar provider AI.");
        const data = await res.json();
        if (!Array.isArray(data.providers)) {
          throw new Error("Respons daftar provider AI tidak valid.");
        }
        if (!isMounted) return;
        const list: ProviderConfig[] = data.providers;
        setProviders(list);

        const current = list.find(
          (p: ProviderConfig) => p.is_active || p.provider_id === data.active_provider_id
        ) || list[0] || null;

        if (current) {
          selectForEdit(current);
        }

        if (wsRes.ok) {
          const wsData = await wsRes.json();
          if (wsData?.office_name && isMounted) setBranding(wsData);
        }
      } catch (err) {
        if (!isMounted) return;
        showToast(err instanceof Error ? err.message : "Gagal memuat provider.", "error");
      } finally {
        if (isMounted) setLoadingProviders(false);
      }
    }

    void fetchInitialProviders();

    return () => {
      isMounted = false;
    };
  }, []);

  async function reloadProviders() {
    try {
      const res = await fetch(`${API_URL}/ai/providers`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.providers || [];
      setProviders(list);

      const current = list.find(
        (p: ProviderConfig) => p.provider_id === (selectedProvider?.provider_id || data.active_provider_id)
      ) || list[0] || null;

      if (current) {
        selectForEdit(current);
      }
    } catch {
      // ignore
    }
  }

  async function handleSwitchActive(providerId: string) {
    try {
      const res = await fetch(`${API_URL}/ai/providers/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal mengaktifkan provider.");
      showToast(`✨ Provider aktif diubah ke: ${data.active_provider?.name}`);
      await reloadProviders();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal switch provider.", "error");
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/ai/providers/${selectedProvider.provider_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          base_url: editBaseUrl,
          api_key: editApiKey,
          default_model: editDefaultModel,
          custom_models_json: editModelsJson || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal menyimpan konfigurasi.");
      showToast(`✅ Konfigurasi ${editName} berhasil disimpan!`);
      await reloadProviders();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEndpoint() {
    if (!editBaseUrl) {
      showToast("Base URL tidak boleh kosong.", "error");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/ai/providers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: editBaseUrl,
          api_key: editApiKey,
          model: editDefaultModel,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        showToast(data.message);
      } else {
        showToast(data.message, "error");
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Gagal menghubungi endpoint.",
      });
      showToast("Koneksi gagal dihubungi.", "error");
    } finally {
      setTesting(false);
    }
  }

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!newId || !newName || !newBaseUrl || !newDefaultModel) {
      showToast("Harap isi semua field wajib.", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/ai/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: newId,
          name: newName,
          base_url: newBaseUrl,
          api_key: newApiKey,
          default_model: newDefaultModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal menambah provider.");
      showToast(`🎉 Provider '${newName}' berhasil ditambahkan!`);
      setIsAddModalOpen(false);
      setNewId("");
      setNewName("");
      setNewBaseUrl("https://");
      setNewApiKey("");
      setNewDefaultModel("");
      await reloadProviders();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menambahkan provider.", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteProvider(providerId: string, providerName: string) {
    if (!window.confirm(`Hapus provider '${providerName}'? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/ai/providers/${providerId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal menghapus provider.");
      showToast(`🗑️ Provider '${providerName}' berhasil dihapus.`);

      const resList = await fetch(`${API_URL}/ai/providers`);
      if (resList.ok) {
        const listData = await resList.json();
        const updatedList: ProviderConfig[] = listData.providers || [];
        setProviders(updatedList);
        if (selectedProvider?.provider_id === providerId) {
          const next = updatedList.find((p) => p.is_active) || updatedList[0] || null;
          if (next) selectForEdit(next);
          else setSelectedProvider(null);
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menghapus provider.", "error");
    }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
    try {
      const res = await fetch(`${API_URL}/workspace/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal menyimpan branding kantor.");
      if (data.settings) setBranding(data.settings);
      window.dispatchEvent(new Event("vhq-branding-updated"));
      showToast("✅ Branding & teks kantor 3D berhasil diperbarui!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menyimpan branding.", "error");
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/workspace/logo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal mengunggah logo.");
      if (data.settings) setBranding(data.settings);
      window.dispatchEvent(new Event("vhq-branding-updated"));
      showToast("🖼️ Logo kantor custom berhasil diunggah dan dipasang!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal upload logo.", "error");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleResetLogo() {
    setSavingBranding(true);
    try {
      const res = await fetch(`${API_URL}/workspace/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: "/solusi-macro-logo.png" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gagal mereset logo.");
      if (data.settings) setBranding(data.settings);
      window.dispatchEvent(new Event("vhq-branding-updated"));
      showToast("🔄 Logo dikembalikan ke default.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal reset logo.", "error");
    } finally {
      setSavingBranding(false);
    }
  }

  return (
    <div className="flex-1 bg-[#090b14] text-slate-100 min-h-screen p-6 md:p-10 flex flex-col gap-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Pengaturan VHQ & AI Hub
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Atur endpoint API AI (OCTA, Gemini, OpenAI-Compatible, Groq, Ollama) serta kustomisasi nama kantor, logo brand, dan teks papan 3D langsung dari browser.
          </p>
          {/* TAB SWITCHER */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab("providers")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "providers"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              🔌 Provider & Endpoint AI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("branding")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "branding"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              🎨 Branding Kantor & Teks 3D
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition"
          >
            🏢 Lihat 3D Office
          </Link>
          {activeTab === "providers" && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition"
            >
              ＋ Tambah Provider Baru
            </button>
          )}
        </div>
      </div>

      {/* TOAST ALERT */}
      {toastMessage && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-medium backdrop-blur-xl transition ${
            toastType === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {toastMessage}
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKBENCH */}
      {activeTab === "providers" && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: PROVIDERS LIST (4 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {loadingProviders
                ? "Memuat daftar provider..."
                : `Daftar Provider Terdaftar (${providers.length})`}
            </h3>
            <span className="text-[10px] text-slate-500">Klik untuk edit/aktifkan</span>
          </div>

          <div className="space-y-3">
            {!loadingProviders && providers.length === 0 && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs text-amber-200">
                Daftar provider kosong atau gagal dimuat. Periksa koneksi backend dan database.
              </div>
            )}
            {providers.map((p) => {
              const isSelected = selectedProvider?.provider_id === p.provider_id;
              const isActive = p.is_active;

              return (
                <div
                  key={p.provider_id}
                  onClick={() => selectForEdit(p)}
                  className={`rounded-2xl border p-4.5 cursor-pointer transition-all ${
                    isSelected
                      ? "border-indigo-400/80 bg-indigo-950/25 shadow-xl shadow-indigo-950/50"
                      : "border-white/10 bg-[#121422] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isActive ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-slate-600"
                          }`}
                        />
                        <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                        {p.base_url}
                      </p>
                    </div>

                    {isActive ? (
                      <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        ⚡ AKTIF
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchActive(p.provider_id);
                          }}
                          className="rounded-xl border border-white/10 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition"
                        >
                          Aktifkan
                        </button>
                        <button
                          type="button"
                          title={`Hapus ${p.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteProvider(p.provider_id, p.name);
                          }}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/25 px-2 py-1 text-[11px] text-red-300 transition"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      Default Model:{" "}
                      <span className="font-semibold text-slate-200">{p.default_model}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {p.api_key ? "🔑 API Key Ada" : "🔓 No Auth"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL & TEST BENCH (7 COLS) */}
        <div className="lg:col-span-7">
          {selectedProvider ? (
            <div className="rounded-3xl border border-white/10 bg-[#121422] p-6 md:p-8 shadow-2xl flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-white">
                      Konfigurasi: {selectedProvider.name}
                    </h2>
                    {selectedProvider.is_active && (
                      <span className="rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        Active Engine
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ID Provider: <code className="text-indigo-300">{selectedProvider.provider_id}</code>
                  </p>
                </div>

                {!selectedProvider.is_active && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchActive(selectedProvider.provider_id)}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition"
                    >
                      ⚡ Pasang Jadi Provider Utama
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteProvider(
                          selectedProvider.provider_id,
                          selectedProvider.name
                        )
                      }
                      className="rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 px-3.5 py-2 text-xs font-bold text-red-300 transition"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nama Provider
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Model Default
                    </label>
                    <input
                      type="text"
                      required
                      value={editDefaultModel}
                      onChange={(e) => setEditDefaultModel(e.target.value)}
                      placeholder="e.g. DeepSeek V4 Flash Mod, gpt-4o, claude-3-5-sonnet"
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Base URL API (OpenAI-Compatible `/v1` endpoint)
                  </label>
                  <input
                    type="text"
                    required
                    value={editBaseUrl}
                    onChange={(e) => setEditBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1 atau http://localhost:11434/v1"
                    className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs font-mono text-indigo-200 outline-none focus:border-indigo-400"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pastikan diakhiri dengan <code>/v1</code> (tanpa trailing slash di ujung).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    API Key / Secret Token
                  </label>
                  <input
                    type="text"
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    placeholder="sk-xxxx atau bsk_live_xxxx (kosongkan jika tanpa auth/ollama)"
                    className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Daftar Model (Format JSON Opsional)
                    </label>
                    {testResult?.detected_models && testResult.detected_models.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const models = testResult.detected_models || [];
                          const jsonStr = JSON.stringify(models, null, 2);
                          setEditModelsJson(jsonStr);
                          if (models[0]?.id) {
                            setEditDefaultModel(models[0].id);
                          }
                          showToast("Daftar model otomatis disalin dari hasil deteksi API!");
                        }}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                      >
                        ⚡ Pakai {testResult.detected_models.length} Model yang Terdeteksi
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={editModelsJson}
                    onChange={(e) => setEditModelsJson(e.target.value)}
                    placeholder='[{"id": "DeepSeek V4 Flash Mod", "label": "DeepSeek V4"}, {"id": "Gemini 3.8 Flash", "label": "Gemini 3.8"}]'
                    className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs font-mono text-slate-300 outline-none focus:border-indigo-400"
                  />
                </div>

                {/* TEST RESULT BOX */}
                {testResult && (
                  <div
                    className={`rounded-2xl border p-4 text-xs ${
                      testResult.success
                        ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                        : "border-red-500/30 bg-red-950/20 text-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span>{testResult.success ? "✅" : "❌"}</span>
                      <span>{testResult.message}</span>
                    </div>

                    {testResult.detected_models && testResult.detected_models.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-white/10">
                        <span className="font-semibold text-slate-300">
                          {testResult.detected_models.length} Model Terdeteksi dari API:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {testResult.detected_models.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setEditDefaultModel(m.id);
                                showToast(`Model default diset ke: ${m.id}`);
                              }}
                              className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 px-2 py-1 text-[10px] font-mono text-slate-200 transition"
                            >
                              {m.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleTestEndpoint}
                    disabled={testing}
                    className="rounded-xl border border-indigo-400/30 bg-indigo-500/15 hover:bg-indigo-500/25 px-4 py-2.5 text-xs font-bold text-indigo-200 transition disabled:opacity-50"
                  >
                    {testing ? "Sedang Menguji Endpoint..." : "🔍 Tes Koneksi & Deteksi Model"}
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition disabled:opacity-50"
                  >
                    {saving ? "Menyimpan..." : "💾 Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#121422] p-12 text-center text-slate-400">
              Pilih salah satu provider di sebelah kiri untuk melihat dan mengubah konfigurasi.
            </div>
          )}
        </div>
      </div>
      )}

      {/* BRANDING KANTOR & NAMA AGEN TAB */}
      {activeTab === "branding" && (
        <div className="flex flex-col gap-8">
          {/* SECTION 1: IDENTITAS & LOGO + TEKS 3D */}
          <form onSubmit={handleSaveBranding} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: IDENTITAS & LOGO */}
            <div className="lg:col-span-6 rounded-3xl border border-white/10 bg-[#121422] p-6 shadow-xl space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🏢</span> Identitas & Logo Kantor
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tampil di sidebar, judul halaman, dan neon sign besar di dinding kantor 3D.
                </p>
              </div>

              {/* LOGO UPLOADER */}
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[#090b14] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveLogoUrl(branding.logo_url)}
                  alt="Preview Logo Kantor"
                  className="h-16 w-16 rounded-xl object-cover border border-white/15 bg-black/30"
                />
                <div className="flex-1 min-w-[200px] space-y-2">
                  <p className="text-xs font-semibold text-slate-200">
                    Logo Brand / Perusahaan
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg"
                      onChange={handleUploadLogo}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white transition disabled:opacity-50"
                    >
                      {uploadingLogo ? "Mengunggah..." : "📤 Upload Logo Baru"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-slate-300 transition"
                    >
                      Reset Default
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Format PNG/JPG/WebP/SVG, maksimal 5MB. Disarankan rasio 1:1 (persegi).
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nama Office / Brand
                </label>
                <input
                  type="text"
                  required
                  value={branding.office_name}
                  onChange={(e) => setBranding({ ...branding, office_name: e.target.value })}
                  placeholder="Contoh: Solusi Macro"
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Sub-judul Dinding 3D
                </label>
                <input
                  type="text"
                  value={branding.office_subtitle}
                  onChange={(e) => setBranding({ ...branding, office_subtitle: e.target.value })}
                  placeholder="Contoh: Excel · Dashboard · Otomasi"
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Badge / Tagline Sidebar
                </label>
                <input
                  type="text"
                  value={branding.office_badge}
                  onChange={(e) => setBranding({ ...branding, office_badge: e.target.value })}
                  placeholder="Contoh: Virtual Office · AI Team"
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {/* RIGHT: KATA-KATA DI RUANGAN 3D */}
            <div className="lg:col-span-6 rounded-3xl border border-white/10 bg-[#121422] p-6 shadow-xl space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>✨</span> Kata-Kata & Quotes di Kantor 3D
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ubah teks pada layar LED besar dan papan tulis kapur di dalam ruangan 3D.
                </p>
              </div>

              <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4 space-y-3">
                <p className="text-xs font-bold text-purple-200">
                  📺 Layar LED Besar Dinding
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Baris 1 (Besar)</label>
                    <input
                      type="text"
                      value={branding.led_line_1}
                      onChange={(e) => setBranding({ ...branding, led_line_1: e.target.value })}
                      placeholder="DREAM IT"
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Baris 2</label>
                    <input
                      type="text"
                      value={branding.led_line_2}
                      onChange={(e) => setBranding({ ...branding, led_line_2: e.target.value })}
                      placeholder="MAKE IT REAL"
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-200">
                  🖍️ Papan Tulis Kapur (Standing Board)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Baris 1</label>
                    <input
                      type="text"
                      value={branding.chalk_line_1}
                      onChange={(e) => setBranding({ ...branding, chalk_line_1: e.target.value })}
                      placeholder="Good"
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Baris 2</label>
                    <input
                      type="text"
                      value={branding.chalk_line_2}
                      onChange={(e) => setBranding({ ...branding, chalk_line_2: e.target.value })}
                      placeholder="Vibes"
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Baris 3</label>
                    <input
                      type="text"
                      value={branding.chalk_line_3}
                      onChange={(e) => setBranding({ ...branding, chalk_line_3: e.target.value })}
                      placeholder="Only"
                      className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingBranding}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition disabled:opacity-50"
                >
                  {savingBranding ? "Menyimpan..." : "💾 Simpan Branding & Teks 3D"}
                </button>
              </div>
            </div>
          </form>

          {/* SHORTCUT KE KELOLA TIM AI */}
          <div className="rounded-3xl border border-indigo-400/20 bg-indigo-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span> Kustomisasi Nama, Jabatan & Routing Model Agen AI
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pengelolaan profil lengkap ke-8 agen AI (termasuk ubah nama 3D, role, deskripsi, dan routing provider/model khusus per agen) kini terpusat di menu <strong>Kelola Tim</strong>.
              </p>
            </div>
            <Link
              href="/agents"
              className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition"
            >
              🤖 Buka Menu Kelola Tim →
            </Link>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PROVIDER BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#121422] p-6 md:p-8 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white">＋ Daftarkan Provider AI Baru</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProvider} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ID Provider Unik (Huruf kecil, tanpa spasi)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. openrouter-pro, local-ollama, groq-fast"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Tampilan Provider
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OpenRouter AI Gateway"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base URL API (/v1)
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://api.garapinaja.web.id/v1 atau http://localhost:11434/v1"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  API Key (Opsional jika tanpa autentikasi)
                </label>
                <input
                  type="text"
                  placeholder="sk-xxxx atau bsk_live_xxxx"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Model Default
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DeepSeek V4 Flash Mod atau llama3:latest"
                  value={newDefaultModel}
                  onChange={(e) => setNewDefaultModel(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090b14] px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition"
                >
                  {adding ? "Menambahkan..." : "Simpan Provider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
