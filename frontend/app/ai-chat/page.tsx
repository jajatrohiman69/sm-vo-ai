"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/code-block";
import { PastedChips, usePastedBlocks } from "@/components/pasted-blocks";
import ArtifactCards, {
  parseArtifactsFromMarkdown,
} from "@/components/artifact-cards";
import { API_URL, uploadAttachment } from "@/lib/api";
import type { UploadedAttachment } from "@/lib/api";

type Agent = {
  id: number;
  name: string;
  role: string;
  department: string;
  status: string;
  description: string | null;
};

type Project = {
  id: number;
  name: string;
  status: string;
};

type Message = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  model_used?: string;
  created_at?: string;
};

type AIModel = {
  id: string;
  label: string;
  description?: string;
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

const rolePrompts: Record<string, string[]> = {
  "AI CEO": [
    "Analisis kondisi workspace saat ini.",
    "Buat strategi mendapatkan 10 klien UMKM.",
    "Apa prioritas bisnis yang harus saya kerjakan minggu ini?",
    "Evaluasi seluruh project dan task yang sedang berjalan.",
  ],
  Secretary: [
    "Susun SOP administrasi penerimaan klien baru.",
    "Buat template notulensi meeting dan jadwal mingguan proyek.",
  ],
  "Business Analyst": [
    "Identifikasi kebutuhan bisnis untuk sistem pelaporan UMKM ritel.",
    "Susun Business Requirement Document (BRD) untuk otomasi stok.",
  ],
  "Excel Engineer": [
    "Buatkan formula Excel dinamis untuk rekapitulasi penjualan bulanan.",
    "Rancang struktur workbook kasir dan stok barang otomatis.",
  ],
  "Automation Engineer": [
    "Rancang alur otomasi pengiriman laporan harian dari spreadsheet ke email.",
    "Apa proses manual di proyek ini yang paling berdampak untuk diotomasi?",
  ],
  "Dashboard Analyst": [
    "Tentukan KPI utama yang wajib tampil di Executive Dashboard penjualan.",
    "Rancang tata letak visualisasi dashboard performa operasional.",
  ],
  "QA & Documentation": [
    "Buat checklist Quality Assurance untuk pengujian template Excel klien.",
    "Susun panduan pengguna (User Guide) yang mudah dipahami klien UMKM.",
  ],
  "Social Media Specialist": [
    "Susun kalender konten 7 hari untuk Facebook Page, IG, YouTube, TikTok, dan Threads.",
    "Buat utas Threads & naskah TikTok tentang manfaat otomasi Excel bagi UMKM.",
  ],
};

function buildSessionId(agent: Agent | null, projectId: string): string {
  const base =
    !agent || agent.name.toUpperCase() === "AI CEO"
      ? "founder"
      : `agent-${agent.id}`;
  return projectId ? `${base}-project-${projectId}` : base;
}

async function parseApiResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const body = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(body) as unknown;
  } catch {
    throw new Error(
      response.ok
        ? "Server mengembalikan respons non-JSON."
        : `Server gagal merespons dengan benar (HTTP ${response.status}).`,
    );
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Format respons server tidak valid.");
  }

  return data as Record<string, unknown>;
}

async function fetchChatHistory(sessionId: string): Promise<Message[]> {
  const response = await fetch(
    `${API_URL}/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`,
  );

  if (!response.ok) {
    throw new Error("Gagal mengambil riwayat chat.");
  }

  return response.json();
}

