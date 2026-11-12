from datetime import datetime
import os

from dotenv import load_dotenv
from openai import OpenAI
from excel_vba_service import (
    EXCEL_VBA_BUILDER_INSTRUCTIONS,
    extract_and_compile_artifacts,
    needs_excel_vba_builder,
)

load_dotenv()

AI_PROVIDER = os.getenv("VHQ_AI_PROVIDER", "octa").strip().lower()
OCTA_API_KEY = os.getenv("OCTA_API_KEY")
OCTA_BASE_URL = os.getenv(
    "OCTA_BASE_URL",
    "https://octa.telkomsel.com/v1"
)
OCTA_MODEL = os.getenv(
    "OCTA_MODEL",
    "claude-sonnet-5"
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_BASE_URL = os.getenv(
    "GEMINI_BASE_URL",
    "https://generativelanguage.googleapis.com/v1beta/openai/",
)
GEMINI_MODEL = (
    os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    or "gemini-2.5-flash"
)

OCTA_AVAILABLE_MODELS = [
    {
        "id": "auto",
        "label": "⚡ Smart Multi-Model (Optimal per Task)",
        "description": "Otomatis memilih model terbaik dari 5 model OCTA sesuai jenis tugas (Opus 5.5, Sonnet 5, Gemini 3.1 Pro, DeepSeek v4.1 Flash, GPT-5.4 Nano).",
    },
    {
        "id": "claude-opus-5-5",
        "label": "🏆 Claude Opus 5.5 (Flagship Viral Copy & AI CEO)",
        "description": "Terbaik untuk Bedah DNA Engagement Viral, Copywriting Emosional, dan Strategi Eksekutif AI CEO.",
    },
    {
        "id": "claude-sonnet-5",
        "label": "🚀 Claude Sonnet 5 (Omnichannel & Specialist Agent)",
        "description": "Cepat & natural untuk Generate Konten 5 Platform, Utas Threads, dan analisis bisnis.",
    },
    {
        "id": "gemini-3.1-pro-preview",
        "label": "🧠 Gemini 3.1 Pro (Kalender Kampanye & Task Planner)",
        "description": "Unggul untuk perencanaan terstruktur: Kalender Konten 3-7 Hari, Project Task Planner, dan Dashboard.",
    },
    {
        "id": "deepseek-v4.1-flash",
        "label": "⚡ DeepSeek v4.1 Flash (Magic Polish, Excel & Otomasi)",
        "description": "Sangat cepat & tajam untuk Revisi/Polish Copywriting, Utas Threads, Formula Excel, dan Kode Otomasi.",
    },
    {
        "id": "gpt-5.4-nano",
        "label": "🪶 GPT-5.4 Nano (Ultra Cepat & Ringan)",
        "description": "Respons instan tanpa jeda untuk draf singkat, instruksi cepat, dan backup failover.",
    },
]

VALID_MODEL_IDS = {
    "claude-opus-5-5",
    "claude-sonnet-5",
    "gemini-3.1-pro-preview",
    "deepseek-v4.1-flash",
    "gpt-5.4-nano",
}

if AI_PROVIDER == "gemini":
    AVAILABLE_MODELS = [
        {
            "id": "auto",
            "label": "⚡ Auto (Gemini API)",
            "description": f"Gunakan model Gemini {GEMINI_MODEL} untuk semua tugas.",
        },
        {
            "id": "gemini-direct",
            "label": f"🧠 Gemini ({GEMINI_MODEL})",
            "description": "Gunakan API Gemini langsung dari Google.",
        },
    ]
    VALID_MODEL_IDS.add("gemini-direct")
else:
    AVAILABLE_MODELS = OCTA_AVAILABLE_MODELS

TASK_OPTIMAL_MODEL_MAP = {
    # 1. Claude Opus 5.5 -> Strategi level CEO & Replikasi Copywriting Viral berbasis histori engagement
    "winning_copy": "claude-opus-5-5",
    "ceo_chat": "claude-opus-5-5",
    # 2. Claude Sonnet 5 -> Pembuatan paket konten 5 sosmed sekaligus & diskusi agent bisnis/kreatif
    "social_post": "claude-sonnet-5",
    "agent_chat": "claude-sonnet-5",
    "agent_exec": "claude-sonnet-5",
    # 3. Gemini 3.1 Pro -> Perencanaan JSON terstruktur skala besar (Kalender 7 hari & Task Planner)
    "calendar": "gemini-3.1-pro-preview",
    "planner": "gemini-3.1-pro-preview",
    "agent_dashboard": "gemini-3.1-pro-preview",
    # 4. DeepSeek v4.1 Flash -> Revisi/polish kilat per-platform & eksekusi teknis (Excel / Automation)
    "refine": "deepseek-v4.1-flash",
    "agent_technical": "deepseek-v4.1-flash",
    # 5. GPT-5.4 Nano -> Draf kilat / tugas ringan instan
    "quick_draft": "gpt-5.4-nano",
}


def resolve_ai_model(
    requested_model: str | None = None,
    task_type: str = "general",
    agent_role_or_name: str = "",
) -> str:
    """
    Menentukan model AI paling optimal berdasarkan jenis task dan spesialisasi agent:
    - Jika Founder memilih model spesifik di UI, gunakan model tersebut.
    - Jika mode 'auto' (Smart Multi-Model), arahkan ke model paling optimal untuk task_type.
    """
    if AI_PROVIDER == "gemini":
        return GEMINI_MODEL

    if requested_model and requested_model.strip() in VALID_MODEL_IDS:
        return requested_model.strip()

    # Pemilihan spesifik berdasarkan spesialisasi Agent (untuk eksekusi task atau chat agent)
    role_lower = (agent_role_or_name or "").strip().lower()
    if role_lower:
        if "ai ceo" in role_lower or role_lower == "ceo":
            return "claude-opus-5-5"
        if any(
            k in role_lower
            for k in ("excel", "spreadsheet", "automation", "otomasi", "engineer", "macro")
        ):
            return "deepseek-v4.1-flash"
        if any(k in role_lower for k in ("dashboard", "reporting", "data", "kpi")):
            return "gemini-3.1-pro-preview"
        if any(k in role_lower for k in ("quick", "nano", "ringkas")):
            return "gpt-5.4-nano"

    return TASK_OPTIMAL_MODEL_MAP.get(task_type, "claude-sonnet-5")


# ============================================================
# HELPER: MEMBACA DICTIONARY ATAU SQLALCHEMY OBJECT
# ============================================================

def get_value(data, key, default=None):
    """
    Membaca data dari dictionary maupun objek SQLAlchemy.
    """

    if data is None:
        return default

    if isinstance(data, dict):
        return data.get(key, default)

    return getattr(data, key, default)


# ============================================================
# AI CLIENT & SMART COMPLETION WITH FAILOVER
# ============================================================

def get_ai_client():
    if AI_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY belum diatur di file backend/.env"
            )

        return OpenAI(
            api_key=GEMINI_API_KEY,
            base_url=GEMINI_BASE_URL,
            timeout=95.0,
        )

    if AI_PROVIDER == "octa":
        if not OCTA_API_KEY:
            raise RuntimeError(
                "OCTA_API_KEY belum diatur di file .env"
            )

        return OpenAI(
            api_key=OCTA_API_KEY,
            base_url=OCTA_BASE_URL,
            timeout=95.0,
        )

    raise RuntimeError(
        "VHQ_AI_PROVIDER harus bernilai 'octa' atau 'gemini'"
    )


