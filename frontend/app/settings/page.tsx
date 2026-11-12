"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

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
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

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
        const res = await fetch(`${API_URL}/ai/providers`);
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

  return (
    <div className="flex-1 bg-[#090b14] text-slate-100 min-h-screen p-6 md:p-10 flex flex-col gap-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              AI Provider & Endpoint Hub
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Atur dan ganti endpoint API AI sesukamu (OCTA Telkomsel, OpenAI-Compatible, OpenRouter, Groq, Google Gemini, atau Ollama lokal). Ubah model & switch provider kapan saja tanpa restart server.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/ai-chat"
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition"
          >
            💬 Buka Chat AI
          </Link>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition"
          >
            ＋ Tambah Provider Baru
          </button>
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchActive(p.provider_id);
                        }}
                        className="shrink-0 rounded-xl border border-white/10 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30 px-3 py-1 text-[11px] font-medium text-slate-300 transition"
                      >
                        Aktifkan
                      </button>
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
                  <button
                    type="button"
                    onClick={() => handleSwitchActive(selectedProvider.provider_id)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition"
                  >
                    ⚡ Pasang Jadi Provider Utama
                  </button>
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
