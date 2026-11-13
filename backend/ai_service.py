from datetime import datetime
import json
import os
import re
from typing import Any, Optional
import urllib.request

from dotenv import load_dotenv
from openai import OpenAI
from excel_vba_service import (
    EXCEL_VBA_BUILDER_INSTRUCTIONS,
    extract_and_compile_artifacts,
    needs_excel_vba_builder,
)

load_dotenv()

# ============================================================
# DEFAULT PRESET PROVIDERS
# ============================================================
DEFAULT_PRESET_CONFIGS = [
    {
        "provider_id": "custom",
        "name": "Custom OpenAI-Compatible (GarapinAja)",
        "base_url": os.getenv("VHQ_AI_BASE_URL", "https://api.garapinaja.web.id/v1"),
        "api_key": os.getenv("VHQ_AI_API_KEY", "bsk_live_81a5512f2f3e70f94261bf8a0997f35970f0"),
        "default_model": os.getenv("VHQ_AI_MODEL", "DeepSeek V4 Flash Mod"),
        "is_active": 1,
        "custom_models_json": json.dumps([
            {"id": "DeepSeek V4 Flash Mod", "label": "⚡ DeepSeek V4 Flash Mod", "description": "Model cepat untuk coding & otomasi."},
            {"id": "DeepSeek V4.1 Flash", "label": "⚡ DeepSeek V4.1 Flash", "description": "Versi 4.1 untuk task presisi."},
            {"id": "Gemini 3.8 Flash", "label": "🧠 Gemini 3.8 Flash", "description": "Model multimodal vision & reasoning."},
            {"id": "MiMo V2 Flash", "label": "🚀 MiMo V2 Flash", "description": "Model alternatif responsif."},
            {"id": "garapinaja/GLM 5.3 Flash Mod", "label": "💎 GLM 5.3 Flash Mod", "description": "GLM Flash untuk penulisan & analisis."},
        ]),
    },
    {
        "provider_id": "octa",
        "name": "OCTA Gateway Telkomsel",
        "base_url": os.getenv("OCTA_BASE_URL", "https://octa.telkomsel.com/v1"),
        "api_key": os.getenv("OCTA_API_KEY", "sk-VPCQ8E1IEU_IHo0xD40mbw"),
        "default_model": "claude-sonnet-5",
        "is_active": 0,
        "custom_models_json": json.dumps([
            {"id": "claude-opus-5-5", "label": "🏆 Claude Opus 5.5", "description": "Flagship Viral Copy & AI CEO."},
            {"id": "claude-sonnet-5", "label": "🚀 Claude Sonnet 5", "description": "Omnichannel Specialist."},
            {"id": "gemini-3.1-pro-preview", "label": "🧠 Gemini 3.1 Pro", "description": "Task Planner & Dashboard."},
            {"id": "deepseek-v4.1-flash", "label": "⚡ DeepSeek v4.1 Flash", "description": "Excel & Otomasi."},
            {"id": "gpt-5.4-nano", "label": "🪶 GPT-5.4 Nano", "description": "Ultra Cepat & Ringan."},
        ]),
    },
    {
        "provider_id": "gemini",
        "name": "Google Gemini API (Direct)",
        "base_url": os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"),
        "api_key": os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6KZqhAPpN-MNzxKCn2jvPaQ5iC0cZrfrDdNjrJpl6ZlZg"),
        "default_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "is_active": 0,
        "custom_models_json": json.dumps([
            {"id": "gemini-2.5-flash", "label": "⚡ Gemini 2.5 Flash", "description": "Model generasi terbaru super cepat."},
            {"id": "gemini-2.5-pro", "label": "🧠 Gemini 2.5 Pro", "description": "Model flagship untuk logika kompleks."},
            {"id": "gemini-2.0-flash", "label": "🚀 Gemini 2.0 Flash", "description": "Multimodal standar Google."},
        ]),
    },
    {
        "provider_id": "openrouter",
        "name": "OpenRouter.ai",
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": "",
        "default_model": "anthropic/claude-3.5-sonnet",
        "is_active": 0,
        "custom_models_json": json.dumps([
            {"id": "anthropic/claude-3.5-sonnet", "label": "Claude 3.5 Sonnet", "description": "Kualitas tinggi via OpenRouter."},
            {"id": "deepseek/deepseek-chat", "label": "DeepSeek V3", "description": "Sangat hemat & kencang."},
            {"id": "meta-llama/llama-3.3-70b-instruct", "label": "Llama 3.3 70B", "description": "Open weights terkuat."},
        ]),
    },
    {
        "provider_id": "groq",
        "name": "Groq Cloud (Ultra LPU Speed)",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key": "",
        "default_model": "llama-3.3-70b-versatile",
        "is_active": 0,
        "custom_models_json": json.dumps([
            {"id": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B", "description": "Inference instan ratusan token/detik."},
            {"id": "deepseek-r1-distill-llama-70b", "label": "DeepSeek R1 Distill 70B", "description": "Reasoning model di Groq."},
        ]),
    },
]


def init_db_providers(db_session):
    """
    Inisialisasi tabel ai_provider_configs jika masih kosong.
    """
    from models import AIProviderConfig
    existing = db_session.query(AIProviderConfig).first()
    if not existing:
        for p in DEFAULT_PRESET_CONFIGS:
            cfg = AIProviderConfig(
                provider_id=p["provider_id"],
                name=p["name"],
                base_url=p["base_url"],
                api_key=p["api_key"],
                default_model=p["default_model"],
                custom_models_json=p["custom_models_json"],
                is_active=p["is_active"],
                status="Connected" if p["api_key"] else "Not Tested",
            )
            db_session.add(cfg)
        db_session.commit()


def get_active_provider_config(
    db_session=None, provider_id: str | None = None
) -> dict[str, Any]:
    """
    Mengambil konfigurasi provider yang sedang aktif (atau provider spesifik jika provider_id diberikan).
    Prioritas: Database (jika ada) -> Fallback ke file .env.
    """
    if db_session:
        from models import AIProviderConfig
        try:
            target = None
            if provider_id and provider_id.strip():
                target = (
                    db_session.query(AIProviderConfig)
                    .filter(AIProviderConfig.provider_id == provider_id.strip())
                    .first()
                )
            if not target:
                target = (
                    db_session.query(AIProviderConfig)
                    .filter(AIProviderConfig.is_active == 1)
                    .first()
                )
            if target:
                models_list = []
                if target.custom_models_json:
                    try:
                        models_list = json.loads(target.custom_models_json)
                    except Exception:
                        pass
                return {
                    "provider_id": target.provider_id,
                    "name": target.name,
                    "base_url": target.base_url.rstrip("/"),
                    "api_key": target.api_key or "",
                    "default_model": target.default_model,
                    "models": models_list,
                    "status": target.status,
                }
        except Exception:
            pass

    # Fallback ke ENV jika db_session tidak diberikan
    env_provider = os.getenv("VHQ_AI_PROVIDER", "openai-compatible").strip().lower()
    if env_provider == "octa":
        return {
            "provider_id": "octa",
            "name": "OCTA Gateway Telkomsel",
            "base_url": os.getenv("OCTA_BASE_URL", "https://octa.telkomsel.com/v1").rstrip("/"),
            "api_key": os.getenv("OCTA_API_KEY", ""),
            "default_model": os.getenv("OCTA_MODEL", "claude-sonnet-5"),
            "models": [
                {"id": "claude-opus-5-5", "label": "🏆 Claude Opus 5.5"},
                {"id": "claude-sonnet-5", "label": "🚀 Claude Sonnet 5"},
                {"id": "gemini-3.1-pro-preview", "label": "🧠 Gemini 3.1 Pro"},
                {"id": "deepseek-v4.1-flash", "label": "⚡ DeepSeek v4.1 Flash"},
                {"id": "gpt-5.4-nano", "label": "🪶 GPT-5.4 Nano"},
            ],
            "status": "Connected",
        }
    elif env_provider == "gemini":
        return {
            "provider_id": "gemini",
            "name": "Google Gemini API (Direct)",
            "base_url": os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/").rstrip("/"),
            "api_key": os.getenv("GEMINI_API_KEY", ""),
            "default_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            "models": [{"id": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"), "label": "Gemini Direct"}],
            "status": "Connected",
        }
    else:
        return {
            "provider_id": "custom",
            "name": "Custom OpenAI-Compatible",
            "base_url": os.getenv("VHQ_AI_BASE_URL", "https://api.garapinaja.web.id/v1").rstrip("/"),
            "api_key": os.getenv("VHQ_AI_API_KEY", "bsk_live_81a5512f2f3e70f94261bf8a0997f35970f0"),
            "default_model": os.getenv("VHQ_AI_MODEL", "DeepSeek V4 Flash Mod"),
            "models": [{"id": os.getenv("VHQ_AI_MODEL", "DeepSeek V4 Flash Mod"), "label": os.getenv("VHQ_AI_MODEL", "DeepSeek V4 Flash Mod")}],
            "status": "Connected",
        }