def _chat_completion_with_fallback(
    model: str,
    messages: list[dict],
    max_tokens: int = 3000,
    temperature: float = 0.5,
) -> tuple[str, str]:
    """
    Menjalankan completion melalui provider yang aktif. OCTA menggunakan rantai
    failover multi-model, sedangkan Gemini API memakai model yang dikonfigurasi.
    """
    client = get_ai_client()
    if AI_PROVIDER == "gemini":
        fallback_chain = [GEMINI_MODEL]
    else:
        fallback_chain = [model]
        for fb in ("claude-sonnet-5", "deepseek-v4.1-flash", "gpt-5.4-nano"):
            if fb not in fallback_chain:
                fallback_chain.append(fb)

    last_error = None
    for candidate_model in fallback_chain:
        effective_max_tokens = (
            max(max_tokens, 5000)
            if candidate_model in {"gemini-3.1-pro-preview", "gemini-2.5-pro"}
            else max_tokens
        )
        try:
            response = client.chat.completions.create(
                model=candidate_model,
                messages=messages,
                max_tokens=effective_max_tokens,
                temperature=temperature,
            )
            content = (response.choices[0].message.content or "").strip()
            if content:
                return content, candidate_model
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    raise RuntimeError("Tidak ada output dari model AI.")


# ============================================================
# AI CEO & SPECIALIST AGENT CHAT
# ============================================================