export default function AICEOChatPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([
    {
      id: "auto",
      label: "⚡ Smart Multi-Model (Optimal per Agent)",
    },
  ]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("auto");

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const pasted = usePastedBlocks();

  useEffect(() => {
    let active = true;

    fetch(`${API_URL}/ai/models`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Gagal memuat daftar model AI.");
        }
        const data = await response.json();
        if (active && Array.isArray(data.models)) {
          setAvailableModels(data.models);
        }
      })
      .catch(() => {
        if (active) {
          setError("Gagal memuat daftar model AI.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Load Agents & Projects
  useEffect(() => {
    let active = true;

    Promise.all([fetch(`${API_URL}/agents`), fetch(`${API_URL}/projects`)])
      .then(async ([agentsRes, projectsRes]) => {
        const agentsData = agentsRes.ok ? await agentsRes.json() : [];
        const projectsData = projectsRes.ok ? await projectsRes.json() : [];

        if (!active) return;

        const validAgents: Agent[] = Array.isArray(agentsData)
          ? agentsData
          : [];
        setAgents(validAgents);
        setProjects(Array.isArray(projectsData) ? projectsData : []);

        const ceo = validAgents.find(
          (a) => a.name.toUpperCase() === "AI CEO",
        );
        if (ceo) {
          setSelectedAgentId(String(ceo.id));
        } else if (validAgents.length > 0) {
          setSelectedAgentId(String(validAgents[0].id));
        }
      })
      .catch(() => {
        // fallback silently
      });

    return () => {
      active = false;
    };
  }, []);

  const activeAgent =
    agents.find((a) => String(a.id) === selectedAgentId) ?? null;
  const activeProject =
    projects.find((p) => String(p.id) === selectedProjectId) ?? null;
  const sessionId = buildSessionId(activeAgent, selectedProjectId);
  const historyLoading = loadedSessionId !== sessionId;
  const selectedModelInfo = availableModels.find(
    (model) => model.id === selectedModel,
  );

  // Load chat history whenever sessionId changes
  useEffect(() => {
    let active = true;

    fetchChatHistory(sessionId)
      .then((history) => {
        if (active) {
          setMessages(history);
          setError("");
          setLoadedSessionId(sessionId);
        }
      })
      .catch(() => {
        if (active) {
          setError("Tidak dapat memuat riwayat percakapan.");
          setLoadedSessionId(sessionId);
        }
      });

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (
      (!message && attachments.length === 0 && pasted.blocks.length === 0) ||
      loading ||
      uploadingFiles
    ) {
      return;
    }
    const baseMessage =
      message ||
      (pasted.blocks.length > 0
        ? "Tolong analisis teks/kode berikut."
        : "Tolong analisis file yang saya lampirkan.");
    const prompt = pasted.compose(baseMessage);
    const visibleMessage =
      attachments.length > 0
        ? `${prompt}\n\n📎 ${attachments.map((file) => file.filename).join(", ")}`
        : prompt;

    setError("");
    setAttachmentError("");
    setInput("");
    pasted.clear();
    setLoading(true);

    setMessages((previous) => [
      ...previous,
      { role: "user", content: visibleMessage },
    ]);

    try {
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          session_id: sessionId,
          agent_id: activeAgent ? activeAgent.id : null,
          project_id: selectedProjectId ? Number(selectedProjectId) : null,
          model: selectedModel,
          attachment_ids: attachments.map((file) => file.file_id),
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "AI Agent gagal merespons.",
        );
      }

      const assistantMessage = data.message;
      if (typeof assistantMessage !== "string") {
        throw new Error("Respons AI Agent tidak memiliki isi pesan.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: assistantMessage,
          model_used:
            typeof data.model_used === "string" ? data.model_used : undefined,
        },
      ]);
      setAttachments([]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    const remainingSlots = Math.max(0, 5 - attachments.length);
    const files = selectedFiles.slice(0, remainingSlots);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    setAttachmentError(
      selectedFiles.length > remainingSlots
        ? "Maksimal 5 file lampiran."
        : "",
    );
    setUploadingFiles(true);
    try {
      for (const file of files) {
        const attachment = await uploadAttachment(file);
        setAttachments((previous) => [...previous, attachment]);
      }
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Gagal mengunggah file.",
      );
    } finally {
      setUploadingFiles(false);
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm(
      `Yakin ingin menghapus riwayat percakapan dengan ${activeAgent?.name ?? "AI CEO"}?`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/ai/chat/history?session_id=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("Gagal menghapus riwayat.");
      }

      setMessages([]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus riwayat.");
    }
  }

  const agentName = activeAgent?.name ?? "AI CEO";
  const agentIcon = agentIcons[agentName] ?? "🤖";
  const suggestions =
    rolePrompts[agentName] ?? rolePrompts["AI CEO"];

  return (
    <section className="flex-none w-full min-w-0 flex flex-col h-[calc(100dvh-57px)] md:h-screen max-h-screen overflow-hidden bg-[#080d1a]">
      {/* HEADER & AGENT / PROJECT SELECTOR */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 px-5 md:px-8 py-3.5 space-y-2.5 bg-[#131316]/95 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-blue-400 font-semibold tracking-widest uppercase">
              SOLUSI MACRO / DIRECT AGENT ROOM
            </p>
            <div className="flex items-center gap-2.5 mt-1">
              <span className="text-2xl">{agentIcon}</span>
              <div>
                <h2 className="text-xl font-bold">{agentName}</h2>
                <p className="text-xs text-slate-400">
                  {activeAgent
                    ? `${activeAgent.role} · ${activeAgent.department}`
                    : "Strategic intelligence and business management"}
                  {activeProject ? ` · 📁 Proyek: ${activeProject.name}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 outline-none focus:border-amber-400"
              title={
                selectedModelInfo?.description ??
                "Pilih model AI yang akan digunakan."
              }
            >
              {availableModels.map((model) => (
                <option
                  key={model.id}
                  value={model.id}
                  className="bg-[#09090b] text-white"
                >
                  {model.label}
                </option>
              ))}
            </select>

            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#131316] px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-400"
            >
              <option value="">🌐 Konteks: Seluruh workspace</option>
              {projects.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  📁 Fokus Proyek: {project.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearHistory}
              disabled={loading || messages.length === 0}
              className="text-xs border border-white/10 rounded-xl px-3 py-2 text-slate-300 hover:bg-white/10 disabled:opacity-30"
            >
              🗑️ Clear Chat
            </button>
          </div>
        </div>

        {/* AGENT TABS */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {agents.map((agent) => {
              const selected = String(agent.id) === selectedAgentId;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(String(agent.id))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                    selected
                      ? "border-blue-400 bg-blue-500/20 text-blue-200"
                      : "border-white/10 bg-[#131316]/60 text-slate-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  <span>{agentIcons[agent.name] ?? "🤖"}</span>
                  <span>{agent.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* CHAT MESSAGES */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {historyLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Memuat ruang diskusi {agentName}...
            </div>
          ) : messages.length === 0 ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center text-3xl">
                {agentIcon}
              </div>

              <h3 className="text-2xl font-bold mt-5">
                Diskusi bersama {agentName}
              </h3>

              <p className="text-slate-400 text-sm mt-2 max-w-lg leading-6">
                {activeAgent?.description ||
                  "Siap membantu menganalisis bisnis, menyusun strategi, mengevaluasi proyek, dan mengatur prioritas kerja."}
              </p>

              {activeProject && (
                <span className="mt-3 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                  📁 Fokus Konteks Proyek: {activeProject.name}
                </span>
              )}

              <div className="grid sm:grid-cols-2 gap-3 mt-8 w-full max-w-xl text-left">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl p-4 text-sm text-slate-300 text-left transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={`${sessionId}-${message.id ?? "idx"}-${index}`}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  {agentIcon}
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-[#131316] border border-white/10 text-slate-200"
                }`}
              >
                <p className="text-xs font-semibold mb-2 opacity-70 uppercase">
                  {message.role === "user" ? "FOUNDER" : agentName}
                  {message.model_used && (
                    <span className="ml-2 normal-case font-normal text-slate-400">
                      · {message.model_used}
                    </span>
                  )}
                </p>

                <div className="text-sm leading-relaxed text-slate-200 space-y-2">
                  {(() => {
                    const { cleanContent, artifacts } =
                      message.role === "assistant"
                        ? parseArtifactsFromMarkdown(message.content)
                        : { cleanContent: message.content, artifacts: [] };
                    return (
                      <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="mt-4 mb-2 first:mt-0 text-lg font-bold text-white border-b border-white/10 pb-2">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mt-4 mb-2 first:mt-0 text-base font-bold text-blue-200">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mt-3 mb-1.5 text-sm font-bold text-white">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="my-2 text-sm leading-6 text-slate-200">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-slate-200 marker:text-blue-400">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="my-2 ml-5 list-decimal space-y-1 text-sm text-slate-200 marker:text-blue-400">
                          {children}
                        </ol>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-white">
                          {children}
                        </strong>
                      ),
                      table: ({ children }) => (
                        <div className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-[#09090b]">
                          <table className="w-full border-collapse text-left text-xs">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="border-b border-white/10 bg-[#131316] text-[11px] font-bold uppercase text-blue-200">
                          {children}
                        </thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="divide-y divide-white/5">
                          {children}
                        </tbody>
                      ),
                      th: ({ children }) => (
                        <th className="px-3 py-2 font-semibold whitespace-nowrap">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3 py-2 text-slate-300 align-top">
                          {children}
                        </td>
                      ),
                      pre: ({ children }) => (
                        <CodeBlock preClassName="overflow-x-auto p-3 text-xs leading-5 text-emerald-300">
                          {children}
                        </CodeBlock>
                      ),
                      code: ({ className, children }) => {
                        if (className) {
                          return <code className="font-mono">{children}</code>;
                        }
                        return (
                          <code className="rounded bg-blue-500/15 px-1.5 py-0.5 font-mono text-xs text-blue-200">
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {cleanContent}
                  </ReactMarkdown>
                        {message.role === "assistant" && (
                          <ArtifactCards artifacts={artifacts} />
                        )}
                      </>
                    );
                  })()}

                  {message.role === "assistant" && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(message.content)
                        }
                        className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] text-slate-300 transition"
                      >
                        📋 Salin
                      </button>
                      <Link
                        href={`/social-hub?topic=${encodeURIComponent(
                          `Buat konten edukasi & promosi berdasarkan strategi ini:\n\n${message.content.slice(0, 600)}`,
                        )}`}
                        className="rounded-lg border border-purple-400/30 bg-purple-500/15 hover:bg-purple-500/25 px-2.5 py-1 text-[11px] font-semibold text-purple-200 transition"
                      >
                        📡 Jadikan Konten 5 Sosmed →
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {message.role === "user" && (
                <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-700 flex items-center justify-center">
                  👤
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                {agentIcon}
              </div>
              <div className="bg-[#131316] border border-white/10 rounded-2xl px-4 py-3">
                <p className="text-sm text-slate-400 animate-pulse">
                  {agentName} sedang menyiapkan jawaban...
                </p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        </div>
      )}

      {/* INPUT */}
      <div className="shrink-0 border-t border-white/10 px-4 md:px-8 py-3 bg-[#080d1a]/95 backdrop-blur-md">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          {pasted.blocks.length > 0 && (
            <div className="mb-2">
              <PastedChips
                blocks={pasted.blocks}
                onRemove={pasted.remove}
                disabled={loading}
              />
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-[#121624] px-3 py-2 shadow-lg focus-within:border-blue-400/60 focus-within:ring-1 focus-within:ring-blue-400/20 transition">
            <button
              type="button"
              aria-label="Upload lampiran"
              title="Upload Excel, CSV, atau gambar"
              onClick={() => fileInputRef.current?.click()}
              disabled={
                loading || uploadingFiles || attachments.length >= 5
              }
              className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {uploadingFiles ? "…" : "📎"}
            </button>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={pasted.onPaste}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={`Kirim instruksi atau diskusi ke ${agentName}...`}
              rows={1}
              maxLength={10000}
              className="flex-1 bg-transparent outline-none resize-none text-sm leading-5 text-white placeholder:text-slate-500 py-1.5 px-1 max-h-28 overflow-y-auto"
            />

            <button
              type="submit"
              disabled={
                loading ||
                uploadingFiles ||
                (!input.trim() &&
                  attachments.length === 0 &&
                  pasted.blocks.length === 0)
              }
              className="shrink-0 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 text-xs font-semibold text-white shadow-sm transition"
            >
              {loading ? "..." : "Kirim ↑"}
            </button>
          </div>
          {(attachments.length > 0 || attachmentError) && (
            <div className="mt-2 space-y-2">
              {attachments.map((file) => (
                <span
                  key={file.file_id}
                  className="mr-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
                >
                  <span className="max-w-[240px] truncate">📎 {file.filename}</span>
                  <button
                    type="button"
                    aria-label={`Hapus ${file.filename}`}
                    disabled={loading}
                    onClick={() =>
                      setAttachments((previous) =>
                        previous.filter((item) => item.file_id !== file.file_id),
                      )
                    }
                    className="text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {attachmentError && (
                <p role="alert" className="text-xs text-red-300">
                  {attachmentError}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
