"use client";

import { useCallback, useState, type ClipboardEvent } from "react";

export type PastedBlock = {
  id: string;
  content: string;
  lineCount: number;
  charCount: number;
  preview: string;
  isCode: boolean;
};

const PASTE_LINE_THRESHOLD = 6;
const PASTE_CHAR_THRESHOLD = 400;

function looksLikeCode(text: string): boolean {
  return (
    /[{}();=<>[\]]/.test(text) &&
    (/\n/.test(text) || /(function|const|let|var|import|export|class|def |return |<\/?[a-z]+)/i.test(text))
  );
}

function makePreview(text: string): string {
  const firstNonEmpty =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  return firstNonEmpty.slice(0, 64) || "Teks tempelan";
}

/**
 * Hook untuk menangani paste teks/kode panjang ala Claude:
 * teks pendek tetap masuk ke input biasa, teks/kode panjang otomatis
 * diubah menjadi kartu lampiran agar kotak input tetap rapi.
 */
export function usePastedBlocks() {
  const [blocks, setBlocks] = useState<PastedBlock[]>([]);

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const raw = event.clipboardData?.getData("text/plain");
      if (!raw) return;

      const normalized = raw.replace(/\r\n/g, "\n");
      const lines = normalized.split("\n");
      const shouldConvert =
        lines.length >= PASTE_LINE_THRESHOLD ||
        normalized.length >= PASTE_CHAR_THRESHOLD;

      if (!shouldConvert) return;

      event.preventDefault();
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setBlocks((prev) => [
        ...prev,
        {
          id,
          content: normalized,
          lineCount: lines.length,
          charCount: normalized.length,
          preview: makePreview(normalized),
          isCode: looksLikeCode(normalized),
        },
      ]);
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    setBlocks([]);
  }, []);

  const compose = useCallback(
    (text: string): string => {
      const trimmed = text.trim();
      if (blocks.length === 0) return trimmed;

      const formatted = blocks
        .map((block) => {
          const body = block.content.trimEnd();
          // Hindari bentrok backtick jika isi sudah mengandung ```
          const fence = body.includes("```") ? "````" : "```";
          return `${fence}\n${body}\n${fence}`;
        })
        .join("\n\n");

      return trimmed ? `${trimmed}\n\n${formatted}` : formatted;
    },
    [blocks],
  );

  return { blocks, onPaste, remove, clear, compose };
}

/**
 * Kartu ringkas untuk teks/kode yang di-paste (bisa diklik untuk pratinjau penuh).
 */
export function PastedChips({
  blocks,
  onRemove,
  disabled = false,
}: {
  blocks: PastedBlock[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const [previewBlock, setPreviewBlock] = useState<PastedBlock | null>(null);

  if (blocks.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="group inline-flex max-w-[260px] items-center gap-2 rounded-xl border border-white/15 bg-[#191f33] px-2.5 py-1.5 text-xs text-slate-200 shadow-sm transition hover:border-blue-400/40"
          >
            <button
              type="button"
              onClick={() => setPreviewBlock(block)}
              title="Klik untuk lihat isi lengkap"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="shrink-0 rounded-md border border-blue-400/30 bg-blue-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-300">
                {block.isCode ? "CODE" : "PASTED"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11px] text-slate-100">
                  {block.preview}
                </span>
                <span className="block text-[10px] text-slate-400">
                  {block.lineCount} baris · {block.charCount} karakter
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(block.id)}
              disabled={disabled}
              aria-label="Hapus tempelan"
              className="shrink-0 rounded-md px-1 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {previewBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPreviewBlock(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#111524] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-blue-400/30 bg-blue-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-blue-300">
                  {previewBlock.isCode ? "CODE" : "PASTED"}
                </span>
                <span className="text-xs text-slate-300">
                  {previewBlock.lineCount} baris · {previewBlock.charCount} karakter
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewBlock(null)}
                aria-label="Tutup pratinjau"
                className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed text-emerald-300">
              {previewBlock.content}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