def get_available_models_list(db_session=None) -> list[dict[str, str]]:
    """
    Menghasilkan daftar model untuk dropdown UI sesuai provider yang aktif saat ini.
    """
    cfg = get_active_provider_config(db_session)
    models = cfg.get("models") or []
    result = [
        {
            "id": "auto",
            "label": f"⚡ Auto ({cfg.get('name')})",
            "description": f"Otomatis dialihkan ke model default: {cfg.get('default_model')}",
        }
    ]
    for m in models:
        m_id = m.get("id") if isinstance(m, dict) else str(m)
        m_lbl = m.get("label", m_id) if isinstance(m, dict) else str(m)
        m_desc = m.get("description", "") if isinstance(m, dict) else ""
        if m_id != "auto":
            result.append({"id": m_id, "label": m_lbl, "description": m_desc})

    if not any(item["id"] == cfg.get("default_model") for item in result if item["id"] != "auto"):
        result.append({
            "id": cfg.get("default_model"),
            "label": f"🎯 {cfg.get('default_model')}",
            "description": "Model default aktif saat ini.",
        })
    return result


def resolve_ai_model(
    requested_model: str | None = None,
    task_type: str = "general",
    agent_role_or_name: str = "",
    db_session=None,
    provider_id: str | None = None,
) -> str:
    """
    Menentukan model AI terbaik berdasarkan provider aktif (atau provider spesifik) dan peran agent.
    """
    cfg = get_active_provider_config(db_session, provider_id=provider_id)
    default_m = cfg.get("default_model", "DeepSeek V4 Flash Mod")

    if requested_model and requested_model.strip() and requested_model.strip() != "auto":
        return requested_model.strip()

    available_models = [m.get("id") for m in cfg.get("models", []) if isinstance(m, dict)]

    # Jika provider adalah OCTA, petakan task ke model OCTA
    if cfg.get("provider_id") == "octa":
        role_lower = (agent_role_or_name or "").strip().lower()
        if "ai ceo" in role_lower or role_lower == "ceo":
            return "claude-opus-5-5"
        if any(k in role_lower for k in ("excel", "macro", "otomasi", "engineer")):
            return "deepseek-v4.1-flash"
        if any(k in role_lower for k in ("dashboard", "bi", "data")):
            return "gemini-3.1-pro-preview"
        return "claude-sonnet-5"

    # Untuk provider custom / openrouter / groq:
    role_lower = (agent_role_or_name or "").strip().lower()
    if any(k in role_lower for k in ("excel", "macro", "engineer")):
        # Cari model deepseek jika ada di daftar
        for m in available_models:
            if "deepseek" in m.lower():
                return m
    elif any(k in role_lower for k in ("vision", "gambar", "dashboard")):
        for m in available_models:
            if "gemini" in m.lower():
                return m

    return default_m


