"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import CodeBlock from "@/components/code-block";
import { PastedChips, usePastedBlocks } from "@/components/pasted-blocks";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  API_URL,
  DEFAULT_WORKSPACE_SETTINGS,
  resolveLogoUrl,
  uploadAttachment,
  type UploadedAttachment,
  type WorkspaceSettings,
} from "@/lib/api";
import { useWorkspaceBranding } from "@/components/branding-runtime";

/* ------------------------------------------------------------------ */
/* Types (tetap diekspor karena dipakai file lain)                     */
/* ------------------------------------------------------------------ */

export type OfficeAgent = {
  id: number;
  name: string;
  role: string;
  department: string;
  status: string;
  description: string | null;
};

export type OfficeProject = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at?: string;
};

export type OfficeTask = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  result?: string | null;
  assigned_agent_id: number | null;
  project_id: number | null;
  assigned_agent?: OfficeAgent | string | null;
  created_at?: string;
};

/* Blok kode di hasil/balasan agen: dilengkapi tombol salin */
const OFFICE_MD_COMPONENTS: Components = {
  pre: ({ children }) => (
    <CodeBlock preClassName="overflow-x-auto p-3 text-xs leading-5 text-emerald-300">
      {children}
    </CodeBlock>
  ),
};

type LookConfig = {
  hair: "short" | "swept" | "bun" | "long" | "pony" | "bob";
  glasses?: boolean;
  headphones?: boolean;
  hoodie?: boolean;
};

type AgentStationConfig = {
  seatPos: [number, number, number];
  facingY: number;
  shirtColor: number;
  hairColor: number;
  skinColor: number;
  isStanding?: boolean;
  onSofa?: boolean;
  patrolPoints?: [number, number][];
  look: LookConfig;
  roomLabel: string;
  optimalModel: string;
};

/* ------------------------------------------------------------------ */
/* Layout kantor dinamis: jumlah meja & karakter mengikuti jumlah agen   */
/* ------------------------------------------------------------------ */

type AgentPreset = Pick<
  AgentStationConfig,
  "shirtColor" | "hairColor" | "skinColor" | "look" | "optimalModel"
>;

/* Tampilan karakter (dipakai berputar bila agen lebih banyak dari preset) */
const AGENT_PRESETS: AgentPreset[] = [
  {
    shirtColor: 0x3f6fb5,
    hairColor: 0x1e1b18,
    skinColor: 0xe0b48a,
    look: { hair: "swept" },
    optimalModel: "claude-opus-5-5",
  },
  {
    shirtColor: 0xe9b84a,
    hairColor: 0x1f1a17,
    skinColor: 0xf0c9a4,
    look: { hair: "short" },
    optimalModel: "deepseek-v4.1-flash",
  },
  {
    shirtColor: 0xf07a6a,
    hairColor: 0x2a1a14,
    skinColor: 0xc99a6b,
    look: { hair: "long" },
    optimalModel: "claude-sonnet-5",
  },
  {
    shirtColor: 0x8a6ad0,
    hairColor: 0x3b2f2f,
    skinColor: 0xe0b48a,
    look: { hair: "bun" },
    optimalModel: "gemini-3.1-pro-preview",
  },
  {
    shirtColor: 0x2f3647,
    hairColor: 0x111827,
    skinColor: 0xe0b48a,
    look: { hair: "short", glasses: true, hoodie: true },
    optimalModel: "deepseek-v4.1-flash",
  },
  {
    shirtColor: 0xf06fa5,
    hairColor: 0x27272a,
    skinColor: 0xf0c9a4,
    look: { hair: "pony" },
    optimalModel: "claude-sonnet-5",
  },
  {
    shirtColor: 0xf3f1f5,
    hairColor: 0x18181b,
    skinColor: 0xe0b48a,
    look: { hair: "short", headphones: true, hoodie: true },
    optimalModel: "claude-sonnet-5",
  },
  {
    shirtColor: 0x35b7a8,
    hairColor: 0x2e1065,
    skinColor: 0xf0c9a4,
    look: { hair: "bob" },
    optimalModel: "claude-opus-5-5",
  },
  {
    shirtColor: 0x6fa8dc,
    hairColor: 0x3a2418,
    skinColor: 0xd9a679,
    look: { hair: "short", headphones: true },
    optimalModel: "claude-sonnet-5",
  },
  {
    shirtColor: 0xe86a8a,
    hairColor: 0x1a1a1a,
    skinColor: 0xf0c9a4,
    look: { hair: "long", glasses: true },
    optimalModel: "claude-sonnet-5",
  },
  {
    shirtColor: 0x7fbf7f,
    hairColor: 0x5b3a29,
    skinColor: 0xc99a6b,
    look: { hair: "swept", hoodie: true },
    optimalModel: "deepseek-v4.1-flash",
  },
  {
    shirtColor: 0xb9a0ff,
    hairColor: 0x2d2a26,
    skinColor: 0xe0b48a,
    look: { hair: "bob", glasses: true },
    optimalModel: "claude-sonnet-5",
  },
];

type DeskSlot = { x: number; z: number; rot: number };

type OfficeLayout = {
  stations: AgentStationConfig[];
  desks: DeskSlot[];
  rows: number;
  /** Tepi depan lantai (z). Dasar ruangan = 4.6 */
  zFront: number;
  /** Tambahan kedalaman ruangan dibanding ukuran dasar */
  extra: number;
};

/* Meja disusun per "pod" (2 meja berdampingan) dengan lorong di antaranya */
const POD_X = [-0.85, 0.85, -3.35, 3.35, -5.05, 5.05];
const DESK_ROW_Z0 = 2.2;
const DESK_ROW_GAP = 2.4;
const BASE_FRONT_Z = 4.6;

const SOFA_SEAT: [number, number, number] = [3.5, 0.06, -1.72];
const PATROL_POINTS: [number, number][] = [
  [0.3, 1.3],
  [2.4, 1.3],
  [3.2, 0.2],
  [2.0, 0.9],
  [-0.6, 0.9],
];

const seatAt = (d: DeskSlot): [number, number, number] => [
  d.x + Math.sin(d.rot) * 0.8,
  0,
  d.z + Math.cos(d.rot) * 0.8,
];

function buildOfficeLayout(count: number): OfficeLayout {
  const n = Math.max(0, count);
  /* Agen #0 duduk di sofa (CEO), agen #2 berkeliling di lounge; sisanya punya meja */
  const patrolIdx = n > 2 ? 2 : -1;
  const deskCount = Math.max(0, n - (n > 0 ? 1 : 0) - (patrolIdx >= 0 ? 1 : 0));
  const rows = Math.ceil(deskCount / POD_X.length);

  const desks: DeskSlot[] = [];
  for (let r = 0; r < rows; r++) {
    const k = Math.min(POD_X.length, deskCount - r * POD_X.length);
    /* Ambil slot dari tengah ke tepi agar baris terakhir tetap simetris */
    const xs = POD_X.slice(0, k).sort((a, b) => a - b);
    for (const x of xs) {
      desks.push({ x, z: DESK_ROW_Z0 + r * DESK_ROW_GAP, rot: 0 });
    }
  }

  const stations: AgentStationConfig[] = [];
  let deskI = 0;
  for (let i = 0; i < n; i++) {
    const preset = AGENT_PRESETS[i % AGENT_PRESETS.length];
    if (i === 0) {
      stations.push({
        ...preset,
        seatPos: SOFA_SEAT,
        facingY: 0,
        onSofa: true,
        roomLabel: "Area Lounge · Sofa",
      });
    } else if (i === patrolIdx) {
      stations.push({
        ...preset,
        seatPos: [PATROL_POINTS[0][0], 0, PATROL_POINTS[0][1]],
        facingY: 0,
        isStanding: true,
        patrolPoints: PATROL_POINTS,
        roomLabel: "Area Lounge & Meeting",
      });
    } else {
      const desk = desks[deskI++];
      stations.push({
        ...preset,
        seatPos: seatAt(desk),
        facingY: desk.rot + Math.PI,
        roomLabel: `Open Workspace · Meja ${deskI}`,
      });
    }
  }

  const zFront =
    rows > 0
      ? Math.max(
          BASE_FRONT_Z,
          DESK_ROW_Z0 + (rows - 1) * DESK_ROW_GAP + 1.9,
        )
      : BASE_FRONT_Z;
  return { stations, desks, rows, zFront, extra: zFront - BASE_FRONT_Z };
}

const FIRST_NAMES = [
  "Raka",
  "Hendra",
  "Nadia",
  "Sari",
  "Bima",
  "Dinda",
  "Reza",
  "Tania",
];

const PRESET_ALIASES = [
  "Raka · AI CEO",
  "Hendra · Excel & Macro",
  "Nadia · Business Analyst",
  "Sari · Dashboard Analyst",
  "Bima · Automation",
  "Dinda · Secretary",
  "Reza · QA & Docs",
  "Tania · Social Specialist",
];

function isRoleName(raw: string) {
  return (
    raw.toUpperCase() === "AI CEO" ||
    ["Engineer", "Analyst", "Secretary", "QA", "Social"].some((k) =>
      raw.includes(k),
    )
  );
}

function getIndonesianAlias(agent: OfficeAgent, index: number): string {
  const raw = agent.name.trim();
  if (isRoleName(raw)) {
    return `${FIRST_NAMES[index % FIRST_NAMES.length]} (${raw})`;
  }
  return agent.role ? `${raw} · ${agent.role}` : raw || PRESET_ALIASES[index % PRESET_ALIASES.length];
}

function getShortFirstName(agent: OfficeAgent, index: number): string {
  const raw = agent.name.trim();
  if (isRoleName(raw)) return FIRST_NAMES[index % FIRST_NAMES.length];
  return raw.split(" ")[0];
}

/* ------------------------------------------------------------------ */
/* Tekstur prosedural (kayu & keramik) agar lantai tidak flat          */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: [number, number],
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function drawWood(ctx: CanvasRenderingContext2D, s: number) {
  const r = rng(7);
  const planks = 8;
  const h = s / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = `hsl(32, 36%, ${57 + r() * 9}%)`;
    ctx.fillRect(0, i * h, s, h);
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = `rgba(90,60,30,${0.04 + r() * 0.06})`;
      const y = i * h + r() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        s * 0.3,
        y + (r() - 0.5) * 6,
        s * 0.6,
        y + (r() - 0.5) * 6,
        s,
        y,
      );
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(60,40,20,0.35)";
    ctx.fillRect(0, i * h, s, 1.5);
    ctx.fillRect(r() * s, i * h, 1.5, h);
  }
}

/* ------------------------------------------------------------------ */
/* Kerangka karakter                                                   */
/* ------------------------------------------------------------------ */

type CharacterRig = {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  nameTag?: {
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    name: string;
  };
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  orb: THREE.Mesh;
  agentIndex: number;
  seated: boolean;
  labelY: number;
  busy: boolean;
  phase: number;
  patrolIdx: number;
};

