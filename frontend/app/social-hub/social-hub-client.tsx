"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type PlatformKey = "facebook" | "instagram" | "youtube" | "tiktok" | "threads";

type PlatformMeta = {
  key: PlatformKey;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  activeClass: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    type?: "text" | "password";
    helper?: string;
  }[];
  guide: string[];
};

const PLATFORMS: PlatformMeta[] = [
  {
    key: "facebook",
    label: "Facebook Page",
    shortLabel: "Facebook",
    icon: "📘",
    badgeClass: "border-blue-400/30 bg-blue-500/15 text-blue-200",
    activeClass: "border-blue-400/50 bg-blue-500/20 text-white",
    fields: [
      {
        key: "page_id",
        label: "Facebook Page ID",
        placeholder: "Contoh: 104928374928172",
        helper: "ID numerik halaman Facebook Bisnis Anda.",
      },
      {
        key: "page_access_token",
        label: "Page Access Token (Meta Graph API)",
        placeholder: "EAAGm0PX4ZCps...",
        type: "password",
        helper:
          "Gunakan Page Access Token dengan permission pages_manage_posts & pages_read_engagement.",
      },
    ],
    guide: [
      "Buka Meta for Developers (developers.facebook.com) → Graph API Explorer.",
      "Pilih aplikasi Meta Anda, lalu pilih 'Get Page Access Token'.",
      "Centang izin: pages_show_list, pages_read_engagement, pages_manage_posts.",
      "Salin Page ID dan Page Access Token ke form di bawah lalu klik Verifikasi.",
    ],
  },
  {
    key: "instagram",
    label: "Instagram Business",
    shortLabel: "Instagram",
    icon: "📸",
    badgeClass: "border-pink-400/30 bg-pink-500/15 text-pink-200",
    activeClass: "border-pink-400/50 bg-pink-500/20 text-white",
    fields: [
      {
        key: "ig_user_id",
        label: "Instagram Business Account ID",
        placeholder: "Contoh: 17841405822304914",
        helper:
          "ID akun Instagram Professional/Creator yang terhubung ke Facebook Page (bukan username).",
      },
      {
        key: "access_token",
        label: "Meta User / Page Access Token",
        placeholder: "EAAGm0PX4ZCps...",
        type: "password",
        helper:
          "Token dengan permission instagram_basic & instagram_content_publish.",
      },
    ],
    guide: [
      "Pastikan akun Instagram Anda berjenis Business atau Creator dan tertaut ke Facebook Page.",
      "Di Meta Graph API Explorer, tambahkan izin instagram_basic & instagram_content_publish.",
      "Panggil GET /me/accounts?fields=instagram_business_account untuk mendapatkan ig_user_id.",
      "Catatan: Instagram API mewajibkan Media URL (Gambar/Video publik) saat mempublish postingan.",
    ],
  },
  {
    key: "threads",
    label: "Threads",
    shortLabel: "Threads",
    icon: "🧵",
    badgeClass: "border-purple-400/30 bg-purple-500/15 text-purple-200",
    activeClass: "border-purple-400/50 bg-purple-500/20 text-white",
    fields: [
      {
        key: "threads_user_id",
        label: "Threads User ID",
        placeholder: "Contoh: 259182736451234 (atau ketik 'me')",
        helper:
          "User ID dari Threads API (Anda juga bisa mengisi 'me' untuk verifikasi otomatis).",
      },
      {
        key: "access_token",
        label: "Threads Graph API Access Token",
        placeholder: "THQWF...",
        type: "password",
        helper:
          "Token dari produk 'Threads API' di Meta Developer App (threads_basic & threads_content_publish).",
      },
    ],
    guide: [
      "Buka developers.facebook.com → Buat/buka App dengan use-case 'Access the Threads API'.",
      "Tambahkan permission threads_basic dan threads_content_publish.",
      "Generate User Token untuk akun Threads Anda di menu Threads API → Settings.",
      "VHQ mendukung publish Utas Bersambung (Thread Chain) secara otomatis ke Threads!",
    ],
  },
  {
    key: "youtube",
    label: "YouTube Channel",
    shortLabel: "YouTube",
    icon: "▶️",
    badgeClass: "border-red-400/30 bg-red-500/15 text-red-200",
    activeClass: "border-red-400/50 bg-red-500/20 text-white",
    fields: [
      {
        key: "client_id",
        label: "Google OAuth2 Client ID (Opsional jika pakai Access Token)",
        placeholder: "123456789-abc.apps.googleusercontent.com",
      },
      {
        key: "client_secret",
        label: "Google OAuth2 Client Secret",
        placeholder: "GOCSPX-...",
        type: "password",
      },
      {
        key: "refresh_token",
        label: "Google OAuth2 Refresh Token",
        placeholder: "1//04...",
        type: "password",
        helper:
          "Dengan Client ID + Secret + Refresh Token, VHQ akan memperbarui Access Token secara otomatis.",
      },
      {
        key: "access_token",
        label: "Atau Direct YouTube Access Token (Bearer)",
        placeholder: "ya29.a0...",
        type: "password",
        helper:
          "Scope yang dibutuhkan: https://www.googleapis.com/auth/youtube",
      },
    ],
    guide: [
      "Aktifkan YouTube Data API v3 di Google Cloud Console.",
      "Buat OAuth 2.0 Client ID dan dapatkan Refresh Token melalui Google OAuth2 Playground dengan scope youtube & youtube.upload.",
      "Atau masukkan Access Token langsung untuk verifikasi instan channel YouTube Anda.",
    ],
  },
  {
    key: "tiktok",
    label: "TikTok",
    shortLabel: "TikTok",
    icon: "🎵",
    badgeClass: "border-cyan-400/30 bg-cyan-500/15 text-cyan-200",
    activeClass: "border-cyan-400/50 bg-cyan-500/20 text-white",
    fields: [
      {
        key: "open_id",
        label: "TikTok Open ID (Opsional)",
        placeholder: "_000...",
      },
      {
        key: "access_token",
        label: "TikTok Content Posting API Access Token",
        placeholder: "act.example...",
        type: "password",
        helper:
          "Token OAuth2 TikTok dengan scope user.info.basic & video.publish.",
      },
      {
        key: "privacy_level",
        label: "Default Privacy Level",
        placeholder: "PUBLIC_TO_EVERYONE atau SELF_ONLY",
        helper:
          "Isi PUBLIC_TO_EVERYONE (jika app sudah diaudit TikTok) atau SELF_ONLY (mode sandbox/draft).",
      },
    ],
    guide: [
      "Buka developers.tiktok.com → aktifkan produk 'Content Posting API' (Direct Post).",
      "Minta scope user.info.basic dan video.publish saat otorisasi akun TikTok.",
      "Tempelkan Access Token di bawah. Catatan: TikTok API mewajibkan URL Video (.mp4) saat publish.",
    ],
  },
];

type SocialAccount = {
  id: number;
  platform: PlatformKey;
  label: string;
  enabled: boolean;
  account_name: string;
  account_id: string;
  status: string;
  has_credentials: boolean;
  credentials: Record<string, string>;
  last_verified_at: string | null;
  updated_at: string | null;
};

type SocialPost = {
  id: number;
  title: string;
  topic: string | null;
  platforms: PlatformKey[];
  content: Record<PlatformKey, string>;
  threads_items?: string[];
  media_url: string | null;
  scheduled_at: string | null;
  status: string;
  gas_response: string | null;
  source_task_id: number | null;
  project_id: number | null;
  created_at: string;
  published_at: string | null;
};

type TaskItem = {
  id: number;
  title: string;
  status: string;
  result: string | null;
};

type ProjectItem = {
  id: number;
  name: string;
};

type PostMetric = {
  id: number;
  post_id: number | null;
  platform: PlatformKey;
  label: string;
  external_post_id: string | null;
  title_or_hook: string;
  content_snippet: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_score: number;
  engagement_rate: string;
  ai_pattern_notes: string;
  recorded_at: string;
};

type WinningPatternAnalysis = {
  hook_dna?: string;
  copywriting_formula?: string;
  engagement_triggers?: string;
  recommended_next_topics?: string[];
};

/**
 * Memecah teks utas Threads yang berantakan ([Utas 1], Utas 2:, ['...'], atau ---)
 * menjadi array string per-utas yang bersih dan rapi.
 */