def get_ai_client(
    db_session=None, provider_id: str | None = None
) -> tuple[OpenAI, str]:
    """
    Membuat client OpenAI SDK terarah ke endpoint & API key provider aktif (atau provider spesifik).
    Mengembalikan tuple (client, default_model).
    """
    cfg = get_active_provider_config(db_session, provider_id=provider_id)
    api_key = cfg.get("api_key") or "dummy-key"
    base_url = cfg.get("base_url")

    if not base_url:
        raise RuntimeError("Base URL Provider AI belum diatur.")

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=90.0,
    )
    return client, cfg.get("default_model")


def _looks_like_reasoning_monologue(text: str) -> bool:
    """Deteksi apakah teks diawali monolog berpikir internal bahasa Inggris."""
    head = (text or "").lstrip()[:400].lower()
    starters = (
        "... wait",
        "wait, no",
        "the user wants",
        "the user is asking",
        "let me ",
        "okay, let",
        "alright, let",
        "hmm,",
        "hmm ",
        "i should ",
        "i need to ",
        "first, let",
        "i'll answer as",
        "i'll build",
        "i'll create",
        "i'll design",
        "i'll provide",
        "the task is",
        "let's design",
        "given the artifact system",
        "keep it reasonably",
    )
    return any(head.startswith(s) for s in starters)


