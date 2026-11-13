"use client";

import {
  isValidElement,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (isValidElement(node)) {
    return nodeToText(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
    );
  }
  return "";
}

function languageOf(node: ReactNode): string {
  const first = Array.isArray(node) ? node[0] : node;
  if (isValidElement(first)) {
    const cls = (first as ReactElement<{ className?: string }>).props
      .className;
    const match = /language-([\w+#-]+)/.exec(cls ?? "");
    if (match) return match[1];
  }
  return "code";
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback untuk konteks non-HTTPS / izin clipboard ditolak
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(area);
    }
  }
}

/**
 * Pembungkus blok kode markdown dengan header bahasa + tombol "Salin kode"
 * yang menyalin seluruh isi blok (bukan hanya bagian yang terlihat).
 */
export default function CodeBlock({
  children,
  preClassName,
}: {
  children: ReactNode;
  preClassName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawText = nodeToText(children).replace(/\n$/, "");
  const lineCount = rawText ? rawText.split("\n").length : 0;
  const isLong = lineCount > 20;

  async function handleCopy() {
    if (await writeClipboard(rawText)) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] shadow-inner">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            {languageOf(children)}
          </span>
          {lineCount > 1 && (
            <span className="text-[11px] text-slate-500">
              {lineCount} baris
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Tampilkan kode" : "Sembunyikan kode"}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {collapsed ? "▸ Tampilkan" : "▾ Sembunyikan"}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label="Salin seluruh kode"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-white/10"
          >
            {copied ? "✓ Tersalin" : "📋 Salin kode"}
          </button>
        </div>
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs text-slate-400 transition hover:bg-white/[0.03] hover:text-slate-200"
        >
          <span>Kode disembunyikan ({lineCount} baris)</span>
          <span className="text-[11px] text-blue-300">Klik untuk buka ▸</span>
        </button>
      ) : (
        <>
          <pre className={preClassName}>{children}</pre>
          {isLong && (
            <div className="border-t border-white/10 bg-white/[0.02] px-3 py-1.5 text-center">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="text-[11px] font-medium text-slate-400 transition hover:text-white"
              >
                ▴ Sembunyikan kode ({lineCount} baris)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