def ask_claude(
    message: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    model: str | None = None,
    agent_name: str = "AI CEO",
    image_urls: list[str] | None = None,
) -> str:
    is_ceo = not agent_name or agent_name.strip().upper() == "AI CEO"
    chosen_model = resolve_ai_model(
        model,
        task_type="ceo_chat" if is_ceo else "agent_chat",
        agent_role_or_name=agent_name,
    )
    if image_urls and chosen_model == "deepseek-v4.1-flash":
        chosen_model = "claude-sonnet-5"

    base_sys = system_prompt or (
        "Kamu adalah AI CEO Solusi Macro Virtual HQ. "
        "Bantu Founder mengelola bisnis secara profesional. "
        "Gunakan Bahasa Indonesia yang jelas dan profesional. "
        "Gunakan Markdown normal tanpa meng-escape tanda baca."
    )
    if needs_excel_vba_builder(message) or image_urls:
        base_sys = base_sys + "\n\n" + EXCEL_VBA_BUILDER_INSTRUCTIONS

    messages: list[dict] = [
        {
            "role": "system",
            "content": base_sys,
        }
    ]

    if history:
        for item in history:
            role = get_value(item, "role")
            content = get_value(item, "content")

            if role in ("user", "assistant") and content:
                messages.append({
                    "role": role,
                    "content": content
                })

    if image_urls:
        multimodal_content: list[dict] = [{"type": "text", "text": message}]
        for url in image_urls[:5]:
            if url:
                multimodal_content.append(
                    {"type": "image_url", "image_url": {"url": url}}
                )
        messages.append({"role": "user", "content": multimodal_content})
    else:
        messages.append({
            "role": "user",
            "content": message
        })

    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=messages,
        max_tokens=3600,
        temperature=0.55,
    )
    return content


# ============================================================
# AI CEO TASK PLANNER (OPTIMAL: GEMINI 3.1 PRO)
# ============================================================

def generate_task_plan(
    project: dict,
    agents: list[dict],
    existing_tasks: list[dict],
    instruction: str,
    model: str | None = None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="planner")

    planner_system_prompt = """
Kamu adalah AI CEO sekaligus AI Project Planner Solusi Macro.

TUGAS:
Susun rencana kerja project berdasarkan instruksi Founder.

ATURAN:
1. Gunakan hanya agent yang tersedia dalam data.
2. Setiap task wajib memiliki assigned_agent_id dari daftar agent.
3. Jangan membuat ID project atau agent sendiri.
4. Jangan membuat task duplikat dari daftar existing_tasks.
5. Buat task yang spesifik, realistis, dan bisa dikerjakan.
6. Prioritas hanya boleh: Low, Normal, High, Urgent.
7. Maksimal 15 task dalam satu rencana.
8. Jangan mengklaim task sudah disimpan atau dijalankan.
9. Jika instruksi tidak cukup jelas, tetap buat usulan yang masuk akal.
10. Jelaskan asumsi dalam field notes.
11. Urutkan tasks sesuai alur kerja: pahami kebutuhan dan data, rancang solusi,
    implementasikan, lalu uji dan dokumentasikan hasil. Lewati tahap yang tidak
    relevan dan jangan membuat task hanya untuk mengisi tahap.
12. Eksekusi mengikuti urutan array tasks; setiap agent menerima hasil task
    sebelumnya. Tulis dependensi dan handoff yang penting di description.
13. Untuk pekerjaan implementasi, tutup dengan validasi/QA sebelum hasil akhir
    diserahkan kepada Founder untuk ditinjau.
14. Pilih agent menurut keahlian dan deliverable, bukan hanya kemiripan judul.
    Gunakan Business Analyst untuk kebutuhan/proses, Excel Engineer untuk
    spreadsheet, Automation Engineer untuk workflow, Dashboard Analyst untuk
    visualisasi/reporting, QA & Documentation untuk pengujian/dokumentasi,
    Secretary untuk administrasi/koordinasi, dan Social Media Specialist
    hanya untuk kebutuhan marketing/konten.

OUTPUT:
Kembalikan JSON valid saja.
Jangan gunakan Markdown code fence.
Jangan tambahkan teks di luar JSON.

FORMAT:
{
  "plan_title": "Judul rencana kerja",
  "summary": "Ringkasan rencana",
  "notes": "Catatan atau asumsi",
  "tasks": [
    {
      "title": "Judul task",
      "description": "Deskripsi pekerjaan dan hasil yang diharapkan",
      "priority": "High",
      "assigned_agent_id": 3
    }
  ]
}
"""

    payload = {
        "project": project,
        "available_agents": agents,
        "existing_tasks": existing_tasks,
        "founder_instruction": instruction
    }

    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[
            {
                "role": "system",
                "content": planner_system_prompt
            },
            {
                "role": "user",
                "content": str(payload)
            }
        ],
        max_tokens=4000,
        temperature=0.2,
    )
    return content


