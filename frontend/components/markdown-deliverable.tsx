"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./code-block";
import ArtifactCards, { parseArtifactsFromMarkdown } from "./artifact-cards";

export default function MarkdownDeliverable({
  content,
  title,
  agentName,
  completedAt,
  taskId,
}: {
  content: string;
  title?: string;
  agentName?: string;
  completedAt?: string | null;
  taskId?: number;
}) {
  const [copiedDoc, setCopiedDoc] = useState(false);
  const { cleanContent, artifacts } = parseArtifactsFromMarkdown(content);

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleDownloadMd() {
    const safeTitle = (title || "deliverable")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const blob = new Blob([cleanContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle || "vhq-deliverable"}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-b from-[#131316] to-[#090e1c] shadow-xl">
      {/* DELIVERABLE HEADER BAR */}
      <div className="flex flex-col gap-3 border-b border-white/10 bg-[#131d36]/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/30 text-lg">
            📑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Official Deliverable Document
              </span>
              {agentName && (
                <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  🤖 {agentName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {completedAt
                ? `Diselesaikan pada ${completedAt}`
                : "Laporan hasil eksekusi AI Specialist"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyAll()}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition"
          >
            {copiedDoc ? "✓ Tersalin" : "📋 Salin Dokumen"}
          </button>

          <button
            type="button"
            onClick={handleDownloadMd}
            className="flex items-center gap-1.5 rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/25 transition"
          >
            ⬇️ Unduh .MD
          </button>

          {taskId && (
            <a
              href={`/social-hub?task_id=${taskId}`}
              className="flex items-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-500/15 px-3 py-2 text-xs font-medium text-purple-200 hover:bg-purple-500/25 transition"
            >
              📡 Konversi ke Social Hub
            </a>
          )}
        </div>
      </div>

      {/* DELIVERABLE BODY */}
      <div className="p-6 md:p-8 text-sm leading-relaxed text-slate-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mt-6 mb-4 first:mt-0 text-xl font-bold text-white border-b border-white/10 pb-3">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <div className="mt-7 mb-3.5 first:mt-0 flex items-center gap-2.5 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                <h2 className="text-base font-bold text-blue-100 tracking-wide">
                  {children}
                </h2>
              </div>
            ),
            h3: ({ children }) => (
              <h3 className="mt-5 mb-2 text-sm font-bold text-white flex items-center gap-2">
                <span className="text-blue-400">▸</span>
                <span>{children}</span>
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="mt-4 mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="my-3 text-sm leading-7 text-slate-300">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="my-3 ml-5 list-disc space-y-2 text-sm text-slate-300 marker:text-blue-400">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-3 ml-5 list-decimal space-y-2 text-sm text-slate-300 marker:font-semibold marker:text-blue-400">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="pl-1 leading-7">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-white">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-slate-200">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-4 rounded-r-xl border-l-4 border-blue-400 bg-blue-500/5 px-4 py-3 text-xs italic text-slate-300">
                {children}
              </blockquote>
            ),
            hr: () => <hr className="my-6 border-white/10" />,
            table: ({ children }) => (
              <div className="my-5 overflow-x-auto rounded-xl border border-white/10 bg-[#09090b] shadow-inner">
                <table className="w-full border-collapse text-left text-xs">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="border-b border-white/10 bg-[#131316] text-[11px] font-bold uppercase tracking-wider text-blue-200">
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-white/5">{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr className="hover:bg-white/[0.03] transition">{children}</tr>
            ),
            th: ({ children }) => (
              <th className="px-4 py-3 font-semibold whitespace-nowrap">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-3 text-slate-300 align-top leading-6">
                {children}
              </td>
            ),
            pre: ({ children }) => (
              <CodeBlock preClassName="overflow-x-auto p-4 text-xs leading-6 text-blue-100">
                {children}
              </CodeBlock>
            ),
            code: ({ className, children }) => {
              const isBlock = Boolean(className);
              if (isBlock) {
                return (
                  <code className="font-mono text-xs text-emerald-300">
                    {children}
                  </code>
                );
              }
              return (
                <code className="rounded-md border border-blue-400/20 bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs text-blue-300">
                  {children}
                </code>
              );
            },
          }}
        >
          {cleanContent}
        </ReactMarkdown>

        <ArtifactCards artifacts={artifacts} />
      </div>
    </div>
  );
}