function angleLerp(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/* Titik berdiri CEO di dekat stasiun agen */
function walkNear(
  st: AgentStationConfig,
  zFront = BASE_FRONT_Z,
): [number, number] {
  const sx = st.seatPos[0];
  const sz = st.seatPos[2];
  if (!st.isStanding && !st.onSofa) {
    /* Meja kerja: berdiri di lorong tepat di belakang kursi */
    return [clamp(sx, -5.8, 5.8), clamp(sz + 0.95, -3.8, zFront - 0.4)];
  }
  const len = Math.hypot(0.8 - sx, 0.5 - sz) || 1;
  return [
    clamp(sx + ((0.8 - sx) / len) * 1.2, -5.8, 5.8),
    clamp(sz + ((0.5 - sz) / len) * 1.2, -3.8, zFront - 0.7),
  ];
}

/* ------------------------------------------------------------------ */
/* UI kecil                                                            */
/* ------------------------------------------------------------------ */

const PANEL = "border border-white/10 bg-[#1a1626]/90 backdrop-blur-md";
const INPUT =
  "w-full rounded-xl border border-white/10 bg-[#100d1a] px-3.5 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/60";
const BTN_PRIMARY =
  "rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-violet-500 disabled:opacity-50";
const BTN_GHOST =
  "rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/5";

function Modal({
  title,
  subtitle,
  onClose,
  maxW = "max-w-lg",
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  maxW?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[85vh] w-full ${maxW} flex-col rounded-2xl border border-white/10 bg-[#1a1626] p-6 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-50">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
/* KOMPONEN UTAMA                                                      */
/* ================================================================== */

export default function VirtualOffice3D({
  externalSelectedAgentId,
  onSelectAgentExternal,
  onOpenClassicDashboard,
}: {
  externalSelectedAgentId?: number | null;
  onSelectAgentExternal?: (agentId: number | null) => void;
  onOpenClassicDashboard?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [agents, setAgents] = useState<OfficeAgent[]>([]);
  /* Layout (jumlah meja, ukuran ruangan) mengikuti jumlah agen */
  const layout = useMemo(
    () => buildOfficeLayout(agents.length),
    [agents.length],
  );
  const [projects, setProjects] = useState<OfficeProject[]>([]);
  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [connectionOk, setConnectionOk] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const [roleMode, setRoleMode] = useState<"Watcher" | "CEO">("CEO");
  const [cameraDim, setCameraDim] = useState<"2.5D" | "3D">("3D");

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [menuScreenPos, setMenuScreenPos] = useState({ x: 460, y: 320 });

  const [activeActionModal, setActiveActionModal] = useState<
    "assign" | "chat" | "result" | "board" | "new_project" | null
  >(null);
  const closeModal = useCallback(() => setActiveActionModal(null), []);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "Low" | "Normal" | "High" | "Urgent"
  >("High");
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState<UploadedAttachment[]>(
    [],
  );
  const [uploadingTaskFiles, setUploadingTaskFiles] = useState(false);
  const [taskUploadError, setTaskUploadError] = useState("");
  const taskFileInputRef = useRef<HTMLInputElement | null>(null);

  const [chatInput, setChatInput] = useState("");
  const taskPasted = usePastedBlocks();
  const chatPasted = usePastedBlocks();
  const [chatReply, setChatReply] = useState("");
  const [chatModelUsed, setChatModelUsed] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<UploadedAttachment[]>(
    [],
  );
  const [uploadingChatFiles, setUploadingChatFiles] = useState(false);
  const [chatUploadError, setChatUploadError] = useState("");
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [creatingProj, setCreatingProj] = useState(false);

  const [clockText, setClockText] = useState("");
  const branding = useWorkspaceBranding();

  /* Ref yang dibaca loop animasi (tanpa memicu render ulang) */
  const roleModeRef = useRef(roleMode);
  const cameraDimRef = useRef(cameraDim);
  const agentsRef = useRef<OfficeAgent[]>([]);
  const tasksRef = useRef<OfficeTask[]>([]);
  const onSelectRef = useRef(onSelectAgentExternal);
  const brandingRef = useRef<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const redrawBrandingRef = useRef<((b: WorkspaceSettings) => void) | null>(
    null,
  );
  const ceoTargetRef = useRef(new THREE.Vector3(0.2, 0, 1.6));
  const ceoLabelRef = useRef<HTMLDivElement | null>(null);
  const badgeRefs = useRef<Map<number, HTMLElement>>(new Map());
  const walkedForRef = useRef<number | null>(null);
  const sigRef = useRef({ a: "", p: "", t: "" });

  useEffect(() => {
    brandingRef.current = branding;
    redrawBrandingRef.current?.(branding);
  }, [branding]);

  useEffect(() => {
    roleModeRef.current = roleMode;
  }, [roleMode]);
  useEffect(() => {
    cameraDimRef.current = cameraDim;
  }, [cameraDim]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    onSelectRef.current = onSelectAgentExternal;
  }, [onSelectAgentExternal]);

  /* CEO berjalan ke agen yang dipilih dari luar */
  useEffect(() => {
    if (externalSelectedAgentId == null) {
      walkedForRef.current = null;
      return;
    }
    if (walkedForRef.current === externalSelectedAgentId) return;
    const idx = agents.findIndex((a) => a.id === externalSelectedAgentId);
    if (idx < 0) return;
    const station = layout.stations[idx];
    if (!station) return;
    const [wx, wz] = walkNear(station, layout.zFront);
    ceoTargetRef.current.set(wx, 0, wz);
    walkedForRef.current = externalSelectedAgentId;
  }, [externalSelectedAgentId, agents, layout]);

  /* Jam */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const d = now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const t = now
        .toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        .replace(":", ".");
      setClockText(`${d} — ${t}`);
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, []);

  /* Data: hanya set state bila isi benar-benar berubah, jeda saat tab tersembunyi */
  const loadOfficeData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [agRes, prRes, tkRes] = await Promise.all([
        fetch(`${API_URL}/agents`, { signal }),
        fetch(`${API_URL}/projects`, { signal }),
        fetch(`${API_URL}/tasks`, { signal }),
      ]);
      if (!agRes.ok || !prRes.ok || !tkRes.ok) {
        setConnectionOk(false);
        return;
      }
      const [agData, prData, tkData] = await Promise.all([
        agRes.json(),
        prRes.json(),
        tkRes.json(),
      ]);
      setConnectionOk(true);

      const agList = Array.isArray(agData) ? (agData as OfficeAgent[]) : [];
      const prList = Array.isArray(prData) ? (prData as OfficeProject[]) : [];
      const tkList = Array.isArray(tkData) ? (tkData as OfficeTask[]) : [];

      const sa = JSON.stringify(agList);
      const sp = JSON.stringify(prList);
      const st = JSON.stringify(tkList);
      if (sa !== sigRef.current.a) {
        sigRef.current.a = sa;
        setAgents(agList);
      }
      if (sp !== sigRef.current.p) {
        sigRef.current.p = sp;
        setProjects(prList);
        setSelectedProjectId((prev) => prev ?? prList[0]?.id ?? null);
      }
      if (st !== sigRef.current.t) {
        sigRef.current.t = st;
        setTasks(tkList);
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setConnectionOk(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const initialLoad = window.setTimeout(
      () => void loadOfficeData(ctrl.signal),
      0,
    );
    const interval = setInterval(() => {
      if (!document.hidden) void loadOfficeData(ctrl.signal);
    }, 8000);
    return () => {
      ctrl.abort();
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadOfficeData]);

  /* Menu konteks agen (posisi relatif terhadap kontainer 3D) */
  const openMenuAt = useCallback(
    (agentId: number, clientX: number, clientY: number) => {
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSelectedAgentId(agentId);
      onSelectRef.current?.(agentId);
      setMenuScreenPos({
        x: clamp(clientX - rect.left, 130, Math.max(130, rect.width - 130)),
        y: clamp(clientY - rect.top, 110, Math.max(110, rect.height - 130)),
      });
    },
    [],
  );

  /* ================================================================ */
  /* THREE.JS                                                          */
  /* ================================================================ */
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 1100;
    let height = container.clientHeight || 720;

    const scene = new THREE.Scene();
    const extra = layout.extra;
    const zFront = layout.zFront;
    const midZ = extra / 2;
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 120);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    const domElem = renderer.domElement;
    domElem.style.touchAction = "none";

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;

    /* ---------- Cahaya: senja lembut, rim biru dari jendela kota, lampu hangat ---------- */
    scene.add(new THREE.HemisphereLight(0xf7f0ff, 0x776a88, 0.9));

    const sun = new THREE.DirectionalLight(0xffe5d2, 1.45);
    sun.position.set(9, 15, 10 + midZ);
    sun.target.position.set(0, 0, midZ);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 45;
    const sd = 12 + extra * 0.7;
    sun.shadow.camera.left = -sd;
    sun.shadow.camera.right = sd;
    sun.shadow.camera.top = sd;
    sun.shadow.camera.bottom = -sd;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    scene.add(sun);

    const rimLight = new THREE.DirectionalLight(0xb9a0ff, 0.65);
    rimLight.position.set(2, 6, -12);
    scene.add(rimLight);

    for (const [lx, lz] of [
      [-5.2, 0.4],
      [1.3, -0.2],
      [3.5, 2.4],
    ]) {
      const p = new THREE.PointLight(0xffc7dc, 9, 8, 2);
      p.position.set(lx, 2.4, lz);
      scene.add(p);
    }
    for (let r = 1; r < layout.rows; r++) {
      const p = new THREE.PointLight(0xffd9c2, 7, 8, 2);
      p.position.set(0, 2.4, DESK_ROW_Z0 + r * DESK_ROW_GAP);
      scene.add(p);
    }

    /* ---------- Cache geometri & material (hindari duplikat) ---------- */
    const geoCache = new Map<string, THREE.BufferGeometry>();
    const G = (key: string, make: () => THREE.BufferGeometry) => {
      let g = geoCache.get(key);
      if (!g) {
        g = make();
        geoCache.set(key, g);
      }
      return g;
    };
    const BX = (w: number, h: number, d: number) =>
      G(`bx${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
    const RB = (w: number, h: number, d: number, radius = 0.03) =>
      G(`rb${w},${h},${d},${radius}`, () => {
        const r = Math.max(
          0.004,
          Math.min(radius, Math.min(w, h, d) / 2 - 0.002),
        );
        return new RoundedBoxGeometry(w, h, d, 3, r);
      });
    const CY = (rt: number, rb: number, h: number, seg = 16) =>
      G(
        `cy${rt},${rb},${h},${seg}`,
        () => new THREE.CylinderGeometry(rt, rb, h, seg),
      );
    const SP = (r: number, ws = 16, hs = 12) =>
      G(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
    const CP = (r: number, l: number) =>
      G(`cp${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 12));

    const matCache = new Map<string, THREE.MeshStandardMaterial>();
    const M = (color: number, rough = 0.7, metal = 0) => {
      const key = `${color}|${rough}|${metal}`;
      let m = matCache.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({
          color,
          roughness: rough,
          metalness: metal,
        });
        matCache.set(key, m);
      }
      return m;
    };

    const mk = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
      shadow = true,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (shadow) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      return m;
    };

    const nameTagTextures: THREE.CanvasTexture[] = [];
    const drawNameTag = (canvas: HTMLCanvasElement, name: string) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to draw character name tag");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#172033";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fontSize = 42;
      ctx.font = `700 ${fontSize}px Arial`;
      while (ctx.measureText(name).width > canvas.width - 32 && fontSize > 24) {
        fontSize -= 2;
        ctx.font = `700 ${fontSize}px Arial`;
      }
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
    };

    const texList: THREE.Texture[] = [];
    const FONT = "'Trebuchet MS','Segoe UI',Arial,sans-serif";

    const canvasTex = (
      w: number,
      h: number,
      draw: (c: CanvasRenderingContext2D, w: number, h: number) => void,
    ) => {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d");
      if (c) draw(c, w, h);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      texList.push(t);
      return t;
    };
    /* ---------- Material ---------- */
    const wallPurple = M(0xf1edfa, 0.9);
    const wallPurple2 = M(0xe5def2, 0.9);
    const darkMetal = M(0x39364a, 0.45, 0.5);
    const woodLight = M(0xe9d9c8, 0.55);
    const woodMid = M(0xb99578, 0.55);
    const woodDark = M(0x755b59, 0.6);
    const navy = M(0x8176a8, 0.8);
    const potTerra = M(0xd98985, 0.8);
    const potWhite = M(0xf5f0e9, 0.8);
    const leafA = M(0x62a860, 0.7);
    const leafB = M(0x3f8f58, 0.7);
    const leafC = M(0x86c06a, 0.7);
    const glassM = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      depthWrite: false,
    });
    const lampGlow = new THREE.MeshStandardMaterial({
      color: 0xfff1e5,
      emissive: 0xffb7d5,
      emissiveIntensity: 1.6,
    });

    /* ---------- Tekstur: logo, kota senja, layar, papan ---------- */
    let logoImageDisposed = false;
    const drawLogoText = (
      c: CanvasRenderingContext2D,
      b: WorkspaceSettings,
    ) => {
      c.fillStyle = "#fff";
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.shadowColor = "rgba(20,220,180,0.45)";
      c.shadowBlur = 24;
      let fontSize = 76;
      c.font = `700 ${fontSize}px ${FONT}`;
      while (c.measureText(b.office_name).width > 580 && fontSize > 36) {
        fontSize -= 4;
        c.font = `700 ${fontSize}px ${FONT}`;
      }
      c.fillText(b.office_name, 400, 205);
      c.shadowBlur = 8;
      c.fillStyle = "#c8f7e9";
      c.font = `italic 400 34px ${FONT}`;
      c.fillText(b.office_subtitle, 400, 280);
      c.font = `400 28px ${FONT}`;
      c.fillText(b.office_badge, 400, 340);
    };

    const logoTex = canvasTex(1024, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      drawLogoText(c, brandingRef.current);
    });

    const paintLogoTex = (b: WorkspaceSettings) => {
      const canvas = logoTex.image as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawLogoText(context, b);
      logoTex.needsUpdate = true;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (logoImageDisposed) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 55, 100, 300, 300);
        drawLogoText(context, b);
        logoTex.needsUpdate = true;
      };
      img.src = resolveLogoUrl(b.logo_url);
    };
    paintLogoTex(brandingRef.current);

    const skyTex = canvasTex(1024, 384, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#666caa");
      g.addColorStop(0.48, "#b17cae");
      g.addColorStop(0.84, "#f3a5a0");
      g.addColorStop(1, "#ffe0bb");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const r = rng(5);
      for (const [layer, col, maxH] of [
        [0, "#4a4a86", 200],
        [1, "#232550", 260],
      ] as const) {
        let x = -10;
        while (x < w) {
          const bw = 30 + r() * 55;
          const bh = 60 + r() * maxH;
          c.fillStyle = col;
          c.fillRect(x, h - bh, bw, bh);
          if (layer === 1) {
            for (let wy = h - bh + 10; wy < h - 8; wy += 14) {
              for (let wx = x + 6; wx < x + bw - 8; wx += 11) {
                if (r() > 0.55) {
                  c.fillStyle = r() > 0.5 ? "#ffd98a" : "#9fd4ff";
                  c.fillRect(wx, wy, 5, 7);
                }
              }
            }
          }
          x += bw + (layer ? 4 : 2);
        }
      }
    });

    const codeTex = (hue: number) =>
      canvasTex(128, 96, (c, w, h) => {
        c.fillStyle = "#14182b";
        c.fillRect(0, 0, w, h);
        const r = rng(hue);
        for (let y = 8; y < h - 6; y += 9) {
          let x = 8 + (r() > 0.6 ? 10 : 0);
          while (x < w - 12) {
            const len = 10 + r() * 34;
            c.fillStyle = `hsl(${hue + r() * 70},75%,65%)`;
            c.fillRect(x, y, len, 4);
            x += len + 5;
            if (r() > 0.8) break;
          }
        }
      });
    const screenA = new THREE.MeshBasicMaterial({ map: codeTex(200) });
    const screenB = new THREE.MeshBasicMaterial({ map: codeTex(300) });

    const drawBoard = (
      c: CanvasRenderingContext2D,
      w: number,
      h: number,
      b: WorkspaceSettings,
    ) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#c8b7ef");
      g.addColorStop(1, "#f1b6c8");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#382d50";
      c.textAlign = "center";
      c.font = `800 84px ${FONT}`;
      c.fillText(b.led_line_1 || "DREAM IT", w / 2, 190);
      c.font = `700 62px ${FONT}`;
      c.fillText(b.led_line_2 || "MAKE IT REAL", w / 2, 300);
      c.strokeStyle = "#fff8ed";
      c.lineWidth = 10;
      c.lineCap = "round";
      c.beginPath();
      c.arc(w / 2, 400, 38, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(w / 2 - 22, 385, 6, 0, Math.PI * 2);
      c.arc(w / 2 + 22, 385, 6, 0, Math.PI * 2);
      c.fill();
    };
    const boardTex = canvasTex(768, 512, (c, w, h) => {
      drawBoard(c, w, h, brandingRef.current);
    });
    const paintBoardTex = (b: WorkspaceSettings) => {
      const canvas = boardTex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawBoard(ctx, canvas.width, canvas.height, b);
      boardTex.needsUpdate = true;
    };

    const drawChalk = (
      c: CanvasRenderingContext2D,
      w: number,
      h: number,
      b: WorkspaceSettings,
    ) => {
      c.fillStyle = "#26302b";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#f4f1e6";
      c.textAlign = "center";
      c.font = `700 96px 'Comic Sans MS','Segoe Print',${FONT}`;
      c.fillText(b.chalk_line_1 || "Good", w / 2, 190);
      c.fillText(b.chalk_line_2 || "Vibes", w / 2, 310);
      c.fillText(b.chalk_line_3 || "Only", w / 2, 430);
      c.strokeStyle = "#f4f1e6";
      c.lineWidth = 7;
      c.lineCap = "round";
      c.beginPath();
      c.arc(w / 2, 520, 34, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      c.beginPath();
      c.arc(w / 2 - 18, 505, 4, 0, Math.PI * 2);
      c.arc(w / 2 + 18, 505, 4, 0, Math.PI * 2);
      c.fill();
    };
    const chalkTex = canvasTex(512, 640, (c, w, h) => {
      drawChalk(c, w, h, brandingRef.current);
    });
    const paintChalkTex = (b: WorkspaceSettings) => {
      const canvas = chalkTex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawChalk(ctx, canvas.width, canvas.height, b);
      chalkTex.needsUpdate = true;
    };

    redrawBrandingRef.current = (b: WorkspaceSettings) => {
      paintLogoTex(b);
      paintBoardTex(b);
      paintChalkTex(b);
    };

    /* ---------- Platform kayu melayang ---------- */
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);
    const roomD = 9.2 + extra;
    scene.add(mk(RB(12.6, 0.45, 8.6 + extra, 0.35), woodDark, 0, -0.72, midZ));
    scene.add(
      mk(RB(13.8, 0.5, 9.8 + extra, 0.35), M(0xcf9a62, 0.6), 0, -0.25, midZ),
    );

    const woodTex = makeTexture(512, drawWood, [5, 2.5 * (roomD / 9.2)]);
    texList.push(woodTex);
    const floor = mk(
      BX(13.2, 0.08, roomD),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 }),
      0,
      0,
      midZ,
    );
    floor.name = "walkable_floor";
    floorGroup.add(floor);

    const blobTex = canvasTex(256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 14 + extra),
      new THREE.MeshBasicMaterial({
        map: blobTex,
        transparent: true,
        depthWrite: false,
      }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0.3, -1.1, 0.6 + midZ);
    scene.add(blob);

    /* Karpet bulat di area lounge + karpet krem di area meja */
    const roundRug = (r: number, y: number, color: number) =>
      scene.add(mk(CY(r, r, 0.02, 48), M(color, 0.95), 1.3, y, -0.2, false));
    roundRug(1.9, 0.05, 0xb49bd8);
    roundRug(1.45, 0.062, 0xd1c2e9);
    roundRug(0.95, 0.074, 0xf7eee7);
    /* Karpet zona kerja (satu per baris meja) */
    for (let r = 0; r < layout.rows; r++) {
      const rz = DESK_ROW_Z0 + r * DESK_ROW_GAP + 0.45;
      scene.add(
        mk(RB(12.0, 0.016, 2.0, 0.01), M(0xd9cdea, 0.98), 0, 0.05, rz, false),
      );
      scene.add(
        mk(RB(11.6, 0.018, 1.6, 0.01), M(0xece5f6, 0.98), 0, 0.052, rz, false),
      );
    }

    const walkRingGeo = new THREE.RingGeometry(0.22, 0.32, 28);
    walkRingGeo.rotateX(-Math.PI / 2);
    const walkRingMat = new THREE.MeshBasicMaterial({
      color: 0xf5c46b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const walkRing = new THREE.Mesh(walkRingGeo, walkRingMat);
    walkRing.position.set(1.6, 0.1, 2.2);
    scene.add(walkRing);

    /* ---------- Dinding: pastel + logo, jendela kota ---------- */
    const H = 3.3;
    scene.add(mk(RB(7.3, H, 0.3, 0.03), wallPurple, -3.05, H / 2, -4.45));
    scene.add(mk(RB(6.1, 0.75, 0.3, 0.03), wallPurple2, 3.65, 0.375, -4.45));
    scene.add(mk(RB(6.1, 0.3, 0.3, 0.03), wallPurple, 3.65, H - 0.15, -4.45));
    scene.add(
      mk(RB(0.3, H, 9.6 + extra, 0.03), wallPurple2, -6.75, H / 2, midZ),
    );
    scene.add(
      mk(RB(0.34, 0.9, 9.6 + extra, 0.03), woodMid, -6.73, 0.45, midZ),
    );

    const ledMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a7ff,
      emissive: 0x9c5cff,
      emissiveIntensity: 1.5,
      toneMapped: false,
    });
    scene.add(mk(BX(12.4, 0.035, 0.035), ledMaterial, 0, 0.08, -4.37, false));
    scene.add(
      mk(BX(0.035, 0.035, 8.8 + extra), ledMaterial, -6.48, 0.08, midZ, false),
    );

    const winH = H - 1.05;
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(6.1, winH),
      new THREE.MeshBasicMaterial({ map: skyTex }),
    );
    sky.position.set(3.65, 0.75 + winH / 2, -4.58);
    scene.add(sky);
    scene.add(
      mk(BX(6.1, winH, 0.02), glassM, 3.65, 0.75 + winH / 2, -4.42, false),
    );
    for (const mx of [0.62, 2.15, 3.65, 5.15, 6.68]) {
      scene.add(mk(BX(0.08, winH, 0.12), darkMetal, mx, 0.75 + winH / 2, -4.4));
    }

    const curtainRod = mk(CY(0.035, 0.035, 6.35, 12), woodDark, 3.65, 3.13, -4.2);
    curtainRod.rotation.z = Math.PI / 2;
    scene.add(curtainRod);
    const curtainColors = [0xf3dce4, 0xf8e8ec, 0xe9d9e8, 0xf7e5df];
    for (const side of [-1, 1]) {
      for (let fold = 0; fold < 5; fold++) {
        const x = side < 0 ? 0.68 + fold * 0.13 : 6.62 - fold * 0.13;
        const curtainFold = mk(
          RB(0.15, 2.28, 0.075, 0.035),
          M(curtainColors[fold % curtainColors.length], 0.98),
          x,
          1.86,
          -4.2,
          false,
        );
        scene.add(curtainFold);
      }
      const tieback = mk(
        RB(0.7, 0.07, 0.09, 0.035),
        M(0xc59b6d, 0.55, 0.3),
        side < 0 ? 0.95 : 6.35,
        1.47,
        -4.14,
        false,
      );
      tieback.rotation.z = side < 0 ? -0.06 : 0.06;
      scene.add(tieback);
    }

    const printPalettes = [
      { paper: "#f8eee5", accent: "#c27d83", detail: "#e5bd8d", caption: "SLOW DOWN" },
      { paper: "#e9e9dc", accent: "#738c73", detail: "#d9a875", caption: "GROW AT YOUR PACE" },
      { paper: "#f5e5e9", accent: "#8a719f", detail: "#e5b7a5", caption: "MAKE SPACE" },
    ];
    printPalettes.forEach((palette, index) => {
      const texture = canvasTex(256, 320, (ctx, w, h) => {
        ctx.fillStyle = palette.paper;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = palette.detail;
        ctx.beginPath();
        ctx.arc(w / 2, 112, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(w / 2, 133, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.paper;
        ctx.beginPath();
        ctx.ellipse(w / 2 + 37, 99, 17, 47, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = palette.accent;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 3;
        for (let line = 0; line < 3; line++) {
          ctx.beginPath();
          ctx.moveTo(32, 205 + line * 12);
          ctx.bezierCurveTo(85, 188 + line * 12, 164, 222 + line * 12, 224, 202 + line * 12);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#51445d";
        ctx.font = "700 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText(palette.caption, w / 2, 285);
      });
      const frame = new THREE.Group();
      frame.position.set(-6.49, 2.12, [-1.6, 0.2, 2.0][index]);
      frame.rotation.y = Math.PI / 2;
      frame.add(mk(RB(0.72, 0.88, 0.09, 0.035), woodDark, 0, 0, 0));
      frame.add(mk(RB(0.64, 0.8, 0.025, 0.015), potWhite, 0, 0, 0.052, false));
      const print = new THREE.Mesh(
        new THREE.PlaneGeometry(0.56, 0.72),
        new THREE.MeshBasicMaterial({ map: texture }),
      );
      print.position.z = 0.069;
      frame.add(print);
      scene.add(frame);
    });

    const lightWirePoints = Array.from({ length: 9 }, (_, index) => {
      const t = index / 8;
      return new THREE.Vector3(
        -6.4,
        2.86 - Math.sin(t * Math.PI) * 0.2,
        -4.1 + t * (7.8 + extra),
      );
    });
    const lightWireCurve = new THREE.CatmullRomCurve3(lightWirePoints);
    scene.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(lightWireCurve, 48, 0.012, 6, false),
        M(0x8c7765, 0.8),
      ),
    );
    const fairyBulbColors = [0xffe6ad, 0xffc7ce, 0xd8c9ff];
    for (let bulb = 0; bulb <= 16; bulb++) {
      const t = bulb / 16;
      const point = lightWireCurve.getPoint(t);
      scene.add(
        mk(
          SP(0.052, 10, 8),
          new THREE.MeshBasicMaterial({
            color: fairyBulbColors[bulb % fairyBulbColors.length],
          }),
          point.x,
          point.y - 0.045,
          point.z,
          false,
        ),
      );
    }

    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 2.8),
      new THREE.MeshBasicMaterial({
        map: logoTex,
        transparent: true,
        depthWrite: false,
      }),
    );
    logo.position.set(-3.1, 1.95, -4.29);
    scene.add(logo);

    /* Neon sign ala gen-z di dinding kiri */
    const neonTex = canvasTex(640, 220, (c, w) => {
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `700 88px ${FONT}`;
      c.shadowColor = "#ff6fb5";
      c.shadowBlur = 30;
      c.fillStyle = "#ffd6ec";
      c.fillText("stay cozy", w / 2, 78);
      c.font = `700 62px ${FONT}`;
      c.shadowColor = "#6fdcff";
      c.fillStyle = "#d6f6ff";
      c.fillText("ship great work", w / 2, 160);
    });
    const neon = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.65),
      new THREE.MeshBasicMaterial({
        map: neonTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    neon.position.set(-6.46, 1.3, -1.5);
    neon.rotation.y = Math.PI / 2;
    scene.add(neon);

    /* ---------- Furnitur ---------- */
    const createChair = (x: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      g.add(mk(RB(0.5, 0.08, 0.5, 0.04), navy, 0, 0.42, 0));
      const back = mk(RB(0.46, 0.46, 0.07, 0.04), navy, 0, 0.72, -0.22);
      back.rotation.x = -0.08;
      g.add(back);
      g.add(mk(CY(0.035, 0.035, 0.36, 10), darkMetal, 0, 0.22, 0));
      for (let i = 0; i < 3; i++) {
        const bar = mk(BX(0.5, 0.035, 0.05), darkMetal, 0, 0.04, 0);
        bar.rotation.y = (i * Math.PI) / 3;
        g.add(bar);
      }
      scene.add(g);
    };

    const createDesk = (x: number, z: number, rot: number, variant: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      g.add(mk(RB(1.6, 0.06, 0.8, 0.03), woodLight, 0, 0.74, 0));
      for (const sx of [-0.72, 0.72])
        g.add(mk(RB(0.06, 0.72, 0.7, 0.02), woodMid, sx, 0.36, 0));
      g.add(mk(RB(1.4, 0.4, 0.04, 0.015), woodMid, 0, 0.5, -0.3));

      const lx = variant % 2 ? -0.2 : 0.15;
      g.add(
        mk(RB(0.42, 0.02, 0.3, 0.01), M(0xcfcfd6, 0.4, 0.3), lx, 0.78, -0.05),
      );
      const lid = mk(
        RB(0.42, 0.28, 0.015, 0.008),
        M(0x1b1b22, 0.4),
        lx,
        0.94,
        -0.2,
      );
      lid.rotation.x = -0.2;
      g.add(lid);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.38, 0.24),
        variant % 2 ? screenB : screenA,
      );
      panel.position.set(lx, 0.94, -0.191);
      panel.rotation.x = -0.2;
      g.add(panel);

      g.add(
        mk(
          RB(0.2, 0.015, 0.27, 0.005),
          M([0xe86a8a, 0x6fa8dc, 0xe9a54a][variant % 3], 0.7),
          0.55,
          0.78,
          0.12,
        ),
      );
      g.add(
        mk(
          CY(0.04, 0.035, 0.09, 12),
          M([0xb85c4a, 0x4aa8a0, 0xe9c46a][variant % 3], 0.6),
          -0.5,
          0.82,
          0.18,
        ),
      );
      g.add(
        mk(
          CY(0.06, 0.05, 0.1, 12),
          variant % 2 ? potTerra : potWhite,
          -0.65,
          0.82,
          -0.2,
        ),
      );
      const mini = mk(SP(0.1, 10, 8), leafA, -0.65, 0.93, -0.2);
      mini.scale.set(1, 0.85, 1);
      g.add(mini);
      g.add(mk(CY(0.06, 0.07, 0.02, 14), darkMetal, 0.7, 0.78, -0.25));
      g.add(mk(CY(0.008, 0.008, 0.28, 6), darkMetal, 0.7, 0.92, -0.25, false));
      g.add(mk(CY(0.03, 0.09, 0.09, 14), M(0xf0a64a, 0.5), 0.7, 1.08, -0.25));
      g.add(mk(SP(0.03, 8, 6), lampGlow, 0.7, 1.02, -0.25, false));
      scene.add(g);
      createChair(
        x + Math.sin(rot) * 0.8,
        z + Math.cos(rot) * 0.8,
        rot + Math.PI,
      );
    };
    layout.desks.forEach((d, i) => createDesk(d.x, d.z, d.rot, i));

    const createPlant = (
      x: number,
      z: number,
      s = 1,
      type = 0,
      pot: THREE.Material = potTerra,
    ) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      g.add(mk(CY(0.26, 0.2, 0.42, 18), pot, 0, 0.21, 0));
      const leaf = SP(1, 10, 8);
      const n = type === 0 ? 13 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const l = mk(
          leaf,
          [leafA, leafB, leafC][i % 3],
          Math.cos(a) * 0.12,
          0.62 + (i % 3) * 0.14,
          Math.sin(a) * 0.12,
        );
        if (type === 0) l.scale.set(0.1, 0.34, 0.05);
        else l.scale.set(0.2, 0.05, 0.32);
        l.rotation.order = "YXZ";
        l.rotation.y = Math.PI - a;
        l.rotation.z = (type === 0 ? 0.45 : 0.9) + (i % 3) * 0.14;
        g.add(l);
      }
      scene.add(g);
    };

    const createShelf = (
      x: number,
      z: number,
      rot: number,
      w: number,
      h: number,
      levels: number,
      seed: number,
    ) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      const d = 0.42;
      g.add(mk(RB(0.05, h, d, 0.015), woodMid, -w / 2, h / 2, 0));
      g.add(mk(RB(0.05, h, d, 0.015), woodMid, w / 2, h / 2, 0));
      g.add(mk(BX(w, h, 0.03), woodDark, 0, h / 2, -d / 2 + 0.015));
      const r = rng(seed);
      const cols = [0xe9a54a, 0x6fa8dc, 0xe86a8a, 0x7fbf7f, 0xf4efe6, 0x9b7ede];
      for (let l = 0; l <= levels; l++) {
        const y = 0.03 + l * ((h - 0.06) / levels);
        g.add(mk(BX(w, 0.04, d), woodMid, 0, y, 0));
        if (l === levels) continue;
        let ix = -w / 2 + 0.12;
        while (ix < w / 2 - 0.12) {
          const t = r();
          const c = cols[Math.floor(r() * cols.length)];
          if (t < 0.4) {
            const bh = 0.16 + r() * 0.12;
            g.add(mk(BX(0.07, bh, 0.2), M(c, 0.7), ix, y + 0.02 + bh / 2, 0));
            ix += 0.1;
          } else if (t < 0.7) {
            g.add(mk(SP(0.07, 10, 8), M(c, 0.6), ix, y + 0.09, 0.03));
            ix += 0.17;
          } else {
            g.add(mk(CY(0.05, 0.04, 0.08, 10), potWhite, ix, y + 0.06, 0.03));
            const lf = mk(SP(0.08, 10, 8), leafA, ix, y + 0.15, 0.03);
            lf.scale.set(1, 1.2, 1);
            g.add(lf);
            ix += 0.18;
          }
        }
      }
      scene.add(g);
    };
    createShelf(-6.35, -3.2, Math.PI / 2, 1.3, 2.4, 4, 11);

    // Rak melayang di atas area kopi
    const wallShelf = mk(RB(1.8, 0.05, 0.3, 0.015), woodMid, -0.2, 1.9, -4.1);
    scene.add(wallShelf);
    scene.add(mk(CY(0.07, 0.06, 0.1, 12), potWhite, -0.7, 1.98, -4.1));
    const ws1 = mk(SP(0.12, 10, 8), leafB, -0.7, 2.1, -4.1);
    ws1.scale.set(1, 1.1, 1);
    scene.add(ws1);
    scene.add(mk(BX(0.08, 0.24, 0.18), M(0xe86a8a, 0.7), 0.1, 2.04, -4.1));
    scene.add(mk(BX(0.08, 0.2, 0.18), M(0x6fa8dc, 0.7), 0.2, 2.02, -4.1));

    // Konter kopi
    scene.add(
      mk(RB(2.0, 0.9, 0.65, 0.03), M(0xf0ecf4, 0.6), -0.2, 0.45, -3.95),
    );
    scene.add(mk(BX(2.1, 0.05, 0.7), woodLight, -0.2, 0.925, -3.95));
    scene.add(mk(RB(0.45, 0.5, 0.4, 0.05), M(0xf7f7fb, 0.4), -0.65, 1.2, -4.0));
    scene.add(
      mk(RB(0.47, 0.08, 0.42, 0.03), M(0x3fb7b0, 0.4), -0.65, 1.48, -4.0),
    );
    scene.add(mk(CY(0.03, 0.03, 0.14, 10), darkMetal, -0.65, 1.1, -3.82));
    for (const [mx2, c] of [
      [-0.1, 0xe86a8a],
      [0.1, 0xf4efe6],
      [0.3, 0x6fa8dc],
    ] as const) {
      scene.add(mk(CY(0.04, 0.035, 0.09, 12), M(c, 0.6), mx2, 0.995, -3.85));
    }
    scene.add(mk(CY(0.07, 0.06, 0.1, 12), potTerra, 0.55, 1.0, -4.05));
    const cp = mk(SP(0.12, 10, 8), leafC, 0.55, 1.12, -4.05);
    cp.scale.set(1, 1.1, 1);
    scene.add(cp);

    // Sofa
    const sofaM = M(0x9c8ac4, 0.85);
    const sofa = new THREE.Group();
    sofa.position.set(2.8, 0, -1.8);
    sofa.add(mk(RB(3.4, 0.32, 1.0, 0.12), sofaM, 0, 0.2, 0));
    sofa.add(mk(RB(3.4, 0.7, 0.28, 0.1), sofaM, 0, 0.62, -0.45));
    for (const ax of [-1.6, 1.6])
      sofa.add(mk(RB(0.3, 0.55, 1.0, 0.1), sofaM, ax, 0.38, 0));
    for (const cx of [-0.8, 0.8])
      sofa.add(mk(RB(1.5, 0.14, 0.85, 0.07), M(0xb7a6d9, 0.9), cx, 0.43, 0.05));
    [
      [-1.0, 0xd9c4e7, 0.2],
      [-0.5, 0xf4e8d9, -0.1],
      [1.1, 0xe7b2c4, -0.2],
    ].forEach(([px, c, rz]) => {
      const pil = mk(RB(0.42, 0.42, 0.14, 0.06), M(c, 0.9), px, 0.75, -0.25);
      pil.rotation.z = rz;
      pil.rotation.x = -0.25;
      sofa.add(pil);
    });
    const blanket = mk(
      RB(0.54, 0.1, 0.72, 0.06),
      M(0xf0dfca, 0.98),
      -1.28,
      0.52,
      0.08,
    );
    blanket.rotation.z = -0.08;
    sofa.add(blanket);
    for (let fringe = 0; fringe < 5; fringe++) {
      sofa.add(
        mk(
          SP(0.035, 8, 6),
          M(0xe4cdb7, 0.98),
          -1.48 + fringe * 0.1,
          0.46,
          0.42,
          false,
        ),
      );
    }
    scene.add(sofa);

    // Bean bag pink
    const bean = mk(SP(0.7, 20, 14), M(0xe7a9bd, 0.95), -0.3, 0.45, -1.0);
    bean.scale.set(1, 0.72, 1);
    scene.add(bean);
    const beanTop = mk(SP(0.4, 16, 12), M(0xf0bfd0, 0.95), -0.25, 0.7, -1.0);
    beanTop.scale.set(1, 0.5, 1);
    scene.add(beanTop);

    // Huddle corner (area diskusi santai)
    {
      const hx = -4.2;
      const hz = -1.5;
      scene.add(mk(CY(1.75, 1.75, 0.02, 48), M(0xcfe6dc, 0.95), hx, 0.05, hz, false));
      scene.add(mk(CY(1.3, 1.3, 0.022, 48), M(0xe9f4ee, 0.95), hx, 0.06, hz, false));
      scene.add(mk(CY(0.62, 0.62, 0.05, 32), woodLight, hx, 0.66, hz));
      scene.add(mk(CY(0.07, 0.14, 0.62, 14), woodDark, hx, 0.33, hz));
      scene.add(mk(CY(0.05, 0.045, 0.1, 12), potWhite, hx + 0.12, 0.74, hz - 0.1));
      const huddleLeaf = mk(SP(0.09, 10, 8), leafA, hx + 0.12, 0.84, hz - 0.1);
      huddleLeaf.scale.set(1, 1.1, 1);
      scene.add(huddleLeaf);
      [0xe7a9bd, 0xb7a6d9, 0xf0dfca, 0x9fd3c7].forEach((c, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const px = hx + Math.cos(a) * 1.05;
        const pz = hz + Math.sin(a) * 1.05;
        scene.add(mk(CY(0.3, 0.32, 0.36, 20), M(c, 0.95), px, 0.22, pz));
        const top = mk(SP(0.3, 16, 10), M(c, 0.95), px, 0.4, pz);
        top.scale.set(1, 0.45, 1);
        scene.add(top);
      });
    }

    // Meja kopi bulat
    scene.add(mk(CY(0.62, 0.62, 0.06, 32), woodMid, 1.3, 0.46, -0.2));
    scene.add(mk(CY(0.08, 0.2, 0.42, 16), woodDark, 1.3, 0.22, -0.2));
    scene.add(mk(CY(0.05, 0.045, 0.1, 12), potWhite, 1.05, 0.54, -0.35));
    const tp = mk(SP(0.09, 10, 8), leafA, 1.05, 0.64, -0.35);
    tp.scale.set(1, 1.1, 1);
    scene.add(tp);
    scene.add(
      mk(CY(0.04, 0.035, 0.09, 12), M(0xe86a8a, 0.6), 1.55, 0.54, -0.05),
    );
    scene.add(
      mk(RB(0.25, 0.05, 0.18, 0.01), M(0x6fa8dc, 0.7), 1.35, 0.52, 0.15),
    );

    // Layar besar "Dream Big"
    const board = new THREE.Group();
    board.position.set(5.4, 0, -2.5);
    board.rotation.y = 0.1;
    board.add(mk(RB(2.8, 1.9, 0.1, 0.05), darkMetal, 0, 1.65, 0));
    const boardScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 1.75),
      new THREE.MeshBasicMaterial({ map: boardTex }),
    );
    boardScreen.position.set(0, 1.65, 0.056);
    board.add(boardScreen);
    board.add(mk(BX(0.1, 0.8, 0.1), darkMetal, 0, 0.4, -0.05));
    board.add(mk(BX(1.0, 0.06, 0.5), darkMetal, 0, 0.03, -0.05));
    scene.add(board);

    // Papan tulis kapur
    const easel = new THREE.Group();
    easel.position.set(-5.75, 0, -0.55);
    easel.rotation.y = 1.0;
    easel.add(mk(RB(1.1, 1.35, 0.06, 0.03), woodDark, 0, 0.95, 0));
    const chalk = new THREE.Mesh(
      new THREE.PlaneGeometry(0.98, 1.22),
      new THREE.MeshBasicMaterial({ map: chalkTex }),
    );
    chalk.position.set(0, 0.95, 0.034);
    easel.add(chalk);
    for (const lx2 of [-0.45, 0.45]) {
      const leg = mk(BX(0.05, 1.5, 0.05), woodDark, lx2, 0.72, -0.08);
      leg.rotation.x = -0.12;
      easel.add(leg);
    }
    scene.add(easel);

    // Tanaman besar, lampu gantung & lampu lantai
    createPlant(-6.0, 0.4, 1.2, 1, potWhite);
    createPlant(-6.1, zFront - 0.6, 1.3, 0);
    createPlant(6.1, -3.6, 1.3, 1, potWhite);
    createPlant(6.1, 0.9, 1.1, 0);
    createPlant(1.4, -3.95, 1.0, 1);
    createPlant(-2.1, zFront - 0.55, 1.1, 0, potWhite);
    createPlant(2.1, zFront - 0.55, 1.0, 1);
    createPlant(-2.6, -3.95, 0.9, 0);

    const pendant = (x: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(mk(CY(0.008, 0.008, 1.2, 6), darkMetal, 0, 3.0, 0, false));
      g.add(mk(CY(0.06, 0.34, 0.28, 24), M(0xf0a64a, 0.5), 0, 2.4, 0));
      g.add(mk(SP(0.12, 12, 10), lampGlow, 0, 2.28, 0, false));
      scene.add(g);
    };
    pendant(-4.2, -1.5);
    pendant(1.3, -0.2);
    pendant(-0.6, -2.8);
    for (let r = 0; r < layout.rows; r++) {
      const pz = DESK_ROW_Z0 + r * DESK_ROW_GAP + 0.4;
      pendant(-2.1, pz);
      pendant(2.1, pz);
    }

    const floorLamp = new THREE.Group();
    floorLamp.position.set(-6.2, 0, 1.0);
    floorLamp.add(mk(CY(0.12, 0.14, 0.03, 16), darkMetal, 0, 0.02, 0));
    floorLamp.add(mk(CY(0.015, 0.015, 1.5, 8), darkMetal, 0, 0.77, 0));
    floorLamp.add(mk(CY(0.14, 0.2, 0.28, 18), lampGlow, 0, 1.6, 0, false));
    scene.add(floorLamp);

    /* ---------- Robot maskot ---------- */
    const tickers: ((t: number, dt: number) => void)[] = [];
    {
      const white = M(0xf4f6fb, 0.35);
      const blue = M(0x4aa8ff, 0.4);
      const visor = M(0x1a2040, 0.25);
      const glow = new THREE.MeshBasicMaterial({ color: 0x6fdcff });
      const g = new THREE.Group();
      g.position.set(4.5, 0.12, 0.3);
      g.rotation.y = -0.5;
      const bodyR = mk(CP(0.2, 0.18), white, 0, 0.62, 0);
      bodyR.scale.set(1, 1, 0.9);
      g.add(bodyR);
      g.add(mk(CY(0.11, 0.05, 0.14, 14), blue, 0, 0.3, 0));
      const headG = new THREE.Group();
      headG.position.set(0, 1.0, 0);
      const headR = mk(SP(0.27, 24, 18), white, 0, 0.18, 0);
      headR.scale.set(1.15, 0.95, 1);
      headG.add(headR);
      const face = mk(SP(0.22, 20, 14), visor, 0, 0.18, 0.1);
      face.scale.set(1.15, 0.82, 0.62);
      headG.add(face);
      for (const ex of [-0.1, 0.1]) {
        const eye = mk(SP(0.04, 10, 8), glow, ex, 0.21, 0.215, false);
        eye.scale.set(1, 1.3, 0.5);
        headG.add(eye);
      }
      const smile = mk(
        G(
          "robotSmile",
          () => new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI),
        ),
        glow,
        0,
        0.14,
        0.22,
        false,
      );
      smile.rotation.z = Math.PI;
      headG.add(smile);
      for (const sx of [-0.31, 0.31]) {
        const ear = mk(SP(0.07, 10, 8), blue, sx, 0.18, 0);
        ear.scale.set(0.6, 1, 1);
        headG.add(ear);
      }
      headG.add(mk(CY(0.01, 0.01, 0.12, 6), darkMetal, 0, 0.5, 0));
      headG.add(mk(SP(0.04, 10, 8), glow, 0, 0.58, 0, false));
      g.add(headG);
      const mkArm = (side: number) => {
        const p = new THREE.Group();
        p.position.set(side * 0.27, 0.78, 0);
        p.add(mk(CP(0.045, 0.2), white, 0, -0.14, 0));
        g.add(p);
        return p;
      };
      const armL = mkArm(-1);
      const armR = mkArm(1);
      const ringGeo = new THREE.RingGeometry(0.2, 0.3, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x6fdcff,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.set(0, -0.08, 0);
      g.add(ring);
      scene.add(g);
      tickers.push((t) => {
        g.position.y = 0.12 + Math.sin(t * 2) * 0.05;
        armR.rotation.z = 2.3 + Math.sin(t * 5) * 0.35;
        armL.rotation.z = -0.25 - Math.sin(t * 2) * 0.05;
        headG.rotation.y = Math.sin(t * 0.8) * 0.35;
        ring.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
      });
    }

    /* ---------- Karakter chibi ---------- */
    const rigs: CharacterRig[] = [];
    const clickable: THREE.Object3D[] = [];

    const buildCharacter = (cfg: {
      shirt: number;
      hair: number;
      skin: number;
      seated: boolean;
      agentIndex: number;
      look: LookConfig;
      lap?: boolean;
    }): CharacterRig => {
      const { shirt, hair, skin, seated, agentIndex, look } = cfg;
      const group = new THREE.Group();
      const body = new THREE.Group();
      group.add(body);
      const hipY = seated ? 0.5 : 0.74;
      const shirtM = M(shirt, 0.8);
      const skinM = M(skin, 0.55);
      const hairM = M(hair, 0.8);
      const pantsM = M(0x30364a, 0.85);
      const shoeM = M(0xf3f1f5, 0.6);
      const ink = M(0x1c1b22, 0.35);

      const torso = mk(CP(0.14, 0.18), shirtM, 0, hipY + 0.2, 0);
      torso.scale.set(1.15, 1, 0.85);
      body.add(torso);
      let nameTag: CharacterRig["nameTag"];
      if (agentIndex >= 0) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 96;
        const name = FIRST_NAMES[agentIndex % FIRST_NAMES.length];
        drawNameTag(canvas, name);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        nameTagTextures.push(texture);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(
          G("nameTagPlane", () => new THREE.PlaneGeometry(0.2, 0.075)),
          material,
        );
        mesh.position.set(0, hipY + 0.2, 0.143);
        body.add(mesh);
        nameTag = { canvas, texture, name };
      }
      const pelvis = mk(SP(0.135, 16, 12), pantsM, 0, hipY - 0.015, 0);
      pelvis.scale.set(1.05, 0.72, 0.9);
      body.add(pelvis);
      if (look.hoodie) {
        const hood = mk(SP(0.15, 12, 10), shirtM, 0, hipY + 0.43, -0.09);
        hood.scale.set(1.3, 0.6, 0.8);
        body.add(hood);
      }

      const head = new THREE.Group();
      head.position.set(0, hipY + 0.43, 0);
      head.add(mk(CY(0.05, 0.06, 0.08, 10), skinM, 0, 0.02, 0));
      const skull = mk(SP(0.21, 22, 16), skinM, 0, 0.2, 0);
      skull.scale.set(1.05, 1, 1);
      head.add(skull);

      const cap = mk(
        G(
          "hairCap",
          () =>
            new THREE.SphereGeometry(
              0.22,
              20,
              12,
              0,
              Math.PI * 2,
              0,
              Math.PI * 0.56,
            ),
        ),
        hairM,
        0,
        0.2,
        -0.01,
      );
      cap.scale.set(1.07, 1.02, 1.05);
      head.add(cap);
      const fringe = mk(SP(0.12, 10, 8), hairM, 0, 0.35, 0.12);
      fringe.scale.set(1.3, 0.45, 0.7);
      if (look.hair !== "bun") head.add(fringe);
      if (look.hair === "swept") {
        const sw = mk(SP(0.1, 10, 8), hairM, 0.05, 0.4, 0.1);
        sw.scale.set(1.4, 0.55, 1);
        head.add(sw);
      } else if (look.hair === "bun") {
        head.add(mk(SP(0.09, 12, 10), hairM, 0, 0.46, -0.06));
      } else if (look.hair === "long") {
        const back = mk(SP(0.2, 14, 10), hairM, 0, 0.06, -0.08);
        back.scale.set(1.1, 1.7, 0.8);
        head.add(back);
      } else if (look.hair === "pony") {
        const tail = mk(CP(0.045, 0.16), hairM, 0, 0.12, -0.27);
        tail.rotation.x = -0.4;
        head.add(tail);
        head.add(mk(SP(0.04, 8, 6), M(0xe94f6b, 0.6), 0, 0.26, -0.2));
      } else if (look.hair === "bob") {
        const back = mk(SP(0.21, 14, 10), hairM, 0, 0.1, -0.03);
        back.scale.set(1.15, 1, 1.05);
        head.add(back);
      }

      for (const ex of [-0.075, 0.075]) {
        const eye = mk(SP(0.026, 10, 8), ink, ex, 0.18, 0.2, false);
        eye.scale.set(1, 1.25, 0.6);
        head.add(eye);
        const cheek = mk(
          SP(0.03, 8, 6),
          M(0xf29a9a, 0.8),
          ex * 1.75,
          0.12,
          0.15,
          false,
        );
        cheek.scale.set(1.3, 0.8, 0.4);
        head.add(cheek);
      }
      const smile = mk(
        G("smile", () => new THREE.TorusGeometry(0.04, 0.007, 6, 12, Math.PI)),
        ink,
        0,
        0.115,
        0.192,
        false,
      );
      smile.rotation.z = Math.PI;
      head.add(smile);

      if (look.glasses) {
        const ringG = G(
          "glassRing",
          () => new THREE.TorusGeometry(0.05, 0.008, 8, 20),
        );
        for (const ex of [-0.078, 0.078])
          head.add(mk(ringG, ink, ex, 0.18, 0.205, false));
        head.add(mk(BX(0.04, 0.008, 0.008), ink, 0, 0.19, 0.208, false));
      }
      if (look.headphones) {
        const bandM = M(0x35b7a8, 0.5);
        head.add(
          mk(
            G(
              "hpBand",
              () => new THREE.TorusGeometry(0.225, 0.016, 8, 24, Math.PI),
            ),
            bandM,
            0,
            0.2,
            0,
          ),
        );
        for (const sx of [-0.225, 0.225]) {
          const cup = mk(
            CY(0.07, 0.07, 0.05, 14),
            M(0xe94f6b, 0.5),
            sx,
            0.2,
            0,
          );
          cup.rotation.z = Math.PI / 2;
          head.add(cup);
        }
      }
      body.add(head);

      const makeArm = (side: number) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.18, hipY + 0.34, 0);
        const shoulder = mk(SP(0.075, 16, 12), shirtM, 0, 0, 0);
        shoulder.scale.set(1, 1.05, 0.95);
        arm.add(shoulder);
        arm.add(mk(CP(0.052, 0.15), shirtM, 0, -0.13, 0));
        const elbow = new THREE.Group();
        elbow.position.set(0, -0.25, 0);
        elbow.add(mk(SP(0.058, 14, 10), shirtM, 0, 0, 0));
        elbow.add(mk(CP(0.047, 0.14), shirtM, 0, -0.105, 0));
        const hand = mk(SP(0.052, 14, 10), skinM, 0, -0.225, 0.008);
        hand.scale.set(0.9, 0.82, 0.85);
        elbow.add(hand);
        arm.add(elbow);
        body.add(arm);
        return { arm, elbow };
      };
      const la = makeArm(-1);
      const ra = makeArm(1);

      const makeLeg = (side: number) => {
        const leg = new THREE.Group();
        leg.position.set(side * 0.09, hipY, 0);
        leg.add(mk(SP(0.078, 14, 10), pantsM, 0, 0, 0));
        leg.add(mk(CP(0.07, 0.2), pantsM, 0, -0.17, 0));
        const knee = new THREE.Group();
        knee.position.set(0, -0.33, 0);
        knee.add(mk(SP(0.073, 14, 10), pantsM, 0, 0, 0));
        knee.add(mk(CP(0.06, 0.18), pantsM, 0, -0.16, 0));
        knee.add(mk(RB(0.13, 0.085, 0.24, 0.04), shoeM, 0, -0.34, 0.05));
        leg.add(knee);
        body.add(leg);
        return { leg, knee };
      };
      const ll = makeLeg(-1);
      const rl = makeLeg(1);
      if (seated) {
        for (const l of [ll, rl]) {
          l.leg.rotation.x = -Math.PI / 2;
          l.knee.rotation.x = Math.PI / 2;
        }
      }

      if (cfg.lap) {
        const lap = new THREE.Group();
        lap.position.set(0, hipY + 0.14, 0.36);
        lap.add(mk(RB(0.4, 0.02, 0.28, 0.01), M(0xcfcfd6, 0.4, 0.3), 0, 0, 0));
        const lid = mk(
          RB(0.4, 0.26, 0.015, 0.008),
          M(0x1b1b22, 0.4),
          0,
          0.14,
          0.14,
        );
        lid.rotation.x = 0.25;
        lap.add(lid);
        const pn = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), screenA);
        pn.position.set(0, 0.14, 0.131);
        pn.rotation.order = "YXZ";
        pn.rotation.set(-0.25, Math.PI, 0);
        lap.add(pn);
        group.add(lap);
      }

      const labelY = hipY + 1.02;
      const orb = new THREE.Mesh(
        SP(0.05, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xf5b546 }),
      );
      orb.position.y = labelY - 0.12;
      orb.visible = false;
      group.add(orb);

      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o !== orb) {
          o.userData.agentIndex = agentIndex;
          if (agentIndex >= 0) clickable.push(o);
        }
      });

      scene.add(group);
      return {
        group,
        body,
        head,
        nameTag,
        leftArm: la.arm,
        rightArm: ra.arm,
        leftElbow: la.elbow,
        rightElbow: ra.elbow,
        leftLeg: ll.leg,
        rightLeg: rl.leg,
        leftKnee: ll.knee,
        rightKnee: rl.knee,
        orb,
        agentIndex,
        seated,
        labelY,
        busy: false,
        phase: 0,
        patrolIdx: 0,
      };
    };

    const ceoPos = new THREE.Vector3(0.2, 0, 1.6);
    const ceoRig = buildCharacter({
      shirt: 0x2f3a57,
      hair: 0x1c1917,
      skin: 0xe0b48a,
      seated: false,
      agentIndex: -1,
      look: { hair: "swept" },
    });
    ceoRig.group.position.copy(ceoPos);

    layout.stations.forEach((st, i) => {
      const rig = buildCharacter({
        shirt: st.shirtColor,
        hair: st.hairColor,
        skin: st.skinColor,
        seated: !st.isStanding,
        agentIndex: i,
        look: st.look,
        lap: st.onSofa,
      });
      rig.group.position.set(...st.seatPos);
      rig.group.rotation.y = st.facingY;
      rigs.push(rig);
    });

    /* ---------- Kamera & interaksi ---------- */
    const baseDist = 16.5 + extra * 1.1;
    const focusZ = 0.2 + midZ * 0.8;
    const cam = {
      az: 0.5,
      el: 0.6,
      dist: baseDist,
      tAz: 0.5,
      tEl: 0.6,
      tDist: baseDist,
    };
    const cameraTarget = new THREE.Vector3(0.3, 0.5, focusZ);
    const desiredTarget = new THREE.Vector3();

    let isDown = false;
    let hasDragged = false;
    let last = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      hasDragged = false;
      last = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (!hasDragged && Math.abs(dx) + Math.abs(dy) < 6) return;
      hasDragged = true;
      cam.tAz = clamp(cam.tAz - dx * 0.005, 0.05, 1.05);
      cam.tEl = clamp(cam.tEl + dy * 0.004, 0.35, 1.28);
      last = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      if (hasDragged) return;

      const rect = domElem.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      const agentHits = raycaster.intersectObjects(clickable, false);
      if (agentHits.length > 0) {
        const idx = agentHits[0].object.userData?.agentIndex;
        const matched =
          typeof idx === "number" ? agentsRef.current[idx] : undefined;
        if (matched) {
          openMenuAt(matched.id, e.clientX, e.clientY - 30);
          const station = layout.stations[idx];
          if (station) {
            const [wx, wz] = walkNear(station, zFront);
            ceoTargetRef.current.set(wx, 0, wz);
          }
          return;
        }
      }

      const floorHits = raycaster.intersectObjects(floorGroup.children, false);
      if (floorHits.length > 0) {
        const pt = floorHits[0].point;
        const cx = clamp(pt.x, -5.9, 5.9);
        const cz = clamp(pt.z, -3.9, zFront - 0.6);
        ceoTargetRef.current.set(cx, 0, cz);
        walkRing.position.set(cx, 0.1, cz);
        walkRingMat.opacity = 0.85;
        setSelectedAgentId(null);
        onSelectRef.current?.(null);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.tDist = clamp(cam.tDist + e.deltaY * 0.01, 9, 24 + extra * 1.5);
    };

    domElem.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    domElem.addEventListener("wheel", onWheel, { passive: false });

    const resizeObs = new ResizeObserver(() => {
      width = container.clientWidth || width;
      height = container.clientHeight || height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObs.observe(container);

    /* ---------- Loop animasi ---------- */
    let raf = 0;
    let running = true;
    const t0 = performance.now();
    let lastT = t0;
    let lastOverlay = 0;
    let lastBusy = 0;
    const proj = new THREE.Vector3();

    const relax = (obj: THREE.Object3D, target: number, k: number) => {
      obj.rotation.x += (target - obj.rotation.x) * k;
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;
      const elapsed = (now - t0) / 1000;
      const k = Math.min(1, dt * 10);

      /* CEO berjalan dengan percepatan halus */
      const target = ceoTargetRef.current;
      const dx = target.x - ceoPos.x;
      const dz = target.z - ceoPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.06) {
        const speed = Math.min(2.6, 0.8 + dist * 1.6);
        const step = Math.min(dist, speed * dt);
        ceoPos.x += (dx / dist) * step;
        ceoPos.z += (dz / dist) * step;
        ceoRig.group.position.set(ceoPos.x, 0, ceoPos.z);
        ceoRig.group.rotation.y = angleLerp(
          ceoRig.group.rotation.y,
          Math.atan2(dx, dz),
          Math.min(1, dt * 9),
        );
        ceoRig.phase += dt * speed * 3.6;
        const sw = Math.sin(ceoRig.phase);
        ceoRig.leftLeg.rotation.x = sw * 0.6;
        ceoRig.rightLeg.rotation.x = -sw * 0.6;
        ceoRig.leftKnee.rotation.x = Math.max(0, -sw) * 0.7;
        ceoRig.rightKnee.rotation.x = Math.max(0, sw) * 0.7;
        ceoRig.leftArm.rotation.x = -sw * 0.45;
        ceoRig.rightArm.rotation.x = sw * 0.45;
        ceoRig.leftElbow.rotation.x = -0.25;
        ceoRig.rightElbow.rotation.x = -0.25;
        ceoRig.body.position.y = Math.abs(Math.cos(ceoRig.phase)) * 0.025;
      } else {
        for (const o of [
          ceoRig.leftLeg,
          ceoRig.rightLeg,
          ceoRig.leftKnee,
          ceoRig.rightKnee,
          ceoRig.leftArm,
          ceoRig.rightArm,
          ceoRig.leftElbow,
          ceoRig.rightElbow,
        ]) {
          relax(o, 0, k);
        }
        ceoRig.body.position.y *= 1 - k;
        if (walkRingMat.opacity > 0) {
          walkRingMat.opacity = Math.max(0, walkRingMat.opacity - dt * 1.5);
        }
      }

      /* Agen */
      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i];
        const st = layout.stations[i];
        if (st.isStanding && st.patrolPoints?.length) {
          const wp = st.patrolPoints[rig.patrolIdx % st.patrolPoints.length];
          const pdx = wp[0] - rig.group.position.x;
          const pdz = wp[1] - rig.group.position.z;
          const pd = Math.hypot(pdx, pdz);
          if (pd > 0.08) {
            const step = Math.min(pd, 1.2 * dt);
            rig.group.position.x += (pdx / pd) * step;
            rig.group.position.z += (pdz / pd) * step;
            rig.group.rotation.y = angleLerp(
              rig.group.rotation.y,
              Math.atan2(pdx, pdz),
              Math.min(1, dt * 6),
            );
            rig.phase += dt * 4.2;
            const sw = Math.sin(rig.phase);
            rig.leftLeg.rotation.x = sw * 0.5;
            rig.rightLeg.rotation.x = -sw * 0.5;
            rig.leftKnee.rotation.x = Math.max(0, -sw) * 0.6;
            rig.rightKnee.rotation.x = Math.max(0, sw) * 0.6;
            rig.leftArm.rotation.x = -sw * 0.4;
            rig.rightArm.rotation.x = sw * 0.4;
            rig.body.position.y = Math.abs(Math.cos(rig.phase)) * 0.02;
          } else {
            rig.patrolIdx = (rig.patrolIdx + 1) % st.patrolPoints.length;
          }
        } else {
          const amp = rig.busy ? 0.07 : 0.012;
          const spd = rig.busy ? 9 : 1.6;
          rig.leftArm.rotation.x = -0.9 + Math.sin(elapsed * spd + i) * amp;
          rig.rightArm.rotation.x = -0.9 + Math.cos(elapsed * spd + i) * amp;
          rig.leftElbow.rotation.x = -1.0;
          rig.rightElbow.rotation.x = -1.0;
          const lookDown = rig.busy ? 0.16 : 0;
          rig.head.rotation.x += (lookDown - rig.head.rotation.x) * k * 0.5;
          rig.head.rotation.y = rig.busy
            ? Math.sin(elapsed * 0.7 + i) * 0.05
            : Math.sin(elapsed * 0.6 + i * 2) * 0.25;
          rig.body.position.y = Math.sin(elapsed * 1.4 + i) * 0.004;
        }
        if (rig.orb.visible) {
          rig.orb.position.y =
            rig.labelY - 0.12 + Math.sin(elapsed * 3 + i) * 0.02;
        }
      }

      /* Kamera: redaman supaya terasa halus */
      const is25D = cameraDimRef.current === "2.5D";
      const targetFov = is25D ? 22 : 34;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6);
        camera.updateProjectionMatrix();
      }
      const ck = Math.min(1, dt * 8);
      cam.az += (cam.tAz - cam.az) * ck;
      cam.el += (cam.tEl - cam.el) * ck;
      cam.dist += (cam.tDist - cam.dist) * ck;

      const effDist = is25D ? cam.dist * 1.48 : cam.dist;
      const effEl = is25D ? 0.78 : cam.el;

      if (roleModeRef.current === "CEO") {
        desiredTarget.set(
          ceoPos.x * 0.25 + 0.2,
          0.5,
          ceoPos.z * 0.25 + 0.1 + midZ * 0.8,
        );
      } else {
        desiredTarget.set(0.3, 0.5, focusZ);
      }
      cameraTarget.lerp(desiredTarget, Math.min(1, dt * 4));

      camera.position.set(
        cameraTarget.x + effDist * Math.sin(cam.az) * Math.cos(effEl),
        cameraTarget.y + effDist * Math.sin(effEl),
        cameraTarget.z + effDist * Math.cos(cam.az) * Math.cos(effEl),
      );
      camera.lookAt(cameraTarget);

      renderer.render(scene, camera);

      for (const fn of tickers) fn(elapsed, dt);

      /* Status sibuk (4x/detik) */
      if (elapsed - lastBusy > 0.25) {
        lastBusy = elapsed;
        const ags = agentsRef.current;
        const tks = tasksRef.current;
        rigs.forEach((rig, i) => {
          const ag = ags[i];
          if (ag && rig.nameTag) {
            const name = getShortFirstName(ag, i);
            if (rig.nameTag.name !== name) {
              drawNameTag(rig.nameTag.canvas, name);
              rig.nameTag.texture.needsUpdate = true;
              rig.nameTag.name = name;
            }
          }
          const busy = Boolean(
            ag &&
            tks.some(
              (t) =>
                t.assigned_agent_id === ag.id &&
                (t.status === "In Progress" || t.status === "Review"),
            ),
          );
          rig.busy = busy;
          rig.orb.visible = busy;
        });
      }

      /* Label HTML: langsung ubah style via ref (tanpa setState) ~30fps */
      if (elapsed - lastOverlay > 0.033) {
        lastOverlay = elapsed;
        const place = (
          el: HTMLElement | null | undefined,
          wx: number,
          wy: number,
          wz: number,
        ) => {
          if (!el) return;
          proj.set(wx, wy, wz).project(camera);
          const visible = proj.z < 1;
          el.style.visibility = visible ? "visible" : "hidden";
          if (visible) {
            const px = (proj.x * 0.5 + 0.5) * width;
            const py = (-proj.y * 0.5 + 0.5) * height;
            el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
          }
        };
        place(
          ceoLabelRef.current,
          ceoRig.group.position.x,
          ceoRig.labelY + 0.08,
          ceoRig.group.position.z,
        );
        const ags = agentsRef.current;
        for (let i = 0; i < Math.min(ags.length, rigs.length); i++) {
          place(
            badgeRefs.current.get(ags[i].id),
            rigs[i].group.position.x,
            rigs[i].labelY + 0.08,
            rigs[i].group.position.z,
          );
        }
      }
    };
    raf = requestAnimationFrame(animate);

    /* Jeda render saat tab tersembunyi */
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        lastT = performance.now();
        raf = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      logoImageDisposed = true;
      redrawBrandingRef.current = null;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObs.disconnect();
      domElem.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      domElem.removeEventListener("wheel", onWheel);

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      nameTagTextures.forEach((texture) => texture.dispose());
      geoCache.forEach((g) => g.dispose());
      matCache.forEach((m) => m.dispose());
      walkRingGeo.dispose();
      texList.forEach((t) => t.dispose());
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (domElem.parentNode === container) container.removeChild(domElem);
    };
  }, [openMenuAt, layout]);

  /* ================================================================ */
  /* Turunan state & handler                                           */
  /* ================================================================ */
  const activeProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  const projectTasks = useMemo(
    () =>
      activeProject
        ? tasks.filter((t) => t.project_id === activeProject.id)
        : tasks,
    [tasks, activeProject],
  );
  const completedCount = projectTasks.filter(
    (t) => t.status === "Completed",
  ).length;
  const totalCount = Math.max(1, projectTasks.length);
  const simulatedSpend = (
    completedCount * 0.42 +
    projectTasks.length * 0.18
  ).toFixed(2);
  const progressPct = Math.min(
    100,
    Math.round((completedCount / totalCount) * 100),
  );

  const busyByAgent = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of tasks) {
      if (
        t.assigned_agent_id != null &&
        (t.status === "In Progress" || t.status === "Review") &&
        !map.has(t.assigned_agent_id)
      ) {
        map.set(t.assigned_agent_id, t.title);
      }
    }
    return map;
  }, [tasks]);

  const selectedAgentIndex = agents.findIndex((a) => a.id === selectedAgentId);
  const selectedAgent =
    selectedAgentIndex >= 0 ? agents[selectedAgentIndex] : null;
  const selectedAgentStation =
    selectedAgentIndex >= 0
      ? (layout.stations[selectedAgentIndex] ?? null)
      : null;
  const selectedAgentTasks = selectedAgent
    ? tasks.filter((t) => t.assigned_agent_id === selectedAgent.id)
    : [];
  const latestTaskWithResult =
    selectedAgentTasks.find((t) => t.result && t.result.trim().length > 0) ||
    selectedAgentTasks[0] ||
    null;

  const showToast = (msg: string, ms = 4500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), ms);
  };

  async function handleAssignTaskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent || !newTaskTitle.trim()) return;
    setSubmittingTask(true);
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description:
            taskPasted.compose(newTaskDesc.trim()) || newTaskTitle.trim(),
          priority: newTaskPriority,
          assigned_agent_id: selectedAgent.id,
          project_id: activeProject?.id ?? null,
          auto_execute: true,
          attachment_ids: taskAttachments.map(
            (attachment) => attachment.file_id,
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Gagal menugaskan agen.");
      }
      setNewTaskTitle("");
      setNewTaskDesc("");
      taskPasted.clear();
      setTaskAttachments([]);
      setActiveActionModal(null);
      showToast(
        `✅ Tugas diberikan ke ${getShortFirstName(selectedAgent, selectedAgentIndex)} (${selectedAgentStation?.optimalModel || "Smart AI"}) & sedang dikerjakan otomatis!`,
        5000,
      );
      await loadOfficeData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal membuat tugas.");
    } finally {
      setSubmittingTask(false);
    }
  }

  async function handleTaskFilesSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    const remainingSlots = Math.max(0, 5 - taskAttachments.length);
    const files = selectedFiles.slice(0, remainingSlots);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    setTaskUploadError(
      selectedFiles.length > remainingSlots ? "Maksimal 5 file lampiran." : "",
    );
    setUploadingTaskFiles(true);
    try {
      for (const file of files) {
        const attachment = await uploadAttachment(file);
        setTaskAttachments((previous) => [...previous, attachment]);
      }
    } catch (err) {
      setTaskUploadError(
        err instanceof Error ? err.message : "Gagal mengunggah file.",
      );
    } finally {
      setUploadingTaskFiles(false);
    }
  }

  async function handleChatFilesSelected(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (selectedFiles.length === 0) return;

    const remainingSlots = Math.max(0, 5 - chatAttachments.length);
    const files = selectedFiles.slice(0, remainingSlots);
    setChatUploadError(
      selectedFiles.length > remainingSlots ? "Maksimal 5 file lampiran." : "",
    );

    setUploadingChatFiles(true);
    try {
      for (const file of files) {
        const attachment = await uploadAttachment(file);
        setChatAttachments((previous) => [...previous, attachment]);
      }
    } catch (err) {
      setChatUploadError(
        err instanceof Error ? err.message : "Gagal mengunggah file.",
      );
    } finally {
      setUploadingChatFiles(false);
    }
  }

  async function handleAskProgressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    const typed = chatInput.trim();
    const question =
      typed || chatPasted.blocks.length > 0
        ? chatPasted.compose(typed || "Tolong periksa teks/kode berikut.")
        : `Halo ${selectedAgent.name}, bagaimana progres pekerjaanmu saat ini di proyek ${activeProject?.name || branding.office_name}?`;
    setChatLoading(true);
    setChatReply("");
    try {
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          session_id: `office-agent-${selectedAgent.id}`,
          agent_id: selectedAgent.id,
          project_id: activeProject?.id ?? null,
          model: "auto",
          attachment_ids: chatAttachments.map((item) => item.file_id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Gagal menghubungi agen.");
      setChatReply(data.message || "Siap, sedang saya kerjakan.");
      setChatModelUsed(data.model_used || "");
      setChatInput("");
      chatPasted.clear();
      setChatAttachments([]);
    } catch (err) {
      setChatReply(
        err instanceof Error ? err.message : "Gagal menghubungi agen.",
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function handleCreateProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjName.trim()) return;
    setCreatingProj(true);
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjName.trim(),
          description: newProjDesc.trim() || `Proyek baru di ${branding.office_name}`,
          status: "In Progress",
        }),
      });
      const created = await res.json();
      if (res.ok && created?.id) {
        setSelectedProjectId(created.id);
        setNewProjName("");
        setNewProjDesc("");
        setActiveActionModal(null);
        await loadOfficeData();
        showToast(`🎉 Proyek "${created.name}" berhasil dibuat!`);
      }
    } finally {
      setCreatingProj(false);
    }
  }

  const segBtn = (active: boolean, strong = false) =>
    `rounded-lg px-3 py-1.5 font-semibold transition ${
      active
        ? strong
          ? "bg-violet-600 text-white"
          : "bg-white/15 text-white"
        : "text-slate-400 hover:text-white"
    }`;

  /* ================================================================ */
  /* Render                                                            */
  /* ================================================================ */
  return (
    <div
      className="relative h-[calc(100vh-1px)] min-h-[680px] w-full select-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #e8dff5 0%, #b8a9d2 55%, #756a91 100%)",
      }}
    >
      {/* Kanvas 3D */}
      <div
        ref={mountRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Label overlay (posisi di-update langsung dari loop animasi) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          ref={ceoLabelRef}
          className="absolute left-0 top-0 z-10 will-change-transform"
          style={{ visibility: "hidden" }}
        >
          <div className="whitespace-nowrap rounded-full bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-900 shadow-lg">
            Kamu · CEO
          </div>
        </div>

        {agents.slice(0, layout.stations.length).map((a, i) => {
          const busyTitle = busyByAgent.get(a.id);
          const selected = selectedAgentId === a.id;
          const dot = `#${layout.stations[i].shirtColor.toString(16).padStart(6, "0")}`;
          return (
            <div
              key={a.id}
              ref={(el) => {
                if (el) badgeRefs.current.set(a.id, el);
                else badgeRefs.current.delete(a.id);
              }}
              className="absolute left-0 top-0 z-10 flex flex-col items-center gap-1 will-change-transform"
              style={{ visibility: "hidden" }}
            >
              {busyTitle && (
                <div className="max-w-[160px] truncate rounded-lg border border-amber-300/30 bg-[#2a2118]/90 px-2 py-0.5 text-[10px] text-amber-100 shadow">
                  {busyTitle}
                </div>
              )}
              <button
                type="button"
                aria-label={`Pilih peran ${a.role}`}
                title={a.role}
                onClick={(e) => {
                  e.stopPropagation();
                  openMenuAt(a.id, e.clientX, e.clientY);
                }}
                className={`pointer-events-auto flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-md backdrop-blur-md transition ${
                  selected
                    ? "scale-105 border-violet-300 bg-violet-600/95 text-white"
                    : "border-white/15 bg-[#1a1626]/85 text-slate-200 hover:border-white/40"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${busyTitle ? "animate-pulse" : ""}`}
                  style={{
                    background: dot,
                    boxShadow: busyTitle ? "0 0 0 2px #f5b54655" : undefined,
                  }}
                />
                <span className="max-w-[155px] truncate">{a.role}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* HUD proyek */}
      <div className="absolute left-4 top-4 z-20 flex max-w-xl flex-col gap-2.5">
        <div
          className={`flex flex-wrap items-center gap-4 rounded-2xl px-5 py-3.5 shadow-2xl ${PANEL}`}
        >
          <div className="min-w-[200px]">
            <select
              value={activeProject?.id ?? ""}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              className="cursor-pointer bg-transparent text-base font-bold text-slate-50 outline-none hover:text-violet-200"
            >
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  className="bg-[#1a1626] text-white"
                >
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-0.5 max-w-[290px] truncate text-xs text-slate-400">
              {activeProject?.description ||
                "Pilih agen di kantor untuk memberi tugas atau cek progres."}
            </p>
          </div>

          <div className="min-w-[130px] rounded-xl border border-white/10 bg-[#100d1a] px-3.5 py-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-200">${simulatedSpend}</span>
              <span className="text-slate-500">/ $10.00</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                style={{ width: `${Math.max(15, progressPct)}%` }}
                className="h-full rounded-full bg-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <button
              type="button"
              onClick={() => setActiveActionModal("new_project")}
              title="Buat Proyek Baru"
              className="rounded-lg p-2 transition hover:bg-white/10 hover:text-white"
            >
              ➕
            </button>
            <button
              type="button"
              onClick={() => setActiveActionModal("board")}
              title="Buka Papan Tugas Proyek"
              className="rounded-lg p-2 transition hover:bg-white/10 hover:text-white"
            >
              ⊞
            </button>
            {onOpenClassicDashboard && (
              <button
                type="button"
                onClick={onOpenClassicDashboard}
                title="Tampilan Analitik Tabel"
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                📊 Tabel
              </button>
            )}
          </div>
        </div>

        {!connectionOk && (
          <div className="rounded-xl border border-amber-500/30 bg-[#2b2218]/95 px-4 py-2.5 text-xs font-medium text-amber-200 shadow-lg">
            Koneksi ke kantor terputus, mencoba menyambung ulang...
          </div>
        )}
        {toastMessage && (
          <div
            role="status"
            className="rounded-xl border border-emerald-400/30 bg-[#16221c]/95 px-4 py-2.5 text-xs font-medium text-emerald-200 shadow-lg"
          >
            {toastMessage}
          </div>
        )}
      </div>

      {/* Menu konteks agen */}
      {selectedAgent && (
        <div
          style={{ left: menuScreenPos.x, top: menuScreenPos.y }}
          className={`absolute z-30 w-56 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl ${PANEL}`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 pb-2.5 pt-3.5">
            <div>
              <h4 className="text-sm font-bold text-slate-50">
                {getShortFirstName(selectedAgent, selectedAgentIndex)}
              </h4>
              <p className="max-w-[155px] truncate text-[10px] text-slate-400">
                {selectedAgent.role} ·{" "}
                <span className="text-violet-300">
                  {selectedAgentStation?.optimalModel}
                </span>
              </p>
            </div>
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => {
                setSelectedAgentId(null);
                onSelectRef.current?.(null);
              }}
              className="px-1 text-sm text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="divide-y divide-white/5 text-sm">
            {[
              {
                label: "Beri tugas",
                act: () => setActiveActionModal("assign"),
              },
              {
                label: "Tanya progres",
                act: () => {
                  setChatReply("");
                  setActiveActionModal("chat");
                },
              },
              {
                label: "Lihat hasil",
                act: () => setActiveActionModal("result"),
              },
            ].map((it) => (
              <button
                key={it.label}
                type="button"
                onClick={it.act}
                className="w-full px-4 py-3 text-left font-medium text-slate-200 transition hover:bg-violet-600/25 hover:text-white"
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bar bawah */}
      <div className="pointer-events-none absolute inset-x-5 bottom-4 z-20 flex flex-col items-center justify-between gap-3 md:flex-row">
        <p className="text-[11px] text-slate-400/90">
          Klik lantai untuk berjalan · klik agen untuk menu · seret untuk
          memutar
        </p>
        <div
          className={`pointer-events-auto flex items-center gap-1 rounded-xl p-1 text-xs shadow-xl ${PANEL}`}
        >
          <button
            type="button"
            onClick={() => setRoleMode("Watcher")}
            className={segBtn(roleMode === "Watcher", true)}
          >
            Watcher
          </button>
          <button
            type="button"
            onClick={() => setRoleMode("CEO")}
            className={segBtn(roleMode === "CEO", true)}
          >
            CEO
          </button>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => setCameraDim("2.5D")}
            className={segBtn(cameraDim === "2.5D")}
          >
            2.5D
          </button>
          <button
            type="button"
            onClick={() => setCameraDim("3D")}
            className={segBtn(cameraDim === "3D")}
          >
            3D
          </button>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tracking-tight text-slate-300">
            SolusiMacro Office
          </p>
          <p className="text-[11px] text-slate-500">{clockText}</p>
        </div>
      </div>

      {/* Modal: beri tugas */}
      {activeActionModal === "assign" && selectedAgent && (
        <Modal
          onClose={closeModal}
          title={`📋 Beri Tugas ke ${getIndonesianAlias(selectedAgent, selectedAgentIndex)}`}
          subtitle={
            <>
              Model optimal otomatis:{" "}
              <span className="font-semibold text-violet-300">
                {selectedAgentStation?.optimalModel}
              </span>
            </>
          }
        >
          <form onSubmit={handleAssignTaskSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Judul Tugas
              </label>
              <input
                type="text"
                required
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Contoh: Buat sistem rekap stok otomatis multi-gudang..."
                className={INPUT}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Instruksi Detail untuk Agen
              </label>
              <textarea
                rows={3}
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                onPaste={taskPasted.onPaste}
                placeholder="Jelaskan kebutuhan hasil kerja yang ingin Anda tinjau... (teks/kode panjang yang ditempel jadi kartu lampiran)"
                className={INPUT}
              />
              {taskPasted.blocks.length > 0 && (
                <div className="mt-2">
                  <PastedChips
                    blocks={taskPasted.blocks}
                    onRemove={taskPasted.remove}
                    disabled={submittingTask}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={taskFileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.csv,image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={handleTaskFilesSelected}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => taskFileInputRef.current?.click()}
                  disabled={
                    uploadingTaskFiles ||
                    submittingTask ||
                    taskAttachments.length >= 5
                  }
                  className={BTN_GHOST}
                >
                  {uploadingTaskFiles ? "Mengunggah..." : "📎 Upload File"}
                </button>
                <span className="text-[11px] text-slate-500">
                  Excel .xlsx/.xlsm, CSV, atau gambar · maks. 5 file, 10 MB/file
                </span>
              </div>
              {taskAttachments.length > 0 && (
                <ul className="space-y-1">
                  {taskAttachments.map((attachment) => (
                    <li
                      key={attachment.file_id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
                    >
                      <span className="truncate">📎 {attachment.filename}</span>
                      <button
                        type="button"
                        aria-label={`Hapus ${attachment.filename}`}
                        onClick={() =>
                          setTaskAttachments((previous) =>
                            previous.filter(
                              (item) => item.file_id !== attachment.file_id,
                            ),
                          )
                        }
                        className="shrink-0 text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {taskUploadError && (
                <p role="alert" className="text-xs text-red-300">
                  {taskUploadError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <select
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(
                    e.target.value as "Low" | "Normal" | "High" | "Urgent",
                  )
                }
                className="rounded-xl border border-white/10 bg-[#100d1a] px-3 py-2 text-xs text-white"
              >
                <option value="Normal">Prioritas: Normal</option>
                <option value="High">Prioritas: High</option>
                <option value="Urgent">Prioritas: Urgent</option>
                <option value="Low">Prioritas: Low</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={BTN_GHOST}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingTask || uploadingTaskFiles}
                  className={BTN_PRIMARY}
                >
                  {submittingTask
                    ? "Menjalankan AI..."
                    : "🚀 Tugaskan & Kerjakan Sekarang"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: tanya progres */}
      {activeActionModal === "chat" && selectedAgent && (
        <Modal
          onClose={closeModal}
          maxW="max-w-xl"
          title={`💬 Tanya Progres — ${getIndonesianAlias(selectedAgent, selectedAgentIndex)}`}
          subtitle={
            <>
              Lokasi: {selectedAgentStation?.roomLabel} · Model:{" "}
              <span className="font-semibold text-violet-300">
                {chatModelUsed || selectedAgentStation?.optimalModel}
              </span>
            </>
          }
        >
          <div className="my-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#100d1a] p-4 text-sm text-slate-200">
            {chatLoading ? (
              <p className="animate-pulse text-slate-400">
                {getShortFirstName(selectedAgent, selectedAgentIndex)} sedang
                menyiapkan laporan progres...
              </p>
            ) : chatReply ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={OFFICE_MD_COMPONENTS}
              >
                {chatReply}
              </ReactMarkdown>
            ) : (
              <p className="text-xs text-slate-400">
                Ketik pertanyaan, atau kirim kosong untuk cek status pekerjaan{" "}
                {getShortFirstName(selectedAgent, selectedAgentIndex)}.
              </p>
            )}
          </div>

          {chatAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {chatAttachments.map((file) => (
                <span
                  key={file.file_id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200"
                >
                  <span>{file.kind === "image" ? "🖼️" : "📊"}</span>
                  <span className="max-w-[140px] truncate">
                    {file.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatAttachments((prev) =>
                        prev.filter((item) => item.file_id !== file.file_id),
                      )
                    }
                    className="text-stone-400 hover:text-white"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {chatUploadError && (
            <p role="alert" className="mb-2 text-xs text-red-300">
              {chatUploadError}
            </p>
          )}

          <input
            ref={chatFileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xlsm,.csv,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleChatFilesSelected}
          />

          {chatPasted.blocks.length > 0 && (
            <div className="mb-2">
              <PastedChips
                blocks={chatPasted.blocks}
                onRemove={chatPasted.remove}
                disabled={chatLoading}
              />
            </div>
          )}
          <form
            onSubmit={handleAskProgressSubmit}
            className="flex gap-2 items-center"
          >
            <button
              type="button"
              aria-label="Upload lampiran"
              title="Upload file Excel, CSV, atau gambar"
              onClick={() => chatFileInputRef.current?.click()}
              disabled={
                chatLoading || uploadingChatFiles || chatAttachments.length >= 5
              }
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-stone-200 transition disabled:opacity-40"
            >
              {uploadingChatFiles ? "..." : "📎"}
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPaste={chatPasted.onPaste}
              placeholder={`Tanya ${getShortFirstName(selectedAgent, selectedAgentIndex)} (kosongkan untuk cek progres otomatis)...`}
              className={`${INPUT} flex-1 text-xs`}
            />
            <button
              type="submit"
              disabled={chatLoading || uploadingChatFiles}
              className={BTN_PRIMARY}
            >
              {chatLoading ? "..." : "Tanya Sekarang"}
            </button>
          </form>
        </Modal>
      )}

      {/* Modal: hasil kerja */}
      {activeActionModal === "result" && selectedAgent && (
        <Modal
          onClose={closeModal}
          maxW="max-w-2xl"
          title={`📂 Hasil Pekerjaan — ${getIndonesianAlias(selectedAgent, selectedAgentIndex)}`}
          subtitle={
            latestTaskWithResult
              ? `Tugas: ${latestTaskWithResult.title} (${latestTaskWithResult.status})`
              : "Belum ada tugas yang diselesaikan oleh agen ini."
          }
        >
          <div className="my-4 flex-1 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#100d1a] p-4 text-sm leading-relaxed text-slate-200">
            {latestTaskWithResult?.result ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={OFFICE_MD_COMPONENTS}
              >
                {latestTaskWithResult.result}
              </ReactMarkdown>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Agen ini belum memiliki output pekerjaan. Klik <b>Beri tugas</b>{" "}
                pada menu agen untuk menugaskan pekerjaan baru.
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            {latestTaskWithResult && (
              <a
                href={`/social-hub?task_id=${latestTaskWithResult.id}`}
                className="rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/25"
              >
                📡 Jadikan Konten 5 Sosmed →
              </a>
            )}
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: papan tugas */}
      {activeActionModal === "board" && (
        <Modal
          onClose={closeModal}
          maxW="max-w-2xl"
          title={`⊞ Papan Tugas — ${activeProject?.name || "Seluruh Proyek"}`}
          subtitle={`${completedCount} dari ${projectTasks.length} tugas selesai`}
        >
          <div className="my-4 flex-1 space-y-2.5 overflow-y-auto">
            {projectTasks.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                Belum ada tugas pada proyek ini. Klik salah satu agen di kantor
                lalu pilih <b>Beri tugas</b>.
              </p>
            ) : (
              projectTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#100d1a] p-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Status:{" "}
                      <span className="text-violet-300">{t.status}</span> ·
                      Prioritas: {t.priority}
                    </p>
                  </div>
                  <a
                    href="/tasks"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Detail →
                  </a>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Modal: proyek baru */}
      {activeActionModal === "new_project" && (
        <Modal onClose={closeModal} maxW="max-w-md" title="➕ Proyek Baru">
          <form onSubmit={handleCreateProjectSubmit} className="mt-4 space-y-3">
            <input
              type="text"
              required
              autoFocus
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="Nama proyek..."
              className={INPUT}
            />
            <textarea
              rows={3}
              value={newProjDesc}
              onChange={(e) => setNewProjDesc(e.target.value)}
              placeholder="Deskripsi singkat proyek..."
              className={INPUT}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className={BTN_GHOST}>
                Batal
              </button>
              <button
                type="submit"
                disabled={creatingProj}
                className={BTN_PRIMARY}
              >
                {creatingProj ? "Menyimpan..." : "Buat Proyek"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