function parseThreadsToItems(rawText: string): string[] {
  const trimmed = (rawText || "").trim();
  if (!trimmed) return [""];

  // Cek bila string berasal dari array Python/JSON seperti "['Utas 1...', 'Utas 2...']"
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const jsonReady = trimmed
        .replace(/^\[\s*'/, '["')
        .replace(/'\s*\]$/, '"]')
        .replace(/'\s*,\s*'/g, '", "');
      const parsed = JSON.parse(jsonReady);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map((item) => cleanSingleUtasText(String(item)))
          .filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    } catch {
      // Lanjut ke regex fallback di bawah
    }
  }

  let parts: string[] = [];

  if (/(?:\r?\n)+\s*---+\s*(?:\r?\n)+/.test(trimmed)) {
    parts = trimmed.split(/(?:\r?\n)+\s*---+\s*(?:\r?\n)+/);
  } else if (
    /(?:\[\s*(?:Utas|Thread|Bagian)\s*\d+[^\]]*\]|(?:^|\n)\s*(?:Utas|Thread|Bagian)\s*\d+\s*[:\-.])/i.test(
      trimmed,
    )
  ) {
    parts = trimmed.split(
      /(?:\[\s*(?:Utas|Thread|Bagian)\s*\d+[^\]]*\]|(?:^|\n)\s*(?:Utas|Thread|Bagian)\s*\d+\s*[:\-.])/i,
    );
  } else {
    parts = [trimmed];
  }

  const cleaned = parts
    .map((p) => cleanSingleUtasText(p))
    .filter((p) => p.length > 0);

  return cleaned.length > 0 ? cleaned : [""];
}

function cleanSingleUtasText(text: string): string {
  return text
    .replace(
      /^\s*(?:\[\s*(?:Utas|Thread|Bagian)\s*\d+[^\]]*\]|(?:Utas|Thread|Bagian)\s*\d+\s*[:\-.]?|\(\d+\/\d+\)|\d+\/\d+\s*[:\-]?)\s*/i,
      "",
    )
    .trim();
}

function joinThreadItems(items: string[]): string {
  return items
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .join("\n\n---\n\n");
}