def _strip_reasoning_leak(text: str) -> str:
    """
    Membersihkan kebocoran chain-of-thought (<think>, <thought>, <reasoning>,
    atau monolog reasoning bahasa Inggris) yang kadang dikirim model ke message.content.
    """
    if not text:
        return ""
    cleaned = re.sub(
        r"<ds_safety>[\s\S]*?</ds_safety>",
        "",
        text,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"<ds_safety>[\s\S]*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"<(think|thought|reasoning)>[\s\S]*?</\1>",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    # Jika ada tag pembuka tanpa penutup karena terpotong, buang sampai sebelum jawaban atau seluruhnya
    cleaned = re.sub(r"<(?:think|thought|reasoning)>[\s\S]*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"</?(?:think|thought|reasoning)>", "", cleaned, flags=re.IGNORECASE).strip()

    # Buang baris pembuka "... wait, no. Let me ..."
    leak_match = re.search(
        r"^(?:\.\.\.\s*)?(?:wait,?\s*no\.?\s*)?(?:let me (?:actually |just )?(?:answer|respond|provide|write|give)[^\n]*?[\.:]?)\s*\n+",
        cleaned,
        flags=re.IGNORECASE,
    )
    if leak_match:
        after = cleaned[leak_match.end():].strip()
        if after:
            cleaned = after

    # Jika masih diawali monolog berpikir bahasa Inggris (The user wants / Let me / Hmm),
    # cari awal jawaban Bahasa Indonesia / Heading Markdown yang sebenarnya.
    if _looks_like_reasoning_monologue(cleaned):
        real_start = re.search(
            r"(?m)^(?:#{1,3}\s+(?:Berikut|Rancangan|Solusi|Hasil|Struktur|Langkah|Ringkasan|Implementasi|Aplikasi)\b[^\n]*|(?:Halo|Baik|Tentu|Siap|Berikut|Untuk|Saya|Ini|Langkah|Ringkasan)\b[^\n]*)",
            cleaned,
        )
        if real_start and real_start.start() > 0:
            candidate = cleaned[real_start.start():].strip()
            if len(candidate) >= 40:
                cleaned = candidate

    return cleaned.strip()


def _chat_completion_with_fallback(
    model: str,
    messages: list[dict],
    max_tokens: int = 3000,
    temperature: float = 0.5,
    db_session=None,
    provider_id: str | None = None,
) -> tuple[str, str]:
    """
    Menjalankan eksekusi chat completion ke endpoint aktif atau endpoint khusus agen.
    """
    client, default_m = get_ai_client(db_session, provider_id=provider_id)
    candidate_model = model if (model and model != "auto") else default_m

    cfg = get_active_provider_config(db_session, provider_id=provider_id)
    fallback_chain = [candidate_model]
    if default_m not in fallback_chain:
        fallback_chain.append(default_m)

    for m_entry in cfg.get("models", []):
        mid = m_entry.get("id") if isinstance(m_entry, dict) else str(m_entry)
        if mid and mid not in fallback_chain:
            fallback_chain.append(mid)

    last_error = None
    rejected_response = False
    for target_m in fallback_chain:
        try:
            resp = client.chat.completions.create(
                model=target_m,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            raw_content = (resp.choices[0].message.content or "").strip()
            content = _strip_reasoning_leak(raw_content)
            if not content or _looks_like_reasoning_monologue(content):
                rejected_response = True
                continue
            if content:
                return content, target_m
        except Exception as exc:
            last_error = exc
            continue

    if rejected_response:
        raise RuntimeError(
            f"Model {candidate_model} tidak menghasilkan jawaban final yang layak."
        ) from last_error
    if last_error:
        raise last_error
    raise RuntimeError(f"Gagal mendapatkan output dari model {candidate_model}.")


def test_provider_connection(base_url: str, api_key: str, model: str) -> dict[str, Any]:
    """
    Menguji koneksi ke endpoint provider yang dimasukkan Founder.
    Sekaligus mencoba mendeteksi daftar model yang tersedia via /models.
    """
    clean_base = base_url.strip().rstrip("/")
    detected_models = []

    # 1. Coba fetch daftar model dari endpoint /models
    try:
        req = urllib.request.Request(
            f"{clean_base}/models",
            headers={"Authorization": f"Bearer {api_key.strip()}"} if api_key.strip() else {},
        )
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode())
            if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                for item in data["data"]:
                    m_id = item.get("id")
                    if m_id:
                        detected_models.append({
                            "id": m_id,
                            "label": m_id,
                            "description": f"Owned by: {item.get('owned_by', 'api')}",
                        })
    except Exception:
        pass

    # 2. Coba kirim pesan tes singkat
    test_client = OpenAI(
        api_key=api_key.strip() or "dummy",
        base_url=clean_base,
        timeout=15.0,
    )

    test_model = model.strip() or (detected_models[0]["id"] if detected_models else "gpt-3.5-turbo")

    try:
        t0 = datetime.now()
        resp = test_client.chat.completions.create(
            model=test_model,
            messages=[{"role": "user", "content": "Balas satu kata: ONLINE"}],
            max_tokens=15,
        )
        elapsed_ms = int((datetime.now() - t0).total_seconds() * 1000)
        reply = (resp.choices[0].message.content or "").strip()
        return {
            "success": True,
            "message": f"Koneksi berhasil! Respons dalam {elapsed_ms}ms.",
            "test_model": test_model,
            "sample_reply": reply,
            "detected_models": detected_models,
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Koneksi gagal: {str(exc)}",
            "detected_models": detected_models,
        }


# ============================================================
# AGENT & TASK EXECUTORS
# ============================================================

def ask_claude_with_model(
    message: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    model: str | None = None,
    agent_name: str = "AI CEO",
    image_urls: list[str] | None = None,
    db_session=None,
    provider_id: str | None = None,
) -> tuple[str, str]:
    is_ceo = not agent_name or agent_name.strip().upper() == "AI CEO"
    chosen_model = resolve_ai_model(
        model,
        task_type="ceo_chat" if is_ceo else "agent_chat",
        agent_role_or_name=agent_name,
        db_session=db_session,
        provider_id=provider_id,
    )

    base_sys = system_prompt or (
        "Kamu adalah AI CEO Solusi Macro Virtual HQ. "
        "Bantu Founder mengelola bisnis secara profesional. "
        "Gunakan Bahasa Indonesia yang jelas dan profesional."
    )
    if needs_excel_vba_builder(message) or image_urls:
        base_sys = base_sys + "\n\n" + EXCEL_VBA_BUILDER_INSTRUCTIONS

    base_sys = (
        base_sys
        + "\n\nATURAN OUTPUT WAJIB: JANGAN menuliskan proses berpikir internal, "
        + "catatan keselamatan provider, monolog perencanaan bahasa Inggris "
        + "('Wait...', 'Let me...', 'Hmm...', 'The user wants...'), atau tag <think>. "
        + "Gunakan Bahasa Indonesia untuk seluruh narasi kecuali Founder secara eksplisit meminta "
        + "bahasa lain. Langsung berikan hasil final yang rapi dan lengkap."
    )

    messages: list[dict] = [{"role": "system", "content": base_sys}]

    if history:
        for item in history:
            role = item.get("role") if isinstance(item, dict) else getattr(item, "role", None)
            content = item.get("content") if isinstance(item, dict) else getattr(item, "content", None)
            if role in ("user", "assistant") and content:
                if role == "assistant":
                    content = _strip_reasoning_leak(content)
                    if not content or _looks_like_reasoning_monologue(content):
                        continue
                messages.append({"role": role, "content": content})

    if image_urls:
        multimodal_content: list[dict] = [{"type": "text", "text": message}]
        for url in image_urls[:4]:
            if url:
                multimodal_content.append({"type": "image_url", "image_url": {"url": url}})
        messages.append({"role": "user", "content": multimodal_content})
    else:
        messages.append({"role": "user", "content": message})

    return _chat_completion_with_fallback(
        model=chosen_model,
        messages=messages,
        max_tokens=8192,
        temperature=0.55,
        db_session=db_session,
        provider_id=provider_id,
    )


def ask_claude(
    message: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    model: str | None = None,
    agent_name: str = "AI CEO",
    image_urls: list[str] | None = None,
    db_session=None,
    provider_id: str | None = None,
) -> str:
    response, _ = ask_claude_with_model(
        message=message,
        system_prompt=system_prompt,
        history=history,
        model=model,
        agent_name=agent_name,
        image_urls=image_urls,
        db_session=db_session,
        provider_id=provider_id,
    )
    return response


def execute_agent_task(
    agent,
    project,
    task,
    prior_results=None,
    model: str | None = None,
    extra_context: str = "",
    image_urls: list[str] | None = None,
    db_session=None,
) -> str:
    agent_name = getattr(agent, "name", "AI Agent")
    agent_role = getattr(agent, "role", "Specialist")
    agent_dept = getattr(agent, "department", "General")
    agent_desc = getattr(agent, "description", "")
    agent_provider_id = getattr(agent, "preferred_provider_id", None) or None
    agent_preferred_model = getattr(agent, "preferred_model", None) or None

    effective_model = model if (model and model.strip() and model.strip() != "auto") else agent_preferred_model

    chosen_model = resolve_ai_model(
        effective_model,
        task_type="agent_exec",
        agent_role_or_name=f"{agent_name} {agent_role} {agent_dept}",
        db_session=db_session,
        provider_id=agent_provider_id,
    )

    project_name = getattr(project, "name", "-") if project else "-"
    project_desc = getattr(project, "description", "-") if project else "-"
    task_title = getattr(task, "title", "-")
    task_desc = getattr(task, "description", "-")
    task_prio = getattr(task, "priority", "Normal")

    company_name = "Solusi Macro"
    company_focus = "Excel · Dashboard · Otomasi"
    if db_session is not None:
        try:
            from models import WorkspaceSettings
            ws = db_session.query(WorkspaceSettings).first()
            if ws:
                company_name = (ws.office_name or company_name).strip()
                company_focus = (ws.office_subtitle or company_focus).strip()
        except Exception:
            pass

    system_prompt = f"""
Kamu adalah {agent_name}, AI Specialist di {company_name} Virtual HQ ({company_focus}).
Nama: {agent_name} | Role: {agent_role} | Departemen: {agent_dept}
Deskripsi: {agent_desc}

TUGAS:
1. Kerjakan task ini secara tuntas, profesional, dan konkret.
2. Gunakan Bahasa Indonesia profesional dan format Markdown yang rapi.
3. Berikan output yang siap dievaluasi atau langsung dipakai Founder.
"""
    if needs_excel_vba_builder(f"{task_title} {task_desc} {agent_role}"):
        system_prompt += "\n\n" + EXCEL_VBA_BUILDER_INSTRUCTIONS

    system_prompt += (
        "\n\nATURAN OUTPUT WAJIB: JANGAN menuliskan proses berpikir internal, "
        "monolog bahasa Inggris ('Wait...', 'Let me...', 'Hmm...'), atau tag <think>. "
        "Langsung berikan hasil kerja final dalam Bahasa Indonesia."
    )

    user_prompt = f"""
PROJECT: {project_name}
DESKRIPSI: {project_desc}

TASK: {task_title}
DESKRIPSI TASK: {task_desc}
PRIORITAS: {task_prio}

HASIL TASK SEBELUMNYA:
{prior_results or 'Belum ada'}

{extra_context}

INSTRUKSI:
Kerjakan task di atas sekarang dengan solusi lengkap dan siap pakai.
"""

    if image_urls:
        user_content: list[dict] = [{"type": "text", "text": user_prompt}]
        for url in image_urls[:4]:
            if url:
                user_content.append({"type": "image_url", "image_url": {"url": url}})
        msg_payload = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_content}]
    else:
        msg_payload = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

    result, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=msg_payload,
        max_tokens=8192,
        temperature=0.3,
        db_session=db_session,
        provider_id=agent_provider_id,
    )
    return result