# ============================================================
# AI AGENT TASK EXECUTOR (OPTIMAL BY SPECIALIST ROLE)
# ============================================================

def execute_agent_task(
    agent,
    project,
    task,
    prior_results=None,
    model: str | None = None,
    extra_context: str = "",
    image_urls: list[str] | None = None,
) -> str:
    # Membaca data Agent, Project, dan Task.
    # Bisa berupa dictionary atau SQLAlchemy object.

    agent_name = get_value(
        agent,
        "name",
        "AI Agent"
    )

    agent_role = get_value(
        agent,
        "role",
        "Specialist"
    )

    agent_department = get_value(
        agent,
        "department",
        "General"
    )

    agent_description = get_value(
        agent,
        "description",
        ""
    )

    chosen_model = resolve_ai_model(
        model,
        task_type="agent_exec",
        agent_role_or_name=f"{agent_name} {agent_role} {agent_department}",
    )
    if image_urls and chosen_model == "deepseek-v4.1-flash":
        chosen_model = "claude-sonnet-5"

    project_name = get_value(
        project,
        "name",
        "-"
    )

    project_description = get_value(
        project,
        "description",
        "-"
    )

    task_title = get_value(
        task,
        "title",
        "-"
    )

    task_description = get_value(
        task,
        "description",
        "-"
    )

    task_priority = get_value(
        task,
        "priority",
        "Normal"
    )

    prior_results = prior_results or []

    system_prompt = f"""
Kamu adalah {agent_name}, AI Specialist di Solusi Macro Virtual HQ.

IDENTITAS AGENT:
Nama: {agent_name}
Jabatan: {agent_role}
Departemen: {agent_department}
Deskripsi: {agent_description}

PROFIL BISNIS SOLUSI MACRO:

Solusi Macro menyediakan layanan:
- Excel dan spreadsheet automation.
- Dashboard dan business reporting.
- Business process automation.
- Solusi operasional untuk UMKM.
- Solusi digital untuk startup dan perusahaan.

TANGGUNG JAWAB KAMU:

1. Kerjakan task sesuai keahlian dan jabatanmu.
2. Berikan hasil pekerjaan yang konkret dan dapat ditinjau Founder.
3. Gunakan Bahasa Indonesia profesional.
4. Jika diminta membuat rancangan, berikan rancangan terstruktur.
5. Jika diminta membuat kode, berikan kode lengkap dan penjelasannya.
6. Jika diminta membuat SOP atau dokumen, tuliskan isi dokumen secara lengkap.
7. Jangan mengaku telah mengubah file, database, aplikasi, atau sistem eksternal.
8. Jangan mengarang hasil pengujian atau tindakan yang belum dilakukan.
9. Jika informasi kurang, jelaskan asumsi dan kebutuhan informasi.
10. Hindari jawaban terlalu umum atau sekadar menjelaskan teori.

FORMAT HASIL PEKERJAAN:

## 1. Ringkasan Pekerjaan
Jelaskan pekerjaan yang dilakukan.

## 2. Hasil Pekerjaan
Berikan hasil konkret sesuai task.

## 3. Rekomendasi
Berikan rekomendasi tindak lanjut jika diperlukan.

## 4. Catatan
Sebutkan asumsi, keterbatasan, atau kebutuhan tambahan.

Pastikan hasil pekerjaan bisa ditinjau dan dievaluasi oleh Founder.
"""

    if image_urls or needs_excel_vba_builder(
        f"{task_title} {task_description} {agent_role} {extra_context}"
    ):
        system_prompt = system_prompt + "\n\n" + EXCEL_VBA_BUILDER_INSTRUCTIONS

    user_prompt = f"""
PROJECT:
{project_name}

DESKRIPSI PROJECT:
{project_description}

TASK:
{task_title}

DESKRIPSI TASK:
{task_description}

PRIORITAS:
{task_priority}

HASIL PEKERJAAN AGENT SEBELUMNYA:
{prior_results}

{extra_context}

INSTRUKSI:
Kerjakan task ini sekarang sesuai jabatan dan tanggung jawabmu.

Berikan hasil pekerjaan yang lengkap, konkret, dan bisa ditinjau Founder.
"""

    user_content: str | list[dict] = user_prompt
    if image_urls:
        user_content = [{"type": "text", "text": user_prompt}]
        user_content.extend(
            {
                "type": "image_url",
                "image_url": {"url": image_url},
            }
            for image_url in image_urls[:5]
        )

    result, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_content
            }
        ],
        max_tokens=4000,
        temperature=0.3,
    )

    if not result:
        raise RuntimeError(
            f"AI Agent {agent_name} tidak menghasilkan output."
        )

    compiled_result, _ = extract_and_compile_artifacts(
        result,
        prefix=task_title,
        force_excel_if_table=needs_excel_vba_builder(
            f"{task_title} {task_description} {agent_role} {extra_context}"
        ),
    )
    return compiled_result


