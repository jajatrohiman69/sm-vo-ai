"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_URL } from "@/lib/api";

const SESSION_ID = "founder";

type Message = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

async function fetchChatHistory(): Promise<Message[]> {
  const response = await fetch(
    `${API_URL}/ai/chat/history?session_id=${SESSION_ID}`,
  );

  if (!response.ok) {
    throw new Error("Gagal mengambil riwayat chat.");
  }

  return response.json();
}

export default function AICEOChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    fetchChatHistory()
      .then((history) => {
        if (active) setMessages(history);
      })
      .catch(() => {
        if (active) setError("Tidak dapat memuat riwayat percakapan.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message || loading) return;

    setError("");
    setInput("");
    setLoading(true);

    setMessages((previous) => [
      ...previous,
      { role: "user", content: message },
    ]);

    try {
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          session_id: SESSION_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI CEO gagal merespons.");
      }

      if (typeof data.message !== "string") {
        throw new Error("Respons AI CEO tidak memiliki isi pesan.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.message,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm(
      "Yakin ingin menghapus seluruh riwayat percakapan?",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/ai/chat/history?session_id=${SESSION_ID}`,
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

  return (
    <main className="min-h-screen bg-[#080d1a] text-white flex">
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-white/10 p-6 flex-col">
        <div>
          <h1 className="text-xl font-bold tracking-wide">SOLUSI MACRO</h1>
          <p className="text-xs text-slate-500 mt-1">VIRTUAL HQ</p>
        </div>

        <nav className="mt-12 space-y-3 text-sm">
          <Link
            href="/"
            className="block p-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
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
            href="/ai-chat"
            className="block p-3 rounded-lg bg-blue-500/20 text-blue-300"
          >
            💬 AI CEO Chat
          </Link>
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <p className="text-xs text-slate-500">AI PROVIDER</p>
          <p className="text-sm font-medium mt-2">Claude Sonnet 5.5</p>
          <p className="text-xs text-green-400 mt-1">● OCTA Telkomsel</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <section className="flex-1 min-w-0 flex flex-col h-screen">
        {/* HEADER */}
        <header className="border-b border-white/10 px-5 md:px-8 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-400 font-semibold tracking-widest">
              SOLUSI MACRO / AI CEO
            </p>
            <h2 className="text-xl font-bold mt-1">CEO Command Center</h2>
            <p className="text-xs text-slate-500 mt-1">
              Strategic intelligence and business management
            </p>
          </div>

          <button
            onClick={clearHistory}
            disabled={loading || messages.length === 0}
            className="text-xs border border-white/10 rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10 disabled:opacity-30"
          >
            Clear Chat
          </button>
        </header>

        {/* CHAT MESSAGES */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="min-h-[55vh] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center text-3xl">
                  🤖
                </div>

                <h3 className="text-2xl font-bold mt-5">Welcome, Founder!</h3>

                <p className="text-slate-400 text-sm mt-3 max-w-lg leading-6">
                  Saya AI CEO Solusi Macro. Saya siap membantu menganalisis
                  bisnis, menyusun strategi, mengevaluasi proyek, dan mengatur
                  prioritas kerja.
                </p>

                <div className="grid sm:grid-cols-2 gap-3 mt-8 w-full max-w-xl text-left">
                  {[
                    "Analisis kondisi Virtual HQ saat ini.",
                    "Buat strategi mendapatkan 10 klien UMKM.",
                    "Apa prioritas bisnis yang harus saya kerjakan?",
                    "Evaluasi seluruh project dan task saya.",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl p-4 text-sm text-slate-300 text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={message.id ?? index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    🤖
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-[#151e30] border border-white/10 text-slate-200"
                  }`}
                >
                  <p className="text-xs font-semibold mb-2 opacity-70">
                    {message.role === "user" ? "FOUNDER" : "AI CEO"}
                  </p>

                  <div
                    className="prose prose-invert prose-sm max-w-none
  prose-headings:text-white
  prose-p:text-slate-300
  prose-strong:text-white
  prose-th:text-slate-200
  prose-td:text-slate-300
  prose-table:block prose-table:overflow-x-auto"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
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
                  🤖
                </div>
                <div className="bg-[#151e30] border border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-sm text-slate-400 animate-pulse">
                    AI CEO sedang menganalisis...
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
        <div className="border-t border-white/10 px-4 md:px-8 py-5">
          <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end bg-[#151e30] border border-white/10 rounded-2xl p-3 focus-within:border-blue-500/50">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Berikan instruksi kepada AI CEO..."
                rows={2}
                maxLength={10000}
                className="flex-1 bg-transparent outline-none resize-none text-sm text-white placeholder:text-slate-500 p-2"
              />

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-5 py-3 text-sm font-semibold"
              >
                {loading ? "..." : "Kirim ↑"}
              </button>
            </div>

            <p className="text-[11px] text-slate-600 mt-3 text-center">
              AI CEO dapat membuat kesalahan. Periksa rekomendasi sebelum
              mengambil keputusan bisnis.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