def generate_task_plan(
    project: dict,
    agents: list[dict],
    existing_tasks: list[dict],
    instruction: str,
    model: str | None = None,
    db_session=None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="planner", db_session=db_session)
    planner_prompt = """
Kamu adalah AI CEO dan Project Planner Solusi Macro.
Susun rencana kerja project dalam format JSON valid tanpa Markdown code fence:
{
  "plan_title": "Judul rencana kerja",
  "summary": "Ringkasan",
  "notes": "Catatan",
  "tasks": [
    {
      "title": "Judul task",
      "description": "Deskripsi detail",
      "priority": "High",
      "assigned_agent_id": 1
    }
  ]
}
"""
    payload = {
        "project": project,
        "available_agents": agents,
        "existing_tasks": existing_tasks,
        "instruction": instruction,
    }
    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[{"role": "system", "content": planner_prompt}, {"role": "user", "content": json.dumps(payload, default=str)}],
        max_tokens=3500,
        temperature=0.2,
        db_session=db_session,
    )
    return content


def generate_social_content(
    topic: str,
    platforms: list[str],
    source_context: str = "",
    model: str | None = None,
    db_session=None,
) -> dict:
    chosen_model = resolve_ai_model(model, task_type="social_post", db_session=db_session)
    system_prompt = """
Kamu adalah Head of Social Media Solusi Macro.
Buat draf konten promosi/edukasi untuk platform yang diminta dalam JSON valid:
{
  "title": "Judul konten",
  "content_facebook": "Teks Facebook",
  "content_instagram": "Teks Instagram",
  "content_youtube": "Script YouTube Shorts",
  "content_tiktok": "Script TikTok",
  "content_threads": "Utas Threads"
}
"""
    prompt = f"Topik: {topic}\nPlatforms: {', '.join(platforms)}\nKonteks: {source_context}"
    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
        max_tokens=3000,
        temperature=0.7,
        db_session=db_session,
    )
    try:
        clean_json = content.strip().strip("```json").strip("```").strip()
        return json.loads(clean_json)
    except Exception:
        return {"title": topic, "content_threads": content}