# ============================================================
# AI OMNICHANNEL SOCIAL CONTENT GENERATOR (OPTIMAL: SONNET 5)
# ============================================================

def generate_social_content(
    topic: str,
    platforms: list[str],
    source_context: str = "",
    tone: str = "Profesional, edukatif, dan menarik untuk UMKM & pebisnis",
    winning_posts_context: str = "",
    model: str | None = None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="social_post")

    system_prompt = """
Kamu adalah AI Social Media & Content Strategist di Solusi Macro Virtual HQ.

PROFIL SOLUSI MACRO:
Solusi Macro membantu UMKM, startup, dan perusahaan melalui:
- Excel & Spreadsheet Automation
- Business Dashboard & Reporting
- Business Process Automation & Efisiensi Operasional

TUGAS:
Buat paket konten media sosial siap tayang yang disesuaikan dengan karakteristik 5 platform:
1. Facebook Page (`facebook`): Storytelling bisnis, edukatif, ramah diskusi, dilengkapi CTA jelas.
2. Instagram (`instagram`): Format struktur Carousel (Slide 1..N) + Caption menarik + Hashtag relevan.
3. YouTube (`youtube`): Judul video SEO-friendly, Deskripsi lengkap, Timestamp/Outline, dan Tags, atau naskah YouTube Shorts.
4. TikTok (`tiktok`): Naskah video pendek dengan Hook 3 detik pertama yang kuat, Body visual/narasi singkat, CTA, dan Caption + Hashtag.
5. Threads (`threads`): Buat 3 sampai 5 utas (thread) berantai yang ringkas, natural, conversational, dan mudah dibaca (maksimal 450 karakter per utas). JANGAN tulis label "[Utas 1]" atau "Utas 1:" di dalam teks. Pisahkan setiap bagian utas menggunakan baris pemisah persis: \n\n---\n\n

OUTPUT WAJIB:
Kembalikan HANYA JSON valid tanpa teks tambahan di luar JSON dan tanpa markdown code fence.

FORMAT JSON:
{
  "title": "Judul kampanye konten",
  "facebook": "Isi konten Facebook Page...",
  "instagram": "Isi konten Instagram...",
  "youtube": "Isi konten YouTube...",
  "tiktok": "Isi konten TikTok...",
  "threads": [
    "Utas pertama (Hook tajam & memancing rasa penasaran, gunakan spasi antar paragraf agar rapi)...",
    "Utas kedua (Masalah utama / insight praktis dengan bullet point singkat)...",
    "Utas ketiga (Solusi konkret / langkah yang bisa langsung dipraktikkan)...",
    "Utas keempat (Penutup & pertanyaan diskusi / CTA lembut)..."
  ],
  "scheduled_at": "YYYY-MM-DDTHH:MM jika Founder menyebut jadwal tayang (contoh: besok jam 09:00), atau null jika tidak"
}
"""

    user_payload = {
        "current_local_time": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "topic_or_instruction": topic,
        "target_platforms": platforms,
        "tone": tone,
        "source_task_or_project_context": source_context,
        "winning_high_engagement_posts_to_emulate": winning_posts_context,
    }

    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(user_payload)},
        ],
        max_tokens=3000,
        temperature=0.5,
    )
    return content


