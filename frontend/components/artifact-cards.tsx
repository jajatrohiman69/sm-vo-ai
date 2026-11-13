"use client";

export interface GeneratedArtifact {
  filename: string;
  stored_name: string;
  kind: string;
  size_bytes?: number;
  description?: string;
  download_path: string;
}

const KIND_STYLE: Record<
  string,
  { icon: string; badge: string; border: string; bg: string }
> = {
  xlsx: {
    icon: "📊",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    border: "border-emerald-500/25 hover:border-emerald-400/50",
    bg: "bg-emerald-950/20",
  },
  bas: {
    icon: "⚙️",
    badge: "bg-violet-500/20 text-violet-300 border-violet-400/30",
    border: "border-violet-500/25 hover:border-violet-400/50",
    bg: "bg-violet-950/20",
  },
  docx: {
    icon: "📝",
    badge: "bg-blue-500/20 text-blue-300 border-blue-400/30",
    border: "border-blue-500/25 hover:border-blue-400/50",
    bg: "bg-blue-950/20",
  },
  pdf: {
    icon: "📄",
    badge: "bg-rose-500/20 text-rose-300 border-rose-400/30",
    border: "border-rose-500/25 hover:border-rose-400/50",
    bg: "bg-rose-950/20",
  },
  py: {
    icon: "🐍",
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    border: "border-amber-500/25 hover:border-amber-400/50",
    bg: "bg-amber-950/20",
  },
  gs: {
    icon: "📜",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
    border: "border-cyan-500/25 hover:border-cyan-400/50",
    bg: "bg-cyan-950/20",
  },
  sql: {
    icon: "🗄️",
    badge: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
    border: "border-indigo-500/25 hover:border-indigo-400/50",
    bg: "bg-indigo-950/20",
  },
  csv: {
    icon: "📑",
    badge: "bg-teal-500/20 text-teal-300 border-teal-400/30",
    border: "border-teal-500/25 hover:border-teal-400/50",
    bg: "bg-teal-950/20",
  },
  html: {
    icon: "🌐",
    badge: "bg-orange-500/20 text-orange-300 border-orange-400/30",
    border: "border-orange-500/25 hover:border-orange-400/50",
    bg: "bg-orange-950/20",
  },
  json: {
    icon: "🔧",
    badge: "bg-slate-500/20 text-slate-300 border-slate-400/30",
    border: "border-slate-500/25 hover:border-slate-400/50",
    bg: "bg-slate-900/40",
  },
  zip: {
    icon: "📦",
    badge: "bg-amber-500/25 text-amber-200 border-amber-400/40",
    border: "border-amber-400/30 hover:border-amber-300/60",
    bg: "bg-amber-950/25",
  },
};

export function parseArtifactsFromMarkdown(markdown: string): {
  cleanContent: string;
  artifacts: GeneratedArtifact[];
} {
  if (!markdown) return { cleanContent: "", artifacts: [] };

  let artifacts: GeneratedArtifact[] = [];
  let cleanContent = markdown;

  const markerMatch = markdown.match(/<!--\s*VHQ_ARTIFACTS:([\s\S]*?)-->/);
  if (markerMatch && markerMatch[1]) {
    try {
      const parsed = JSON.parse(markerMatch[1].trim());
      if (Array.isArray(parsed)) {
        artifacts = parsed.filter(
          (item): item is GeneratedArtifact =>
            Boolean(item && typeof item === "object" && item.filename && item.download_path)
        );
      }
    } catch {
      artifacts = [];
    }
    cleanContent = cleanContent.replace(/<!--\s*VHQ_ARTIFACTS:[\s\S]*?-->/g, "").trim();
  }

  // Fallback untuk pesan lama yang hanya punya link markdown /api/backend/files/download/...
  if (artifacts.length === 0) {
    const linkRegex = /\[[^\]]*`([^`]+)`[^\]]*\]\(\/api\/backend(\/files\/download\/([^)\s]+))\)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(markdown)) !== null) {
      const fname = m[1];
      const dpath = m[2];
      const stored = m[3];
      const ext = fname.split(".").pop()?.toLowerCase() || "file";
      artifacts.push({
        filename: fname,
        stored_name: stored,
        kind: ext,
        download_path: dpath,
      });
    }
  }

  if (artifacts.length > 0) {
    cleanContent = cleanContent
      .replace(
        /\n*---\s*\n###\s*📦\s*(?:Artifact & File Kerja Siap Unduh|File Excel & Modul Macro VBA Siap Unduh)[\s\S]*$/i,
        ""
      )
      .trim();
  }

  return { cleanContent, artifacts };
}

export default function ArtifactCards({
  artifacts,
}: {
  artifacts: GeneratedArtifact[];
}) {
  if (!artifacts || artifacts.length === 0) return null;

  const zipArtifact = artifacts.find((a) => a.kind === "zip");
  const individualArtifacts = artifacts.filter((a) => a.kind !== "zip");

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-[#0b1222]/90 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm">📦</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Artifact Siap Unduh ({individualArtifacts.length})
          </span>
        </div>

        {zipArtifact && (
          <a
            href={`/api/backend${zipArtifact.download_path}`}
            download={zipArtifact.filename}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30 transition"
          >
            📦 Unduh Semua (.ZIP
            {zipArtifact.size_bytes
              ? ` · ${Math.max(1, Math.round(zipArtifact.size_bytes / 1024))} KB`
              : ""}
            )
          </a>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {individualArtifacts.map((item) => {
          const style = KIND_STYLE[item.kind.toLowerCase()] || KIND_STYLE.json;
          const sizeLabel = item.size_bytes
            ? `${Math.max(1, Math.round(item.size_bytes / 1024))} KB`
            : "";

          return (
            <div
              key={`${item.stored_name}-${item.filename}`}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition ${style.border} ${style.bg}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">{style.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.badge}`}
                    >
                      .{item.kind}
                    </span>
                    {sizeLabel && (
                      <span className="text-[10px] text-slate-400">
                        {sizeLabel}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1 truncate text-xs font-semibold text-white"
                    title={item.filename}
                  >
                    {item.filename}
                  </p>
                  {item.description && (
                    <p className="truncate text-[11px] text-slate-400">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <a
                href={`/api/backend${item.download_path}`}
                download={item.filename}
                className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 transition"
              >
                ⬇️ Unduh
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