function getPresetScheduleISO(
  daysOffset: number,
  hour: number,
  minute = 0,
): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysOffset);
  dt.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function SocialHubClient() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [topMetrics, setTopMetrics] = useState<PostMetric[]>([]);
  const [patternAnalysis, setPatternAnalysis] =
    useState<WinningPatternAnalysis | null>(null);
  const [syncingEngagement, setSyncingEngagement] = useState(false);
  const [replicatingWinning, setReplicatingWinning] = useState(false);
  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [metricForm, setMetricForm] = useState({
    platform: "threads" as PlatformKey,
    title_or_hook: "",
    content_snippet: "",
    views: "5000",
    likes: "250",
    comments: "45",
    shares: "80",
    saves: "120",
    ai_pattern_notes: "",
  });
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Account Setup Modal State
  const [setupPlatform, setSetupPlatform] = useState<PlatformKey | null>(null);
  const [credForm, setCredForm] = useState<Record<string, string>>({});
  const [savingAccount, setSavingAccount] = useState(false);
  const [verifyingPlatform, setVerifyingPlatform] =
    useState<PlatformKey | null>(null);

  // Generator Form State
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState(
    "Profesional, edukatif, dan menarik untuk UMKM & pebisnis",
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "threads",
  ]);
  const [sourceTaskId, setSourceTaskId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [genScheduleAt, setGenScheduleAt] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // Multi-day Calendar Generator State
  const [studioMode, setStudioMode] = useState<"single" | "calendar">("single");
  const [calendarDays, setCalendarDays] = useState<number>(5);
  const [calendarStartDate, setCalendarStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [calendarPostTime, setCalendarPostTime] = useState<string>("09:00");
  const [calendarAutoSchedule, setCalendarAutoSchedule] =
    useState<boolean>(true);
  const [queueFilter, setQueueFilter] = useState<
    "ALL" | "Scheduled" | "Draft" | "Published"
  >("ALL");
  const [refiningPlatform, setRefiningPlatform] = useState<PlatformKey | null>(
    null,
  );

  // Active Post Editor State
  const [activePost, setActivePost] = useState<SocialPost | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformKey>("facebook");
  const [editTitle, setEditTitle] = useState("");
  const [editMediaUrl, setEditMediaUrl] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editContent, setEditContent] = useState<Record<PlatformKey, string>>({
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
    threads: "",
  });
  const [threadItems, setThreadItems] = useState<string[]>([""]);
  const [threadsRawMode, setThreadsRawMode] = useState(false);

  const [savingPost, setSavingPost] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState<number | null>(null);
  const [schedulingPost, setSchedulingPost] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function selectPostForEditing(post: SocialPost) {
    setActivePost(post);
    setEditTitle(post.title);
    setEditMediaUrl(post.media_url || "");
    setEditScheduledAt(post.scheduled_at ? post.scheduled_at.slice(0, 16) : "");

    const parsedThreads =
      post.threads_items && post.threads_items.length > 0
        ? post.threads_items
        : parseThreadsToItems(post.content.threads || "");

    const normalizedThreadsStr = joinThreadItems(parsedThreads);

    setThreadItems(parsedThreads.length > 0 ? parsedThreads : [""]);
    setEditContent({
      facebook: post.content.facebook || "",
      instagram: post.content.instagram || "",
      youtube: post.content.youtube || "",
      tiktok: post.content.tiktok || "",
      threads: normalizedThreadsStr,
    });
    if (post.platforms.length > 0) {
      setActiveTab(post.platforms[0]);
    }
  }

  async function requestHubData() {
    const [accRes, postsRes, tasksRes, projectsRes, topMetricsRes] =
      await Promise.all([
        fetch(`${API_URL}/social/accounts`),
        fetch(`${API_URL}/social/posts`),
        fetch(`${API_URL}/tasks`),
        fetch(`${API_URL}/projects`),
        fetch(`${API_URL}/social/engagement/top`),
      ]);

    if (!accRes.ok || !postsRes.ok) {
      throw new Error("Gagal mengambil data Social Hub.");
    }

    const accData = (await accRes.json()) as SocialAccount[];
    const postsData = (await postsRes.json()) as SocialPost[];
    const tasksData = tasksRes.ok
      ? ((await tasksRes.json()) as TaskItem[])
      : [];
    const projectsData = projectsRes.ok
      ? ((await projectsRes.json()) as ProjectItem[])
      : [];
    const metricsData = topMetricsRes.ok
      ? ((await topMetricsRes.json()) as PostMetric[])
      : [];

    return {
      accData,
      postsData,
      completedTasks: tasksData.filter(
        (t) => t.status === "Completed" && t.result,
      ),
      projectsData,
      metricsData,
    };
  }

  async function fetchAllData(preserveActive = false) {
    const { accData, postsData, completedTasks, projectsData, metricsData } =
      await requestHubData();
    setAccounts(accData);
    setPosts(postsData);
    setTasks(completedTasks);
    setProjects(projectsData);
    setTopMetrics(metricsData);

    if (!preserveActive && postsData.length > 0 && !activePost) {
      selectPostForEditing(postsData[0]);
    }
  }

  useEffect(() => {
    let active = true;
    requestHubData()
      .then(
        ({ accData, postsData, completedTasks, projectsData, metricsData }) => {
          if (!active) return;
          setAccounts(accData);
          setPosts(postsData);
          setTasks(completedTasks);
          setProjects(projectsData);
          setTopMetrics(metricsData);
          if (postsData.length > 0) {
            selectPostForEditing(postsData[0]);
          }
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const taskParam = params.get("task_id");
            const topicParam = params.get("topic");
            if (taskParam) setSourceTaskId(taskParam);
            if (topicParam) setTopic(topicParam);
          }
        },
      )
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Gagal memuat Social Hub.",
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

  // Sync threadItems changes back into editContent.threads
  function updateThreadItemsList(nextItems: string[]) {
    const safe = nextItems.length > 0 ? nextItems : [""];
    setThreadItems(safe);
    setEditContent((prev) => ({
      ...prev,
      threads: joinThreadItems(safe),
    }));
  }

  function handleSmartTidyThreads() {
    // Splits any long blocks or [Utas N] markers into clean separate thread cards (<= 480 chars each)
    const raw = joinThreadItems(threadItems);
    const initialSplit = parseThreadsToItems(raw);
    const refined: string[] = [];

    for (const block of initialSplit) {
      if (block.length <= 480) {
        refined.push(block);
      } else {
        // Split by double newline paragraphs so each card stays under 500 chars
        const paragraphs = block
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        let current = "";
        for (const para of paragraphs) {
          if (!current) {
            current = para;
          } else if ((current + "\n\n" + para).length <= 460) {
            current += "\n\n" + para;
          } else {
            refined.push(current);
            current = para;
          }
        }
        if (current) refined.push(current);
      }
    }

    updateThreadItemsList(refined.length > 0 ? refined : [""]);
    setSuccessMessage(
      `Utas Threads berhasil dirapikan menjadi ${refined.length} bagian utas berantai!`,
    );
  }

  function openAccountSetup(platformKey: PlatformKey) {
    const acc = accounts.find((a) => a.platform === platformKey);
    const meta = PLATFORMS.find((p) => p.key === platformKey);
    const initial: Record<string, string> = {};
    if (meta) {
      for (const f of meta.fields) {
        initial[f.key] = acc?.credentials?.[f.key] || "";
      }
    }
    setCredForm(initial);
    setSetupPlatform(platformKey);
    setError("");
  }

  async function handleSaveAccount(e: React.FormEvent, autoVerify = false) {
    e.preventDefault();
    if (!setupPlatform) return;
    setSavingAccount(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(`${API_URL}/social/accounts/${setupPlatform}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          credentials: credForm,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal menyimpan kredensial akun.");
      }

      if (autoVerify) {
        await handleVerifyAccount(setupPlatform, true);
      } else {
        setSuccessMessage(data?.message || "Kredensial akun disimpan.");
        await fetchAllData(true);
        setSetupPlatform(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan kredensial.",
      );
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleVerifyAccount(
    platformKey: PlatformKey,
    closeModalOnSuccess = false,
  ) {
    setVerifyingPlatform(platformKey);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(
        `${API_URL}/social/accounts/${platformKey}/verify`,
        {
          method: "POST",
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Verifikasi gagal.");
      }

      setSuccessMessage(
        data?.message || `Koneksi ${platformKey} terverifikasi!`,
      );
      await fetchAllData(true);
      if (closeModalOnSuccess) {
        setSetupPlatform(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal verifikasi akun.");
      await fetchAllData(true);
    } finally {
      setVerifyingPlatform(null);
    }
  }

  function togglePlatform(key: PlatformKey) {
    setSelectedPlatforms((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== key);
      }
      return [...prev, key];
    });
  }

  async function handleGenerateSocial(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setGenerating(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(`${API_URL}/social/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          platforms: selectedPlatforms,
          tone: tone.trim(),
          source_task_id: sourceTaskId ? Number(sourceTaskId) : null,
          project_id: projectId ? Number(projectId) : null,
          scheduled_at: genScheduleAt ? genScheduleAt.trim() : null,
          save_as_draft: true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "AI gagal men-generate konten.");
      }

      const createdPost = data.post as SocialPost;
      setPosts((prev) => [createdPost, ...prev]);
      selectPostForEditing(createdPost);
      if (createdPost.status === "Scheduled" && createdPost.scheduled_at) {
        setSuccessMessage(
          `Konten "${createdPost.title}" berhasil dibuat & dijadwalkan tayang otomatis pada ${new Date(createdPost.scheduled_at).toLocaleString("id-ID")}!`,
        );
      } else {
        setSuccessMessage(
          `Draf konten "${createdPost.title}" berhasil dibuat untuk 5 platform!`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat konten.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateCalendar(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setGenerating(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(`${API_URL}/social/generate-calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_theme: topic.trim(),
          days: calendarDays,
          start_date: calendarStartDate,
          post_time: calendarPostTime,
          auto_schedule: calendarAutoSchedule,
          platforms: selectedPlatforms,
          tone: tone.trim(),
          project_id: projectId ? Number(projectId) : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "AI gagal menyusun kalender konten.");
      }

      const createdList = (data.posts || []) as SocialPost[];
      if (createdList.length > 0) {
        setPosts((prev) => [...createdList, ...prev]);
        selectPostForEditing(createdList[0]);
      }
      setSuccessMessage(
        `🗓️ Kalender Konten "${data.campaign_name}" (${createdList.length} hari) berhasil dibuat${
          calendarAutoSchedule ? " & dijadwalkan otomatis!" : "!"
        }`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyusun kalender konten.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefinePlatform(
    platformKey: PlatformKey,
    instruction: string,
  ) {
    if (!activePost) return;
    setRefiningPlatform(platformKey);
    setError("");
    setSuccessMessage("");

    const currentText =
      platformKey === "threads"
        ? joinThreadItems(threadItems)
        : editContent[platformKey] || "";

    try {
      const res = await fetch(
        `${API_URL}/social/posts/${activePost.id}/refine`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: platformKey,
            instruction,
            current_content: currentText,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal menyempurnakan konten.");
      }

      const updated = data.post as SocialPost;
      selectPostForEditing(updated);
      setActiveTab(platformKey);
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage(
        `✨ Konten ${platformKey.toUpperCase()} berhasil dipoles oleh AI!`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memoles konten.");
    } finally {
      setRefiningPlatform(null);
    }
  }

  async function handleSyncLiveEngagement() {
    setSyncingEngagement(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch(`${API_URL}/social/engagement/sync-live`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal menarik data engagement.");
      }
      if (Array.isArray(data?.metrics)) {
        setTopMetrics(data.metrics);
      }
      setSuccessMessage(data?.message || "Histori engagement diperbarui.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal sinkronisasi engagement.",
      );
    } finally {
      setSyncingEngagement(false);
    }
  }

  async function handleAnalyzeAndReplicateWinning(customTopic?: string) {
    setReplicatingWinning(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(
        `${API_URL}/social/engagement/analyze-and-generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_topic:
              customTopic !== undefined ? customTopic : topic.trim() || "",
            platforms: selectedPlatforms,
            tone: tone.trim(),
            scheduled_at: genScheduleAt ? genScheduleAt.trim() : null,
            save_as_draft: true,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.detail ||
            "AI gagal mempelajari & mereplikasi postingan engagement tertinggi.",
        );
      }

      if (data.pattern_analysis) {
        setPatternAnalysis(data.pattern_analysis as WinningPatternAnalysis);
      }

      if (data.post) {
        const created = data.post as SocialPost;
        setPosts((prev) => [created, ...prev]);
        selectPostForEditing(created);
      }

      setSuccessMessage(
        "🔥 AI berhasil membedah histori engagement tertinggi & membuatkan paket copywriting baru yang serupa!",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal membuat konten berbasis Winning Engagement.",
      );
    } finally {
      setReplicatingWinning(false);
    }
  }

  async function handleAddMetricSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!metricForm.title_or_hook.trim() || !metricForm.content_snippet.trim())
      return;

    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch(`${API_URL}/social/engagement/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: metricForm.platform,
          title_or_hook: metricForm.title_or_hook.trim(),
          content_snippet: metricForm.content_snippet.trim(),
          views: Number(metricForm.views) || 0,
          likes: Number(metricForm.likes) || 0,
          comments: Number(metricForm.comments) || 0,
          shares: Number(metricForm.shares) || 0,
          saves: Number(metricForm.saves) || 0,
          ai_pattern_notes: metricForm.ai_pattern_notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.detail || "Gagal menyimpan referensi winning post.",
        );
      }

      await fetchAllData(true);
      setShowAddMetricModal(false);
      setMetricForm({
        platform: "threads",
        title_or_hook: "",
        content_snippet: "",
        views: "5000",
        likes: "250",
        comments: "45",
        shares: "80",
        saves: "120",
        ai_pattern_notes: "",
      });
      setSuccessMessage(
        data?.message || "Postingan referensi berhasil ditambahkan.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan data engagement.",
      );
    }
  }

  async function handleDeleteMetric(id: number) {
    try {
      const res = await fetch(`${API_URL}/social/engagement/metrics/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTopMetrics((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      // ignore
    }
  }

  async function handleSavePostEdits() {
    if (!activePost) return;
    setSavingPost(true);
    setError("");
    setSuccessMessage("");

    const finalThreads = joinThreadItems(threadItems);

    try {
      const res = await fetch(`${API_URL}/social/posts/${activePost.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || activePost.title,
          media_url: editMediaUrl.trim() || null,
          scheduled_at: editScheduledAt.trim() || null,
          content_facebook: editContent.facebook,
          content_instagram: editContent.instagram,
          content_youtube: editContent.youtube,
          content_tiktok: editContent.tiktok,
          content_threads: finalThreads,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal menyimpan perubahan konten.");
      }

      const updated = data as SocialPost;
      setActivePost(updated);
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage("Perubahan draf konten berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan draf.");
    } finally {
      setSavingPost(false);
    }
  }

  async function handleSchedulePost() {
    if (!activePost) return;
    if (!editScheduledAt.trim()) {
      setError(
        "Pilih tanggal & jam terlebih dahulu pada kolom Jadwal Tayang Otomatis.",
      );
      return;
    }

    setSchedulingPost(true);
    setError("");
    setSuccessMessage("");

    const finalThreads = joinThreadItems(threadItems);

    try {
      // Save latest content first
      await fetch(`${API_URL}/social/posts/${activePost.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || activePost.title,
          media_url: editMediaUrl.trim() || null,
          scheduled_at: editScheduledAt.trim(),
          content_facebook: editContent.facebook,
          content_instagram: editContent.instagram,
          content_youtube: editContent.youtube,
          content_tiktok: editContent.tiktok,
          content_threads: finalThreads,
        }),
      });

      const res = await fetch(
        `${API_URL}/social/posts/${activePost.id}/schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_at: editScheduledAt.trim(),
            platforms: activePost.platforms,
          }),
        },
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal menjadwalkan konten.");
      }

      const updated = data.post as SocialPost;
      setActivePost(updated);
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage(
        `⏰ Konten "${updated.title}" dijadwalkan tayang otomatis pada ${new Date(editScheduledAt).toLocaleString("id-ID")}!`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menjadwalkan konten.",
      );
    } finally {
      setSchedulingPost(false);
    }
  }

  async function handleUnschedulePost() {
    if (!activePost) return;
    setSchedulingPost(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch(
        `${API_URL}/social/posts/${activePost.id}/unschedule`,
        {
          method: "POST",
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal membatalkan jadwal.");
      }

      const updated = data.post as SocialPost;
      setActivePost(updated);
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage(data.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membatalkan jadwal.",
      );
    } finally {
      setSchedulingPost(false);
    }
  }

  async function handlePublishDirect(
    post: SocialPost,
    targetPlatforms?: PlatformKey[],
  ) {
    setPublishingPostId(post.id);
    setError("");
    setSuccessMessage("");

    const finalThreads = joinThreadItems(threadItems);

    try {
      if (activePost && activePost.id === post.id) {
        await fetch(`${API_URL}/social/posts/${post.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim() || post.title,
            media_url: editMediaUrl.trim() || null,
            scheduled_at: editScheduledAt.trim() || null,
            content_facebook: editContent.facebook,
            content_instagram: editContent.instagram,
            content_youtube: editContent.youtube,
            content_tiktok: editContent.tiktok,
            content_threads: finalThreads,
          }),
        });
      }

      const res = await fetch(`${API_URL}/social/posts/${post.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: targetPlatforms || post.platforms,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Gagal mempublish ke sosial media.");
      }

      const updated = data.post as SocialPost;
      setActivePost(updated);
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      if (data.success) {
        setSuccessMessage(data.message);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mempublish konten.",
      );
      await fetchAllData(true);
    } finally {
      setPublishingPostId(null);
    }
  }

  async function handleDeletePost(postId: number) {
    if (!window.confirm("Hapus draf konten sosial media ini?")) return;
    try {
      const res = await fetch(`${API_URL}/social/posts/${postId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus konten.");
      const remaining = posts.filter((p) => p.id !== postId);
      setPosts(remaining);
      if (activePost?.id === postId) {
        if (remaining.length > 0) {
          selectPostForEditing(remaining[0]);
        } else {
          setActivePost(null);
        }
      }
      setSuccessMessage("Konten berhasil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleCopyText(key: string, text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const connectedCount = accounts.filter(
    (a) => a.status === "Connected",
  ).length;
  const scheduledCount = posts.filter((p) => p.status === "Scheduled").length;
  const activeSetupMeta = PLATFORMS.find((p) => p.key === setupPlatform);

  function parsePublishResults(
    raw: string | null,
  ): Record<
    string,
    {
      success: boolean;
      post_id?: string;
      error?: string;
      details?: { thread_count?: number };
    }
  > | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return null;
    }
    return null;
  }

  return (
    <main className="p-6 md:p-8 flex-1">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-blue-500/20 border border-blue-400/30 px-2.5 py-1 text-xs font-semibold text-blue-300">
              DIRECT NATIVE API + AUTO SCHEDULER
            </span>
            <span className="text-xs text-slate-400">
              Facebook Page · Instagram · YouTube · TikTok · Threads
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">
            Omnichannel Social Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Generate konten 5 platform, susun utas Threads berantai dengan rapi,
            dan publish langsung atau jadwalkan tayang otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-purple-400/25 bg-purple-500/10 px-4 py-2.5 text-xs">
            <span className="text-purple-200">⏰ Terjadwal Otomatis: </span>
            <span className="font-bold text-white">{scheduledCount} Post</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#151d32] px-4 py-2.5 text-xs">
            <span className="text-slate-400">Status Koneksi: </span>
            <span className="font-semibold text-emerald-300">
              {connectedCount} / 5 Platform Terhubung
            </span>
          </div>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError("")}
            className="text-xs underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mt-6 rounded-xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-200 flex items-center justify-between">
          <span>✅ {successMessage}</span>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-xs underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 5 DIRECT PLATFORM CONNECTION CARDS */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            🔌 Koneksi Langsung Masing-Masing Sosial Media (Direct API)
          </h2>
          <span className="text-xs text-slate-500">
            Klik &ldquo;⚙️ Setup API&rdquo; pada platform yang ingin dihubungkan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {PLATFORMS.map((p) => {
            const acc = accounts.find((a) => a.platform === p.key);
            const isConnected = acc?.status === "Connected";
            const isConfigured = acc?.status === "Configured";
            const isError = acc?.status === "Error";

            return (
              <div
                key={p.key}
                className={`rounded-2xl border p-4 transition flex flex-col justify-between ${
                  isConnected
                    ? "border-emerald-400/30 bg-emerald-500/5"
                    : isError
                      ? "border-red-400/30 bg-red-500/5"
                      : "border-white/10 bg-[#151d32]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl">{p.icon}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        isConnected
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                          : isConfigured
                            ? "border-amber-400/30 bg-amber-500/15 text-amber-300"
                            : isError
                              ? "border-red-400/30 bg-red-500/15 text-red-300"
                              : "border-white/10 bg-white/5 text-slate-400"
                      }`}
                    >
                      {isConnected
                        ? "● Connected"
                        : isConfigured
                          ? "● Siap Verifikasi"
                          : isError
                            ? "● Perlu Cek Token"
                            : "○ Belum Diatur"}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-white mt-2.5">
                    {p.label}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {acc?.account_name
                      ? acc.account_name
                      : acc?.has_credentials
                        ? "Kredensial tersimpan"
                        : "Belum ada token API"}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAccountSetup(p.key)}
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition"
                  >
                    ⚙️ Setup API
                  </button>
                  {acc?.has_credentials && (
                    <button
                      type="button"
                      disabled={verifyingPlatform === p.key}
                      onClick={() => handleVerifyAccount(p.key)}
                      title="Verifikasi koneksi ke API resmi"
                      className="rounded-lg border border-blue-400/30 bg-blue-500/15 hover:bg-blue-500/25 px-2.5 py-1.5 text-xs font-medium text-blue-200 transition disabled:opacity-50"
                    >
                      {verifyingPlatform === p.key ? "..." : "⚡ Tes"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI ENGAGEMENT INTELLIGENCE & WINNING COPYWRITING ENGINE */}
      <section className="mt-8 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#161f36] to-[#11182b] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                🔥 AI ENGAGEMENT BOOSTER
              </span>
              <span className="text-xs text-slate-400">
                Mempelajari Histori Postingan Terbaik → Replikasi Copywriting
                Serupa
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1.5">
              📈 Histori Postingan Engagement Tertinggi (Winning Copywriting
              DNA)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              AI secara otomatis mempelajari struktur Hook, ritme kalimat, dan
              pemicu diskusi dari daftar postingan terbaik di bawah ini agar
              engagement konten berikutnya naik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncLiveEngagement}
              disabled={syncingEngagement}
              className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
            >
              {syncingEngagement ? "⏳ Syncing..." : "🔄 Tarik Data dari API"}
            </button>

            <button
              type="button"
              onClick={() => setShowAddMetricModal(true)}
              className="rounded-xl border border-blue-400/30 bg-blue-500/15 hover:bg-blue-500/25 px-3.5 py-2 text-xs font-semibold text-blue-200 transition"
            >
              ➕ Input Postingan Viral / Referensi
            </button>

            <button
              type="button"
              onClick={() => handleAnalyzeAndReplicateWinning()}
              disabled={replicatingWinning}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              {replicatingWinning
                ? "🧠 AI Sedang Membedah & Menulis..."
                : "🔥 Pelajari & Buat Konten Serupa Sekarang"}
            </button>
          </div>
        </div>

        {/* AI WINNING DNA BREAKDOWN CARD (WHEN ANALYZED) */}
        {patternAnalysis && (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                🧬 Hasil Bedah Formula Copywriting Pemenang (Winning DNA)
              </h3>
              <button
                type="button"
                onClick={() => setPatternAnalysis(null)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                ✕ Sembunyikan
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-white/10 bg-[#0b1020]/80 p-3">
                <p className="font-semibold text-amber-300 mb-1">
                  🎣 Pola Hook Pemenang
                </p>
                <p className="text-slate-300 leading-relaxed">
                  {patternAnalysis.hook_dna}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0b1020]/80 p-3">
                <p className="font-semibold text-blue-300 mb-1">
                  📐 Rumus Struktur Copywriting
                </p>
                <p className="text-slate-300 leading-relaxed">
                  {patternAnalysis.copywriting_formula}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0b1020]/80 p-3">
                <p className="font-semibold text-emerald-300 mb-1">
                  💬 Pemicu Komentar & Share
                </p>
                <p className="text-slate-300 leading-relaxed">
                  {patternAnalysis.engagement_triggers}
                </p>
              </div>
            </div>

            {patternAnalysis.recommended_next_topics &&
              patternAnalysis.recommended_next_topics.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-amber-200">
                    💡 Klik untuk Buat Konten dari Ide Topik Serupa:
                  </span>
                  {patternAnalysis.recommended_next_topics.map((idea, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={replicatingWinning}
                      onClick={() => {
                        setTopic(idea);
                        void handleAnalyzeAndReplicateWinning(idea);
                      }}
                      className="rounded-lg border border-amber-400/30 bg-[#0b1020] hover:bg-amber-500/20 px-3 py-1 text-[11px] text-amber-100 transition"
                    >
                      ✨ {idea}
                    </button>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* TOP PERFORMING POSTS LEADERBOARD */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {topMetrics.slice(0, 6).map((m, idx) => {
            const meta = PLATFORMS.find((p) => p.key === m.platform);
            return (
              <div
                key={m.id}
                className="rounded-xl border border-white/10 bg-[#0b1020]/90 p-4 flex flex-col justify-between hover:border-amber-400/30 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                        meta?.badgeClass ||
                        "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      #{idx + 1} · {meta?.icon} {m.label}
                    </span>
                    <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                      🔥 Score {m.engagement_score.toLocaleString("id-ID")} (
                      {m.engagement_rate})
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white mt-2.5 line-clamp-2">
                    &ldquo;{m.title_or_hook}&rdquo;
                  </h3>

                  <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-3 whitespace-pre-line">
                    {m.content_snippet}
                  </p>

                  {m.ai_pattern_notes && (
                    <p className="mt-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] text-amber-200/90">
                      💡 <strong>Pola:</strong> {m.ai_pattern_notes}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>👁️ {m.views.toLocaleString("id-ID")}</span>
                    <span>❤️ {m.likes.toLocaleString("id-ID")}</span>
                    <span>💬 {m.comments.toLocaleString("id-ID")}</span>
                    <span>🔁 {m.shares.toLocaleString("id-ID")}</span>
                    <span>🔖 {m.saves.toLocaleString("id-ID")}</span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={replicatingWinning}
                      onClick={() =>
                        handleAnalyzeAndReplicateWinning(
                          `Buat konten baru dengan struktur hook & gaya copywriting persis seperti: "${m.title_or_hook}"`,
                        )
                      }
                      className="flex-1 rounded-lg border border-amber-400/30 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition disabled:opacity-50"
                    >
                      🧬 Buat Copywriting Serupa Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMetric(m.id)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-500 hover:text-red-300"
                      title="Hapus dari daftar referensi"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL ADD WINNING POST / METRIC */}
      {showAddMetricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#11182b] p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">
                ➕ Tambah Histori Postingan Engagement Tinggi (Winning Post)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMetricModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Tutup
              </button>
            </div>

            <form onSubmit={handleAddMetricSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Platform Asal
                  </label>
                  <select
                    value={metricForm.platform}
                    onChange={(e) =>
                      setMetricForm((prev) => ({
                        ...prev,
                        platform: e.target.value as PlatformKey,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 text-xs text-white"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.icon} {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Atau Ambil dari Postingan VHQ
                  </label>
                  <select
                    onChange={(e) => {
                      const found = posts.find(
                        (p) => String(p.id) === e.target.value,
                      );
                      if (found) {
                        const plat = found.platforms[0] || "threads";
                        const body =
                          found.content[plat] || found.content.facebook || "";
                        setMetricForm((prev) => ({
                          ...prev,
                          platform: plat,
                          title_or_hook: found.title,
                          content_snippet: body,
                        }));
                      }
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- Ketik Manual / Pilih Post --</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} · {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kalimat Hook / Judul Pembuka yang Viral
                </label>
                <input
                  type="text"
                  required
                  value={metricForm.title_or_hook}
                  onChange={(e) =>
                    setMetricForm((prev) => ({
                      ...prev,
                      title_or_hook: e.target.value,
                    }))
                  }
                  placeholder="Contoh: 90% pemilik UMKM merasa omzetnya naik, tapi saldo jalan di tempat..."
                  className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Isi Copywriting Lengkap (Untuk Dipelajari AI)
                </label>
                <textarea
                  rows={4}
                  required
                  value={metricForm.content_snippet}
                  onChange={(e) =>
                    setMetricForm((prev) => ({
                      ...prev,
                      content_snippet: e.target.value,
                    }))
                  }
                  placeholder="Tempelkan teks postingan atau utas terbaik Anda di sini..."
                  className="w-full rounded-xl border border-white/10 bg-[#0b1020] p-3 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[
                  { k: "views", l: "👁️ Views" },
                  { k: "likes", l: "❤️ Likes" },
                  { k: "comments", l: "💬 Komen" },
                  { k: "shares", l: "🔁 Share" },
                  { k: "saves", l: "🔖 Save" },
                ].map((f) => (
                  <div key={f.k}>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      {f.l}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={metricForm[f.k as keyof typeof metricForm]}
                      onChange={(e) =>
                        setMetricForm((prev) => ({
                          ...prev,
                          [f.k]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#0b1020] px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catatan Mengapa Postingan Ini Ramai (Opsional)
                </label>
                <input
                  type="text"
                  value={metricForm.ai_pattern_notes}
                  onChange={(e) =>
                    setMetricForm((prev) => ({
                      ...prev,
                      ai_pattern_notes: e.target.value,
                    }))
                  }
                  placeholder="Contoh: Pakai angka spesifik + pertanyaan pilihan 1/2/3 di akhir"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddMetricModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950"
                >
                  💾 Simpan ke Memori AI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SETUP PER PLATFORM */}
      {setupPlatform && activeSetupMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#11182b] p-6 shadow-2xl my-8">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeSetupMeta.icon}</span>
                  <h2 className="text-lg font-bold text-white">
                    Setup Koneksi Langsung: {activeSetupMeta.label}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Kredensial disimpan secara lokal di database VHQ Anda dan
                  digunakan untuk memanggil API resmi {activeSetupMeta.label}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSetupPlatform(null)}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:text-white"
              >
                ✕ Tutup
              </button>
            </div>

            {/* QUICK SETUP GUIDE */}
            <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4">
              <p className="text-xs font-semibold text-blue-200 mb-2">
                💡 Cara Mendapatkan Token {activeSetupMeta.label}:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                {activeSetupMeta.guide.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <form
              onSubmit={(e) => handleSaveAccount(e, false)}
              className="mt-5 space-y-4"
            >
              {activeSetupMeta.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type={field.type || "text"}
                    value={credForm[field.key] || ""}
                    onChange={(e) =>
                      setCredForm((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-4 py-2.5 text-sm text-white focus:border-blue-400 focus:outline-none"
                  />
                  {field.helper && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {field.helper}
                    </p>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSetupPlatform(null)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="rounded-xl border border-blue-400/30 bg-blue-500/15 hover:bg-blue-500/25 px-4 py-2.5 text-xs font-semibold text-blue-200 disabled:opacity-50"
                >
                  {savingAccount ? "Menyimpan..." : "💾 Simpan Kredensial"}
                </button>
                <button
                  type="button"
                  disabled={
                    savingAccount || verifyingPlatform === setupPlatform
                  }
                  onClick={(e) => handleSaveAccount(e, true)}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {verifyingPlatform === setupPlatform
                    ? "Memverifikasi ke API..."
                    : "⚡ Simpan & Verifikasi Koneksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE GRID */}
      <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: AI GENERATOR + QUEUE LIST (5 COLS) */}
        <div className="xl:col-span-5 space-y-6">
          {/* AI OMNICHANNEL GENERATOR */}
          <div className="rounded-2xl border border-white/10 bg-[#151d32] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  ✨ AI Omnichannel Content Studio
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Buat 1 konten instan atau susun Kalender Kampanye Multi-Hari
                  otomatis.
                </p>
              </div>

              <div className="flex rounded-xl border border-white/10 bg-[#0b1020] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStudioMode("single")}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    studioMode === "single"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⚡ 1 Post
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode("calendar")}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    studioMode === "calendar"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🗓️ Kalender 3-7 Hari
                </button>
              </div>
            </div>

            <form
              onSubmit={
                studioMode === "calendar"
                  ? handleGenerateCalendar
                  : handleGenerateSocial
              }
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {studioMode === "calendar"
                    ? "Tema Kampanye Multi-Hari (Edukasi → Studi Kasus → Solusi)"
                    : "Topik / Perintah Konten (Bisa Sertakan Perintah Jadwal)"}
                </label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={
                    studioMode === "calendar"
                      ? "Contoh: Kampanye edukasi transformasi pembukuan UMKM dari Excel manual ke Dashboard Otomatis Solusi Macro..."
                      : "Contoh: Buatkan konten edukasi 5 tanda keuangan UMKM bocor karena rekap manual, dan jadwalkan tayang besok pagi jam 09:00..."
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0b1020] p-3.5 text-sm text-white focus:border-blue-400 focus:outline-none"
                  required
                />
              </div>

              {studioMode === "calendar" && (
                <div className="rounded-xl border border-purple-400/25 bg-[#0b1020] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-200">
                      🗓️ Pengaturan Kalender Kampanye Otomatis
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={calendarAutoSchedule}
                        onChange={(e) =>
                          setCalendarAutoSchedule(e.target.checked)
                        }
                        className="rounded"
                      />
                      Auto-Schedule tiap hari
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Durasi Hari
                      </label>
                      <select
                        value={calendarDays}
                        onChange={(e) =>
                          setCalendarDays(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#151d32] px-2.5 py-2 text-xs text-white"
                      >
                        <option value={3}>3 Hari</option>
                        <option value={5}>5 Hari</option>
                        <option value={7}>7 Hari (1 Minggu)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Mulai Tanggal
                      </label>
                      <input
                        type="date"
                        value={calendarStartDate}
                        onChange={(e) => setCalendarStartDate(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#151d32] px-2.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Jam Tayang/Hari
                      </label>
                      <input
                        type="time"
                        value={calendarPostTime}
                        onChange={(e) => setCalendarPostTime(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#151d32] px-2.5 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Ambil Konteks dari Task Selesai (Opsional)
                  </label>
                  <select
                    value={sourceTaskId}
                    onChange={(e) => {
                      setSourceTaskId(e.target.value);
                      if (e.target.value && !topic.trim()) {
                        const found = tasks.find(
                          (t) => String(t.id) === e.target.value,
                        );
                        if (found) {
                          setTopic(
                            `Konversi hasil task "${found.title}" menjadi konten edukasi & promosi omnichannel.`,
                          );
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2.5 text-xs text-white"
                  >
                    <option value="">-- Tanpa Task Spesifik --</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} · {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Project Terkait (Opsional)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SCHEDULE PRESETS IN GENERATOR */}
              <div className="rounded-xl border border-purple-400/20 bg-[#0b1020] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-200">
                    ⏰ Jadwalkan Tayang Otomatis Saat Selesai Generate
                    (Opsional)
                  </label>
                  {genScheduleAt && (
                    <button
                      type="button"
                      onClick={() => setGenScheduleAt("")}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Reset ke Draft
                    </button>
                  )}
                </div>

                <input
                  type="datetime-local"
                  value={genScheduleAt}
                  onChange={(e) => setGenScheduleAt(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#151d32] px-3 py-2 text-xs text-white"
                />

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setGenScheduleAt(getPresetScheduleISO(0, 19, 0))
                    }
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-purple-500/20 hover:border-purple-400/30 px-2.5 py-1 text-[11px] text-slate-300 transition"
                  >
                    🌙 Malam Ini 19:00
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGenScheduleAt(getPresetScheduleISO(1, 9, 0))
                    }
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-purple-500/20 hover:border-purple-400/30 px-2.5 py-1 text-[11px] text-slate-300 transition"
                  >
                    ☀️ Besok 09:00
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGenScheduleAt(getPresetScheduleISO(1, 12, 0))
                    }
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-purple-500/20 hover:border-purple-400/30 px-2.5 py-1 text-[11px] text-slate-300 transition"
                  >
                    🕛 Besok 12:00
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGenScheduleAt(getPresetScheduleISO(1, 19, 30))
                    }
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-purple-500/20 hover:border-purple-400/30 px-2.5 py-1 text-[11px] text-slate-300 transition"
                  >
                    🔥 Besok 19:30
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Gaya Bahasa (Tone of Voice)
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Target Platform Sosial Media
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const checked = selectedPlatforms.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePlatform(p.key)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                          checked
                            ? p.activeClass
                            : "border-white/10 bg-[#0b1020] text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>{p.icon}</span>
                        <span>{p.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={generating || !topic.trim()}
                className={`w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50 transition ${
                  studioMode === "calendar"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/20"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/20"
                }`}
              >
                {generating
                  ? studioMode === "calendar"
                    ? `🗓️ Menyusun Kalender Konten ${calendarDays} Hari...`
                    : "🤖 Social Media Specialist sedang meracik 5 konten..."
                  : studioMode === "calendar"
                    ? `🗓️ Generate Kalender Konten ${calendarDays} Hari (5 Platform)`
                    : genScheduleAt
                      ? "⏰ Generate & Jadwalkan Tayang Otomatis"
                      : "⚡ Generate Konten 5 Platform dengan AI"}
              </button>
            </form>
          </div>

          {/* SAVED SOCIAL POSTS / QUEUE */}
          <div className="rounded-2xl border border-white/10 bg-[#151d32] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h2 className="text-base font-bold text-white">
                🗂️ Antrean Jadwal & Riwayat Konten ({posts.length})
              </h2>

              <div className="flex flex-wrap gap-1">
                {(["ALL", "Scheduled", "Draft", "Published"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setQueueFilter(f)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        queueFilter === f
                          ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                          : "bg-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {f === "ALL"
                        ? "Semua"
                        : f === "Scheduled"
                          ? "⏰ Terjadwal"
                          : f}
                    </button>
                  ),
                )}
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Memuat daftar konten...
              </p>
            ) : posts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-400">
                Belum ada draf konten. Gunakan generator AI di atas untuk
                membuat paket konten pertama Anda.
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {posts
                  .filter(
                    (p) => queueFilter === "ALL" || p.status === queueFilter,
                  )
                  .map((post) => {
                  const isSelected = activePost?.id === post.id;
                  return (
                    <div
                      key={post.id}
                      onClick={() => selectPostForEditing(post)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-blue-400/50 bg-blue-500/15"
                          : "border-white/10 bg-[#0f172a] hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white line-clamp-1">
                          {post.title}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                            post.status === "Published"
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                              : post.status === "Scheduled"
                                ? "border-purple-400/40 bg-purple-500/20 text-purple-200"
                                : post.status === "Partial"
                                  ? "border-amber-400/30 bg-amber-500/15 text-amber-300"
                                  : post.status === "Failed"
                                    ? "border-red-400/30 bg-red-500/15 text-red-300"
                                    : "border-slate-400/30 bg-slate-500/15 text-slate-300"
                          }`}
                        >
                          {post.status === "Scheduled"
                            ? "⏰ Scheduled"
                            : post.status}
                        </span>
                      </div>

                      {post.scheduled_at && (
                        <div className="mt-2 rounded-lg border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-200 flex items-center justify-between">
                          <span>
                            ⏰ Jadwal Tayang:{" "}
                            <strong>
                              {new Date(post.scheduled_at).toLocaleString(
                                "id-ID",
                              )}
                            </strong>
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {PLATFORMS.filter((p) =>
                          post.platforms.includes(p.key),
                        ).map((p) => (
                          <span
                            key={p.key}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${p.badgeClass}`}
                          >
                            {p.icon} {p.shortLabel}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10 text-[11px] text-slate-400">
                        <span>
                          {new Date(post.created_at).toLocaleString("id-ID")}
                        </span>
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handlePublishDirect(post)}
                            disabled={publishingPostId === post.id}
                            className="rounded-lg bg-emerald-600/20 border border-emerald-400/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                          >
                            {publishingPostId === post.id
                              ? "Publishing..."
                              : "🚀 Publish Sekarang"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/20"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MULTI-PLATFORM EDITOR, THREAD BUILDER & SCHEDULER (7 COLS) */}
        <div className="xl:col-span-7">
          {!activePost ? (
            <div className="rounded-2xl border border-white/10 bg-[#151d32] p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="text-4xl mb-3">📡</div>
              <h3 className="text-lg font-bold text-white">
                Pilih atau Generate Konten Sosial Media
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md">
                Gunakan panel AI Omnichannel Studio di sebelah kiri untuk
                membuat draf otomatis bagi Facebook Page, Instagram, YouTube,
                TikTok, dan Threads.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#151d32] p-6 space-y-5">
              {/* TOP BAR: TITLE + SAVE / PUBLISH BUTTONS */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                      Editor & Publisher · Post #{activePost.id}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        activePost.status === "Scheduled"
                          ? "border-purple-400/40 bg-purple-500/20 text-purple-200"
                          : activePost.status === "Published"
                            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                            : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {activePost.status}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3.5 py-2 text-base font-bold text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSavePostEdits}
                    disabled={savingPost}
                    className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                  >
                    {savingPost ? "Menyimpan..." : "💾 Simpan Draf"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePublishDirect(activePost)}
                    disabled={publishingPostId === activePost.id}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                  >
                    {publishingPostId === activePost.id
                      ? "⏳ Mempublish..."
                      : "🚀 Publish Sekarang"}
                  </button>
                </div>
              </div>

              {/* MEDIA URL & AUTO-SCHEDULER CONTROL BAR */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-xl border border-white/10 bg-[#0f172a] p-4">
                <div className="lg:col-span-5">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    🖼️ URL Media Publik (.jpg / .png / .mp4)
                  </label>
                  <input
                    type="text"
                    value={editMediaUrl}
                    onChange={(e) => setEditMediaUrl(e.target.value)}
                    placeholder="https://domain.com/media.jpg (Wajib untuk IG/TikTok)"
                    className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-purple-200">
                      ⏰ Jadwal Tayang Otomatis (Auto-Publish oleh Server VHQ)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setEditScheduledAt(getPresetScheduleISO(0, 19, 0))
                        }
                        className="rounded bg-white/5 hover:bg-purple-500/20 px-2 py-0.5 text-[10px] text-slate-300"
                      >
                        19:00 Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditScheduledAt(getPresetScheduleISO(1, 9, 0))
                        }
                        className="rounded bg-white/5 hover:bg-purple-500/20 px-2 py-0.5 text-[10px] text-slate-300"
                      >
                        Besok 09:00
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      value={editScheduledAt}
                      onChange={(e) => setEditScheduledAt(e.target.value)}
                      className="flex-1 min-w-[180px] rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={schedulingPost}
                      onClick={handleSchedulePost}
                      className="rounded-xl border border-purple-400/40 bg-purple-500/20 hover:bg-purple-500/30 px-3.5 py-2 text-xs font-semibold text-purple-100 transition disabled:opacity-50"
                    >
                      {schedulingPost
                        ? "..."
                        : activePost.status === "Scheduled"
                          ? "⏰ Update Jadwal"
                          : "⏰ Aktifkan Jadwal"}
                    </button>
                    {activePost.status === "Scheduled" && (
                      <button
                        type="button"
                        disabled={schedulingPost}
                        onClick={handleUnschedulePost}
                        className="rounded-xl border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-xs text-red-200 transition"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* PLATFORM TABS */}
              <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
                {PLATFORMS.map((p) => {
                  const isTabActive = activeTab === p.key;
                  const acc = accounts.find((a) => a.platform === p.key);
                  const isConnected = acc?.status === "Connected";
                  const badgeCount =
                    p.key === "threads"
                      ? `${threadItems.filter((x) => x.trim()).length} utas`
                      : `${(editContent[p.key] || "").length}`;

                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setActiveTab(p.key)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition flex items-center gap-2 ${
                        isTabActive
                          ? p.activeClass
                          : "border-white/10 bg-[#0b1020] text-slate-400 hover:text-white"
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.shortLabel}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isConnected ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                        title={
                          isConnected
                            ? `Terhubung: ${acc?.account_name}`
                            : "Belum terhubung"
                        }
                      />
                      <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {badgeCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* AI MAGIC POLISH / REFINE BAR */}
              <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-indigo-200">
                  {refiningPlatform === activeTab
                    ? `🤖 AI sedang memoles konten ${activeTab.toUpperCase()}...`
                    : `🪄 AI Polish (${activeTab.toUpperCase()}):`}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      label: "🔥 Pertajam Hook",
                      prompt:
                        "Buat kalimat pembuka (Hook) jauh lebih tajam, memancing rasa penasaran tinggi, dan menghentikan scroll.",
                    },
                    {
                      label: "✂️ Persingkat & Rapi",
                      prompt:
                        "Persingkat kalimat yang bertele-tele, gunakan spasi antar paragraf yang rapi dan punchy.",
                    },
                    {
                      label: "📊 +Studi Kasus UMKM",
                      prompt:
                        "Tambahkan contoh/ilustrasi kasus nyata operasional UMKM di Indonesia agar lebih relevan.",
                    },
                    {
                      label: "🎯 Perkuat CTA Solusi Macro",
                      prompt:
                        "Perkuat Call-to-Action di bagian akhir untuk mengajak diskusi atau konsultasi otomasi Excel/Dashboard bersama Solusi Macro.",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={refiningPlatform !== null}
                      onClick={() =>
                        handleRefinePlatform(activeTab, preset.prompt)
                      }
                      className="rounded-lg border border-indigo-400/30 bg-[#0b1020]/70 hover:bg-indigo-500/25 px-2.5 py-1 text-[11px] font-medium text-indigo-100 transition disabled:opacity-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ACTIVE PLATFORM CONTENT EDITOR */}
              {PLATFORMS.map((p) => {
                if (p.key !== activeTab) return null;
                const acc = accounts.find((a) => a.platform === p.key);
                const isConnected = acc?.status === "Connected";

                // SPECIAL VISUAL PER-UTAS BUILDER FOR THREADS
                if (p.key === "threads") {
                  return (
                    <div key="threads" className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🧵</span>
                          <div>
                            <h3 className="text-sm font-bold text-white">
                              Susunan Utas Threads Berantai (
                              {threadItems.length} Bagian Utas)
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {isConnected
                                ? `🟢 Siap mempublish ${threadItems.length} utas bersambung otomatis ke ${acc?.account_name}`
                                : "⚪ Setiap kartu di bawah adalah 1 postingan utas yang saling menyambung (maks 500 karakter/utas)"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSmartTidyThreads}
                            className="rounded-lg border border-purple-400/30 bg-purple-500/15 hover:bg-purple-500/25 px-3 py-1.5 text-xs font-semibold text-purple-200 transition"
                            title="Bersihkan label [Utas 1] dan bagi paragraf panjang menjadi kartu utas rapi"
                          >
                            🪄 Rapikan Per Utas
                          </button>

                          <button
                            type="button"
                            onClick={() => setThreadsRawMode((prev) => !prev)}
                            className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs text-slate-300 transition"
                          >
                            {threadsRawMode
                              ? "🧵 Mode Kartu Utas"
                              : "📝 Mode Teks Gabungan"}
                          </button>

                          <button
                            type="button"
                            disabled={publishingPostId === activePost.id}
                            onClick={() =>
                              handlePublishDirect(activePost, ["threads"])
                            }
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition disabled:opacity-50"
                          >
                            🚀 Publish Utas ke Threads
                          </button>
                        </div>
                      </div>

                      {threadsRawMode ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400">
                            Pisahkan antar utas dengan baris{" "}
                            <code className="text-purple-300">---</code>:
                          </p>
                          <textarea
                            rows={12}
                            value={editContent.threads}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditContent((prev) => ({
                                ...prev,
                                threads: val,
                              }));
                              setThreadItems(parseThreadsToItems(val));
                            }}
                            className="w-full rounded-xl border border-white/10 bg-[#0b1020] p-4 text-sm text-slate-100 leading-relaxed focus:border-purple-400 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {threadItems.map((itemText, idx) => {
                            const len = itemText.length;
                            const isOver = len > 500;
                            const isNear = len > 450 && len <= 500;
                            const isLast = idx === threadItems.length - 1;

                            return (
                              <div
                                key={idx}
                                className="relative flex gap-3.5 items-stretch"
                              >
                                {/* VERTICAL THREAD LINE COLUMN */}
                                <div className="flex flex-col items-center pt-1">
                                  <div className="h-8 w-8 rounded-full border border-purple-400/40 bg-purple-500/20 text-purple-200 flex items-center justify-center text-xs font-bold shrink-0">
                                    {idx + 1}
                                  </div>
                                  {!isLast && (
                                    <div className="w-0.5 flex-1 bg-gradient-to-b from-purple-400/40 to-purple-400/10 my-1.5" />
                                  )}
                                </div>

                                {/* UTAS CARD */}
                                <div className="flex-1 pb-4">
                                  <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-4 hover:border-purple-400/30 transition">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">
                                          {idx === 0
                                            ? "Utas #1 (Pembuka / Hook Utama)"
                                            : idx === threadItems.length - 1 &&
                                                threadItems.length > 1
                                              ? `Utas #${idx + 1} (Penutup / CTA Diskusi)`
                                              : `Utas #${idx + 1} (Balasan Berantai)`}
                                        </span>
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                            isOver
                                              ? "bg-red-500/20 text-red-300 border border-red-400/30"
                                              : isNear
                                                ? "bg-amber-500/20 text-amber-300"
                                                : "bg-white/5 text-slate-400"
                                          }`}
                                        >
                                          {len} / 500 karakter
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {idx > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const copy = [...threadItems];
                                              const temp = copy[idx - 1];
                                              copy[idx - 1] = copy[idx];
                                              copy[idx] = temp;
                                              updateThreadItemsList(copy);
                                            }}
                                            className="rounded border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-0.5 text-[11px] text-slate-300"
                                            title="Pindah ke atas"
                                          >
                                            ↑
                                          </button>
                                        )}
                                        {!isLast && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const copy = [...threadItems];
                                              const temp = copy[idx + 1];
                                              copy[idx + 1] = copy[idx];
                                              copy[idx] = temp;
                                              updateThreadItemsList(copy);
                                            }}
                                            className="rounded border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-0.5 text-[11px] text-slate-300"
                                            title="Pindah ke bawah"
                                          >
                                            ↓
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCopyText(
                                              `utas-${idx}`,
                                              itemText,
                                            )
                                          }
                                          className="rounded border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-0.5 text-[11px] text-slate-300"
                                        >
                                          {copiedKey === `utas-${idx}`
                                            ? "✅ Disalin"
                                            : "📋 Salin"}
                                        </button>
                                        {threadItems.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = threadItems.filter(
                                                (_, i) => i !== idx,
                                              );
                                              updateThreadItemsList(next);
                                            }}
                                            className="rounded border border-red-400/20 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 text-[11px] text-red-300"
                                          >
                                            🗑️
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <textarea
                                      rows={Math.max(
                                        3,
                                        Math.min(
                                          8,
                                          itemText.split("\n").length + 1,
                                        ),
                                      )}
                                      value={itemText}
                                      onChange={(e) => {
                                        const next = [...threadItems];
                                        next[idx] = e.target.value;
                                        updateThreadItemsList(next);
                                      }}
                                      placeholder={`Tulis isi Utas #${idx + 1} di sini...`}
                                      className="w-full rounded-xl border border-white/10 bg-[#131b30] p-3.5 text-sm text-slate-100 leading-relaxed focus:border-purple-400 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          <div className="pl-11 pt-1 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                updateThreadItemsList([...threadItems, ""])
                              }
                              className="rounded-xl border border-dashed border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2.5 text-xs font-semibold text-purple-200 transition"
                            >
                              ➕ Tambah Utas Lanjutan (Utas #
                              {threadItems.length + 1})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // STANDARD EDITOR FOR FACEBOOK, INSTAGRAM, YOUTUBE, TIKTOK
                return (
                  <div key={p.key} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.icon}</span>
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Format {p.label}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {isConnected
                              ? `🟢 Siap publish langsung ke ${acc?.account_name}`
                              : "⚪ Belum terhubung — klik Setup API di atas untuk mengaktifkan direct publish"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(p.key, editContent[p.key] || "")
                          }
                          className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
                        >
                          {copiedKey === p.key
                            ? "✅ Tersalin!"
                            : "📋 Salin Teks"}
                        </button>

                        <button
                          type="button"
                          disabled={publishingPostId === activePost.id}
                          onClick={() =>
                            handlePublishDirect(activePost, [p.key])
                          }
                          className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition disabled:opacity-50"
                        >
                          🚀 Publish ke {p.shortLabel} Saja
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={12}
                      value={editContent[p.key]}
                      onChange={(e) =>
                        setEditContent((prev) => ({
                          ...prev,
                          [p.key]: e.target.value,
                        }))
                      }
                      placeholder={`Tulis atau edit konten khusus untuk ${p.label}...`}
                      className="w-full rounded-xl border border-white/10 bg-[#0b1020] p-4 text-sm text-slate-100 leading-relaxed font-sans focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                );
              })}

              {/* PER-PLATFORM DIRECT PUBLISH REPORT */}
              {activePost.gas_response && (
                <div className="rounded-xl border border-white/10 bg-[#0b1020] p-4">
                  <p className="text-xs font-semibold text-slate-300 mb-2">
                    📡 Status Hasil Publish Langsung per Platform:
                  </p>
                  {(() => {
                    const parsed = parsePublishResults(activePost.gas_response);
                    if (!parsed) {
                      return (
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono">
                          {activePost.gas_response}
                        </pre>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {Object.entries(parsed).map(([plat, info]) => {
                          const meta = PLATFORMS.find((m) => m.key === plat);
                          return (
                            <div
                              key={plat}
                              className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
                                info.success
                                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                  : "border-red-400/25 bg-red-500/10 text-red-200"
                              }`}
                            >
                              <div className="font-semibold">
                                {meta?.icon} {meta?.label || plat.toUpperCase()}
                              </div>
                              <div className="text-right">
                                {info.success
                                  ? `✅ Berhasil Dipublish (ID: ${info.post_id || "OK"}${
                                      info.details?.thread_count
                                        ? ` · ${info.details.thread_count} Utas Berantai`
                                        : ""
                                    })`
                                  : `❌ ${info.error || "Gagal"}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