# ============================================================
# MULTI-DAY SOCIAL CALENDAR (OPTIMAL: GEMINI 3.1 PRO)
# ============================================================

def generate_social_calendar(
    campaign_theme: str,
    days: int,
    platforms: list[str],
    tone: str = "Profesional, edukatif, dan menarik untuk UMKM & pebisnis",
    winning_posts_context: str = "",
    source_context: str = "",
    model: str | None = None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="calendar")
    safe_days = max(1, min(7, int(days)))

    system_prompt = f"""
Kamu adalah AI Chief Content Officer di Solusi Macro Virtual HQ.

TUGAS:
Susun Kalender Konten Omnichannel selama {safe_days} hari berturut-turut dengan alur kampanye yang strategis:
- Hari-hari awal: Edukasi masalah (Pain Point UMKM/Bisnis), Mitos vs Fakta.
- Hari pertengahan: Tips praktis Excel/Spreadsheet/Otomasi, Studi Kasus efisiensi.
- Hari akhir: Solusi Dashboard/Automation Solusi Macro & Call to Action (CTA) konsultasi.

Untuk SETIAP HARI, sediakan konten siap tayang untuk platform yang diminta:
- `facebook`: Storytelling bisnis & diskusi.
- `instagram`: Struktur Carousel + Caption + Hashtag.
- `youtube`: Judul + Deskripsi / Naskah Shorts.
- `tiktok`: Naskah Hook 3 detik + Body + CTA + Caption.
- `threads`: Array berisi 3-4 utas berantai yang rapi, tanpa label "[Utas 1]", masing-masing maksimal 420 karakter.

OUTPUT WAJIB:
Kembalikan HANYA JSON valid tanpa markdown code fence.

FORMAT JSON:
{{
  "campaign_name": "Nama kampanye",
  "days": [
    {{
      "day": 1,
      "angle": "Edukasi Masalah / Hook",
      "title": "Judul konten hari ke-1",
      "facebook": "Isi Facebook...",
      "instagram": "Isi Instagram...",
      "youtube": "Isi YouTube...",
      "tiktok": "Isi TikTok...",
      "threads": [
        "Utas 1 (Hook tajam)...",
        "Utas 2 (Penjelasan poin)...",
        "Utas 3 (Solusi & pertanyaan diskusi)..."
      ]
    }}
  ]
}}
"""

    user_payload = {
        "campaign_theme": campaign_theme,
        "days_count": safe_days,
        "target_platforms": platforms,
        "tone": tone,
        "context": source_context,
        "winning_high_engagement_posts_to_emulate": winning_posts_context,
    }

    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(user_payload)},
        ],
        max_tokens=4500,
        temperature=0.45,
    )
    return content


# ============================================================
# AI MAGIC POLISH / REFINE (OPTIMAL: DEEPSEEK V4.1 FLASH)
# ============================================================