def generate_social_calendar(
    focus_topic: str,
    days: int = 7,
    platforms: list[str] | None = None,
    model: str | None = None,
    db_session=None,
) -> list[dict]:
    chosen_model = resolve_ai_model(model, task_type="calendar", db_session=db_session)
    prompt = f"Buat kalender konten {days} hari tentang {focus_topic} untuk {platforms}. Return JSON list of {{\"day\": 1, \"title\": \"...\", \"topic\": \"...\"}}"
    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=3000,
        temperature=0.5,
        db_session=db_session,
    )
    try:
        clean = content.strip().strip("```json").strip("```").strip()
        res = json.loads(clean)
        return res if isinstance(res, list) else []
    except Exception:
        return []


def refine_social_platform_content(
    platform: str,
    current_content: str,
    instruction: str,
    model: str | None = None,
    db_session=None,
) -> str:
    chosen_model = resolve_ai_model(model, task_type="refine", db_session=db_session)
    prompt = f"Revisi konten {platform} berikut sesuai instruksi:\n\n{current_content}\n\nInstruksi: {instruction}"
    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.6,
        db_session=db_session,
    )
    return content


def analyze_and_replicate_winning_posts(
    winning_posts: list[dict],
    new_topic: str,
    target_platform: str = "threads",
    model: str | None = None,
    db_session=None,
) -> dict:
    chosen_model = resolve_ai_model(model, task_type="winning_copy", db_session=db_session)
    prompt = f"Tiru hook dan pola dari postingan terbaik ini untuk topik baru '{new_topic}'. Return JSON."
    content, _ = _chat_completion_with_fallback(
        model=chosen_model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2500,
        temperature=0.6,
        db_session=db_session,
    )
    try:
        clean = content.strip().strip("```json").strip("```").strip()
        return json.loads(clean)
    except Exception:
        return {"replicated_content": content}