def refine_social_platform_content(
    platform: str,
    current_content: str,
    instruction: str,
    model: str | None = None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="refine")

    is_threads = platform.strip().lower() == "threads"
    system_prompt = f"""
Kamu adalah AI Social Media Specialist di Solusi Macro Virtual HQ.
Tugasmu adalah menyempurnakan konten untuk platform: {platform.upper()} sesuai instruksi Founder.

{"ATURAN KHUSUS THREADS: Kembalikan utas berantai yang dipisahkan dengan baris '\\n\\n---\\n\\n' tanpa label '[Utas 1]' atau 'Utas 1:'. Setiap bagian utas maksimal 450 karakter dan rapi." if is_threads else "Kembalikan langsung teks hasil revisi yang siap diposting tanpa komentar pengantar dari AI."}
"""

    user_prompt = f"""
INSTRUKSI REVISI:
{instruction}

KONTEN SAAT INI ({platform.upper()}):
{current_content}
"""

    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2000,
        temperature=0.4,
    )
    return content.strip()


# ============================================================
# WINNING ENGAGEMENT DNA & VIRAL REPLICATION (OPTIMAL: OPUS 5.5)
# ============================================================

def analyze_and_replicate_winning_posts(
    winning_posts: list[dict],
    new_topic: str = "",
    platforms: list[str] | None = None,
    tone: str = "Tajam, relevan, memancing diskusi tinggi & shareable",
    model: str | None = None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="winning_copy")
    target_platforms = platforms or [
        "facebook",
        "instagram",
        "youtube",
        "tiktok",
        "threads",
    ]

    system_prompt = """
Kamu adalah AI Growth & Viral Copywriting Strategist di Solusi Macro Virtual HQ.

TUGAS UTAMA:
1. Pelajari secara mendalam daftar HISTORI POSTINGAN DENGAN ENGAGEMENT TERTINGGI (Winning Posts) milik akun ini.
2. Bedah mengapa postingan-postingan tersebut disukai, dikomentari, dan dibagikan oleh audiens:
   - Apa pola kalimat pembuka (Hook DNA) yang berhasil menghentikan scroll?
   - Bagaimana struktur ritme kalimat, pemilihan kata emosional/angka spesifik, dan format penyampaiannya?
   - Apa pemicu psikologis yang membuat orang terdorong berkomentar atau share?
3. Gunakan FORMULA PEMENANG tersebut untuk membuat paket konten/copywriting BARU di 5 platform (`facebook`, `instagram`, `youtube`, `tiktok`, `threads`) yang punya gaya, ketajaman hook, dan daya tarik serupa agar engagement naik signifikan!
   - Jika Founder memberikan `new_topic`, terapkan formula pemenang tersebut pada `new_topic`.
   - Jika `new_topic` kosong, pilih topik lanjutan paling potensial yang sejalan dengan histori pemenang tersebut.

OUTPUT WAJIB:
Kembalikan HANYA JSON valid tanpa markdown code fence. Buat padat, tajam, dan berdampak tinggi.

FORMAT JSON:
{
  "pattern_analysis": {
    "hook_dna": "Penjelasan pola Hook pemenang dari histori postingan teratas...",
    "copywriting_formula": "Rumus struktur copywriting & ritme kalimat yang terbukti disukai audiens...",
    "engagement_triggers": "Alasan utama audiens banyak like/komen/share dan cara mereplikasinya...",
    "recommended_next_topics": [
      "Ide topik potensial 1...",
      "Ide topik potensial 2...",
      "Ide topik potensial 3..."
    ]
  },
  "title": "Judul konten baru berbasis Winning Formula",
  "facebook": "Isi konten Facebook Page...",
  "instagram": "Isi konten Instagram (Carousel + Caption)...",
  "youtube": "Isi konten YouTube / Shorts...",
  "tiktok": "Isi naskah TikTok (Hook 3 detik + Body + CTA)...",
  "threads": [
    "Utas 1 (Hook tajam berpola sama dengan winning post)...",
    "Utas 2 (Isi poin bernilai tinggi & spesifik)...",
    "Utas 3 (Contoh nyata / studi kasus singkat)...",
    "Utas 4 (Pertanyaan pemicu komentar / diskusi)..."
  ]
}
"""

    user_payload = {
        "top_engagement_history": winning_posts,
        "requested_new_topic": new_topic.strip()
        or "Buat topik baru yang paling berpotensi viral mengikuti pola histori tertinggi di atas",
        "target_platforms": target_platforms,
        "tone": tone,
    }

    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(user_payload)},
        ],
        max_tokens=2800,
        temperature=0.45,
    )
    return content
