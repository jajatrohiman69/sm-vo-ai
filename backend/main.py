from datetime import datetime, timedelta
import json
import os
import re
from typing import Any, Literal, Optional
import urllib.error
import urllib.request

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    BackgroundTasks,
    File,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from database import Base, engine, SessionLocal, get_db
from models import (
    Agent,
    Project,
    Task,
    ActivityLog,
    ChatMessage,
    TaskPlan,
    TaskPlanItem,
    TaskAttachment,
    SocialConfig,
    SocialAccount,
    SocialPost,
    SocialPostMetric,
    AIProviderConfig,
    WorkspaceSettings,
)

from ai_service import (
    ask_claude,
    ask_claude_with_model,
    generate_task_plan,
    execute_agent_task,
    generate_social_content,
    generate_social_calendar,
    refine_social_platform_content,
    analyze_and_replicate_winning_posts,
    resolve_ai_model,
    get_active_provider_config,
    get_available_models_list,
    init_db_providers,
    test_provider_connection,
)
from excel_vba_service import (
    STORAGE_DIR,
    extract_and_compile_artifacts,
    get_uploaded_image_data_url,
    load_upload_metadata,
    needs_code_artifacts,
    needs_document_artifacts,
    needs_excel_vba_builder,
    parse_uploaded_file,
    save_upload_metadata,
)
from social_service import (
    verify_facebook,
    verify_instagram,
    verify_threads,
    verify_youtube,
    verify_tiktok,
    publish_to_facebook,
    publish_to_instagram,
    publish_to_threads,
    publish_to_youtube,
    publish_to_tiktok,
    normalize_threads_text,
    split_threads_items,
    calculate_engagement_score,
    fetch_live_platform_metrics,
)
import threading
import time
from auth import (
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    auth_is_configured,
    cookie_secure,
    create_session_token,
    verify_credentials,
    verify_session_token,
)


# ============================================================
# APPLICATION CONFIGURATION
# ============================================================

APP_VERSION = "0.8.1"

app = FastAPI(
    title="Workspace API",
    description="AI-powered workspace management API.",
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_founder_session(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in {
        "/",
        "/health",
        "/auth/login",
    } or (
        request.method == "GET"
        and (
            request.url.path == "/workspace/settings"
            or request.url.path.startswith("/workspace/logo/")
        )
    ):
        return await call_next(request)

    if not auth_is_configured():
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    "Autentikasi belum dikonfigurasi. "
                    "Atur VHQ_FOUNDER_USERNAME, VHQ_FOUNDER_PASSWORD, "
                    "dan VHQ_AUTH_SECRET."
                )
            },
        )

    token = request.cookies.get(SESSION_COOKIE)
    if not verify_session_token(token):
        return JSONResponse(
            status_code=401,
            content={"detail": "Silakan login sebagai Founder."},
        )

    return await call_next(request)


Base.metadata.create_all(bind=engine)


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    status: Literal["Planning", "In Progress", "Completed", "Cancelled"] = "Planning"


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    status: Optional[
        Literal["Planning", "In Progress", "Completed", "Cancelled"]
    ] = None


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    status: Literal["Online", "Standby", "Offline"] = "Standby"
    description: Optional[str] = Field(default=None, max_length=10000)


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    role: Optional[str] = Field(default=None, min_length=1, max_length=120)
    department: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=120,
    )
    status: Optional[Literal["Online", "Standby", "Offline"]] = None
    description: Optional[str] = Field(default=None, max_length=10000)
    preferred_provider_id: Optional[str] = Field(default=None, max_length=120)
    preferred_model: Optional[str] = Field(default=None, max_length=200)


class FounderLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=1024)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    assigned_agent_id: Optional[int] = None
    project_id: Optional[int] = None
    auto_execute: bool = False
    attachment_ids: list[str] = Field(default_factory=list, max_length=5)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Optional[Literal["Low", "Normal", "High", "Urgent"]] = None
    assigned_agent_id: Optional[int] = None
    project_id: Optional[int] = None


class TaskExecuteRequest(BaseModel):
    task_ids: Optional[list[int]] = None


class AIChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    model: Optional[str] = "auto"
    agent_id: Optional[int] = None
    project_id: Optional[int] = None
    attachment_ids: list[str] = Field(default_factory=list, max_length=5)


class TaskPlanGenerateRequest(BaseModel):
    project_id: int
    instruction: Optional[str] = None


class TaskPlanUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    summary: Optional[str] = None
    notes: Optional[str] = None


class TaskPlanItemCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    assigned_agent_id: int


class TaskPlanItemUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Optional[Literal["Low", "Normal", "High", "Urgent"]] = None
    assigned_agent_id: Optional[int] = None


class TaskReviewRequest(BaseModel):
    action: str
    feedback: Optional[str] = None


class TaskRetryRequest(BaseModel):
    task_ids: Optional[list[int]] = None


class AIProviderUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    base_url: str = Field(min_length=1, max_length=500)
    api_key: Optional[str] = Field(default="")
    default_model: str = Field(min_length=1, max_length=120)
    custom_models_json: Optional[str] = None


class AIProviderTestRequest(BaseModel):
    base_url: str = Field(min_length=1, max_length=500)
    api_key: Optional[str] = Field(default="")
    model: Optional[str] = Field(default="")


class AIProviderCreateRequest(BaseModel):
    provider_id: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=120)
    base_url: str = Field(min_length=1, max_length=500)
    api_key: Optional[str] = Field(default="")
    default_model: str = Field(min_length=1, max_length=120)
    custom_models_json: Optional[str] = None


# ============================================================
# SYSTEM PROMPT
# ============================================================

CEO_SYSTEM_PROMPT = """
You are the AI CEO of the configured workspace.

COMPANY PROFILE:
- The workspace provides:
- Excel and spreadsheet solutions
- Business process automation
- Dashboard development
- Reporting automation
- Operational efficiency solutions

TARGET CUSTOMERS:
- UMKM
- Startups
- Small and medium businesses
- Corporate clients

YOUR RESPONSIBILITIES:
1. Think strategically as the company's AI CEO.
2. Analyze projects, tasks, agents, and company operations.
3. Coordinate the specialist AI Agents.
4. Recommend practical and measurable actions.
5. Identify risks, priorities, and dependencies.
6. Report progress clearly to the Founder.

ORGANIZATION:
- Founder: Human decision maker and final approver.
- AI CEO: Strategic coordination and task planning.
- Secretary: Administration and documentation.
- Business Analyst: Business analysis and requirements.
- Excel Engineer: Excel and spreadsheet solutions.
- Automation Engineer: Workflow and process automation.
- Dashboard Analyst: Dashboard and reporting.
- QA & Documentation: Quality assurance and documentation.

IMPORTANT RULES:
- The human Founder has final authority.
- Never claim an action has been completed unless confirmed.
- Distinguish recommendations from actual execution.
- Do not invent database records.
- Do not execute arbitrary SQL or database commands.
- Be transparent about limitations.
- Respond in Indonesian unless requested otherwise.
"""


def build_ceo_system_prompt(db: Session) -> str:
    """Bangun system prompt AI CEO dinamis sesuai pengaturan perusahaan di WorkspaceSettings."""
    ws = _get_or_create_workspace_settings(db)
    company_name = (ws.office_name or "Solusi Macro").strip()
    company_focus = (ws.office_subtitle or "Excel · Dashboard · Otomasi").strip()
    company_badge = (ws.office_badge or "Virtual Office · AI Team").strip()

    agents = db.query(Agent).all()
    org_lines = ["- Founder: Human decision maker and final approver."]
    for ag in agents:
        org_lines.append(f"- {ag.name} ({ag.role} · {ag.department}): {ag.description or '-'}")
    org_block = "\n".join(org_lines)

    return f"""
You are the AI CEO of {company_name}.

COMPANY PROFILE:
- Company / Brand Name: {company_name}
- Focus & Services: {company_focus}
- Workspace Type: {company_badge}

YOUR RESPONSIBILITIES:
1. Think strategically as the AI CEO of {company_name}.
2. Analyze projects, tasks, agents, and company operations.
3. Coordinate the specialist AI Agents in the team.
4. Recommend practical and measurable actions tailored to {company_name} ({company_focus}).
5. Identify risks, priorities, and dependencies.
6. Report progress clearly to the Founder.

ORGANIZATION:
{org_block}

IMPORTANT RULES:
- Always represent yourself as the AI CEO of {company_name} (never use another company name unless asked).
- The human Founder has final authority.
- Never claim an action has been completed unless confirmed.
- Distinguish recommendations from actual execution.
- Do not invent database records.
- Do not execute arbitrary SQL or database commands.
- Be transparent about limitations.
- Respond in Indonesian unless requested otherwise.
"""


# ============================================================
# GENERAL HELPERS
# ============================================================

def create_activity_log(
    db: Session,
    action: str,
    details: Optional[str] = None,
):
    log = ActivityLog(
        action=action,
        details=details,
    )
    db.add(log)
    return log


def serialize_agent(agent: Optional[Agent]):
    if not agent:
        return None

    return {
        "id": agent.id,
        "name": agent.name,
        "role": agent.role,
        "department": agent.department,
        "status": agent.status,
        "description": agent.description,
        "preferred_provider_id": agent.preferred_provider_id,
        "preferred_model": agent.preferred_model,
    }


def serialize_project(project: Optional[Project]):
    if not project:
        return None

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
    }


def serialize_task(task: Task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assigned_agent_id": task.assigned_agent_id,
        "assigned_agent": serialize_agent(task.assigned_agent),
        "project_id": task.project_id,
        "project": serialize_project(task.project),
        "result": getattr(task, "result", None),
        "error_message": getattr(task, "error_message", None),
        "started_at": getattr(task, "started_at", None),
        "completed_at": getattr(task, "completed_at", None),
        "attempt_count": getattr(task, "attempt_count", 0) or 0,
        "created_at": task.created_at,
    }


def serialize_plan(plan: TaskPlan):
    return {
        "id": plan.id,
        "project_id": plan.project_id,
        "project": serialize_project(plan.project),
        "project_name": plan.project.name if plan.project else None,
        "title": plan.title,
        "summary": plan.summary,
        "notes": plan.notes,
        "status": plan.status,
        "created_at": plan.created_at,
        "approved_at": plan.approved_at,
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "priority": item.priority,
                "assigned_agent_id": item.assigned_agent_id,
                "assigned_agent": serialize_agent(item.assigned_agent),
            }
            for item in plan.items
        ],
    }


def parse_plan_json(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw

    if not isinstance(raw, str):
        raise ValueError("AI tidak menghasilkan JSON yang valid.")

    content = raw.strip()

    content = re.sub(
        r"^```(?:json)?\s*",
        "",
        content,
        flags=re.IGNORECASE,
    )

    content = re.sub(r"\s*```$", "", content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")

        if start == -1 or end == -1:
            raise ValueError("Respons AI tidak mengandung JSON.")

        result = json.loads(content[start:end + 1])

    if not isinstance(result, dict):
        raise ValueError("Format Task Plan harus berupa JSON object.")

    return result


def validate_plan_items(data: dict, agents: list[Agent]):
    items = data.get("tasks")

    if not isinstance(items, list):
        items = data.get("items", [])

    if not isinstance(items, list) or not items:
        raise ValueError("Task Plan tidak memiliki daftar task.")

    if len(items) > 15:
        raise ValueError("Maksimal 15 task dalam satu Task Plan.")

    valid_agent_ids = {agent.id for agent in agents}
    validated_items = []

    for item in items:
        if not isinstance(item, dict):
            continue

        title = str(item.get("title", "")).strip()

        if not title:
            continue

        try:
            agent_id = int(item.get("assigned_agent_id"))
        except (TypeError, ValueError):
            raise ValueError(
                f"Agent untuk task '{title}' tidak valid."
            )

        if agent_id not in valid_agent_ids:
            raise ValueError(
                f"Agent ID {agent_id} tidak ditemukan."
            )

        priority = str(item.get("priority", "Normal"))

        if priority not in ["Low", "Normal", "High", "Urgent"]:
            priority = "Normal"

        validated_items.append({
            "title": title,
            "description": item.get("description"),
            "priority": priority,
            "assigned_agent_id": agent_id,
        })

    if not validated_items:
        raise ValueError("Tidak ada task valid yang dapat disimpan.")

    return validated_items


def _compact_ai_history_text(text: Optional[str], max_chars: int = 2500) -> str:
    """Bersihkan metadata artifact internal dan pangkas teks lama agar hemat token."""
    if not text:
        return ""
    cleaned = re.sub(r"<!--\s*VHQ_ARTIFACTS:[\s\S]*?-->", "", text)
    cleaned = re.sub(
        r"\n*---\s*\n###\s*📦\s*(?:Artifact & File Kerja Siap Unduh|File Excel & Modul Macro VBA Siap Unduh)[\s\S]*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    if len(cleaned) > max_chars:
        return cleaned[:max_chars].rstrip() + "\n... [ringkasan dipotong untuk efisiensi token]"
    return cleaned


def build_ai_context(db: Session):
    agents = db.query(Agent).all()
    projects = db.query(Project).all()

    tasks = (
        db.query(Task)
        .order_by(Task.created_at.desc())
        .limit(15)
        .all()
    )

    return {
        "agents": [
            {
                "id": agent.id,
                "name": agent.name,
                "role": agent.role,
                "department": agent.department,
                "status": agent.status,
            }
            for agent in agents
        ],
        "projects": [
            {
                "id": project.id,
                "name": project.name,
                "status": project.status,
                "description": (
                    (project.description[:220] + "...")
                    if project.description and len(project.description) > 220
                    else project.description
                ),
            }
            for project in projects
        ],
        "recent_tasks": [
            {
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
            }
            for task in tasks
        ],
    }


# ============================================================
# AI AGENT EXECUTION WORKER
# ============================================================

SOCIAL_ANALYTICS_KEYWORDS = (
    "engagement", "analytic", "analitik", "insight", "view", "impresi",
    "threads", "instagram", "facebook", "youtube", "tiktok", "sosmed",
    "sosial media", "social media", "postingan", "konten", "like", "komentar",
)


def needs_social_analytics(*texts: Optional[str]) -> bool:
    blob = " ".join(t for t in texts if t).lower()
    return any(k in blob for k in SOCIAL_ANALYTICS_KEYWORDS)


def build_social_analytics_context(db: Session, sync_live: bool = True) -> str:
    """
    Ringkasan data analytics sosmed nyata dari workspace untuk diberikan ke AI Agent:
    sinkronisasi live API (bila terhubung), leaderboard engagement, dan histori posting.
    """
    workspace_name = (
        _get_or_create_workspace_settings(db).office_name or "Workspace"
    ).strip() or "Workspace"
    lines: list[str] = [f"=== DATA ANALYTICS SOSIAL MEDIA {workspace_name.upper()} ==="]
    sync_note = ""

    if sync_live:
        try:
            sync_result = sync_live_engagement_from_apis(db)
            if sync_result.get("synced_count", 0) > 0:
                sync_note = (
                    f"Sinkronisasi live API berhasil: {sync_result['synced_count']} postingan diperbarui."
                )
            if sync_result.get("errors"):
                err_txt = "; ".join(
                    f"{k}: {str(v)[:160]}" for k, v in sync_result["errors"].items()
                )
                sync_note += f" Kendala API: {err_txt}"
        except Exception as exc:
            sync_note = f"Sinkronisasi live gagal: {str(exc)[:200]}"
    if sync_note:
        lines.append(sync_note.strip())

    try:
        metrics = (
            db.query(SocialPostMetric)
            .order_by(SocialPostMetric.engagement_score.desc())
            .limit(25)
            .all()
        )
    except Exception:
        metrics = []

    live = [m for m in metrics if m.external_post_id]
    manual = [m for m in metrics if not m.external_post_id]

    def fmt(m: SocialPostMetric) -> str:
        return (
            f"- [{m.platform.upper()}] \"{(m.title_or_hook or '')[:110]}\" | "
            f"views={m.views or 0}, likes={m.likes or 0}, komentar={m.comments or 0}, "
            f"share/repost={m.shares or 0}, saves={m.saves or 0}, "
            f"skor={m.engagement_score or 0} ({m.engagement_rate or '-'})"
        )

    lines.append(
        f"\n[A] DATA LIVE DARI API PLATFORM (terverifikasi akun asli): {len(live)} postingan"
    )
    if live:
        lines.extend(fmt(m) for m in live)
    else:
        lines.append(
            "(Belum ada data live. Akun belum terhubung / token belum punya izin insights.)"
        )

    lines.append(
        f"\n[B] DATA MANUAL / BENCHMARK DI WORKSPACE (diinput Founder atau contoh bawaan, "
        f"BUKAN otomatis dari akun): {len(manual)} postingan"
    )
    lines.extend(fmt(m) for m in manual[:10])

    try:
        posts = (
            db.query(SocialPost)
            .order_by(SocialPost.created_at.desc())
            .limit(30)
            .all()
        )
    except Exception:
        posts = []
    lines.append(f"\n[C] HISTORI POSTINGAN DI SOCIAL HUB {workspace_name}: {len(posts)} terakhir")
    for p in posts:
        lines.append(
            f"- #{p.id} \"{(p.title or '')[:80]}\" | status={p.status} | "
            f"platform={p.platforms} | jadwal={p.scheduled_at or '-'} | "
            f"tayang={p.published_at or '-'}"
        )

    lines.append(
        "\nATURAN: Gunakan HANYA data di atas. Bedakan jelas data live [A] vs manual/benchmark [B]. "
        "Jika data live kosong, katakan terus terang dan jelaskan langkah menghubungkan "
        "akun (izin threads_manage_insights), tetapi tetap analisis data [B]/[C] yang tersedia."
    )
    return "\n".join(lines)


def execute_approved_plan(task_ids: list[int]):
    """
    Menjalankan task secara berurutan.
    Setiap task menggunakan database session tersendiri.
    """

    prior_results = []

    for task_id in task_ids:
        db = SessionLocal()

        try:
            task = (
                db.query(Task)
                .options(
                    joinedload(Task.assigned_agent),
                    joinedload(Task.project),
                )
                .filter(Task.id == task_id)
                .first()
            )

            if not task or task.status != "Pending":
                continue

            if not task.assigned_agent:
                task.status = "Failed"
                task.error_message = "Task belum memiliki AI Agent."

                create_activity_log(
                    db,
                    "Agent Task Failed",
                    f"Task #{task_id} tidak memiliki AI Agent.",
                )

                db.commit()
                continue

            agent = task.assigned_agent
            agent_name = agent.name
            task_title = task.title

            task.status = "In Progress"
            task.started_at = datetime.now()
            task.completed_at = None
            task.attempt_count = (task.attempt_count or 0) + 1
            task.error_message = None

            db.commit()

            extra_context = (
                build_social_analytics_context(db)
                if needs_social_analytics(
                    task.title, task.description, agent.role, agent.name
                )
                else ""
            )
            image_urls = []
            attachment_context = []
            for attachment in task.attachments:
                upload = load_upload_metadata(attachment.file_id)
                if upload is None:
                    raise RuntimeError(
                        f"Lampiran '{attachment.filename}' tidak ditemukan."
                    )
                attachment_context.append(upload["extracted_text"])
                image_url = get_uploaded_image_data_url(attachment.file_id)
                if image_url:
                    image_urls.append(image_url)

            result = execute_agent_task(
                agent=agent,
                project=task.project,
                task=task,
                prior_results=prior_results,
                extra_context="\n\n".join(
                    part
                    for part in (extra_context, *attachment_context)
                    if part
                ),
                image_urls=image_urls,
                db_session=db,
            )

            task_context_text = f"{task_title} {task.description or ''}"
            workspace_settings = _get_or_create_workspace_settings(db)
            result, _ = extract_and_compile_artifacts(
                result,
                prefix=f"{agent_name}_{task_title[:28]}",
                force_excel_if_table=needs_excel_vba_builder(task_context_text),
                force_documents=needs_document_artifacts(task_context_text),
                document_title=task_title,
                brand_name=workspace_settings.office_name or "Workspace",
                brand_color=workspace_settings.brand_color or "#4f46e5",
            )

            task.result = result
            task.status = "Review"
            task.completed_at = datetime.now()
            task.error_message = None

            create_activity_log(
                db,
                "Agent Task Completed",
                (
                    f"{agent_name} menyelesaikan task "
                    f"'{task_title}'. Menunggu review Founder."
                ),
            )

            db.commit()

            prior_results.append({
                "task_title": task_title,
                "agent_name": agent_name,
                "result": _compact_ai_history_text(result, max_chars=2500),
            })

        except Exception as exc:
            db.rollback()

            try:
                failed_task = (
                    db.query(Task)
                    .filter(Task.id == task_id)
                    .first()
                )

                if failed_task:
                    failed_task.status = "Failed"
                    failed_task.error_message = str(exc)

                    create_activity_log(
                        db,
                        "Agent Task Failed",
                        f"Task #{task_id} gagal: {str(exc)}",
                    )

                    db.commit()

            except Exception:
                db.rollback()

        finally:
            db.close()


# ============================================================
# ROOT & HEALTH
# ============================================================

@app.post("/auth/login")
def login_founder(
    payload: FounderLoginRequest,
    response: Response,
):
    if not auth_is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Autentikasi belum dikonfigurasi. Atur "
                "VHQ_FOUNDER_USERNAME, VHQ_FOUNDER_PASSWORD, dan "
                "VHQ_AUTH_SECRET pada environment backend."
            ),
        )

    if not verify_credentials(payload.username, payload.password):
        raise HTTPException(
            status_code=401,
            detail="Username atau password tidak valid.",
        )

    response.set_cookie(
        key=SESSION_COOKIE,
        value=create_session_token(),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=cookie_secure(),
        samesite="strict",
        path="/",
    )
    return {"success": True, "username": payload.username}


@app.post("/auth/logout")
def logout_founder(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=cookie_secure(),
        samesite="strict",
    )
    return {"success": True}


@app.get("/auth/me")
def get_current_founder():
    return {"authenticated": True}


@app.get("/")
def root(db: Session = Depends(get_db)):
    settings = db.query(WorkspaceSettings).first()
    return {
        "success": True,
        "application": settings.office_name if settings else "Workspace",
        "version": APP_VERSION,
        "status": "online",
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy",
        "timestamp": datetime.now(),
    }


# ============================================================
# AGENTS
# ============================================================

@app.get("/agents")
def get_agents(db: Session = Depends(get_db)):
    agents = (
        db.query(Agent)
        .order_by(Agent.id.asc())
        .all()
    )

    return [serialize_agent(agent) for agent in agents]


@app.post("/agents")
def create_agent(
    payload: AgentCreate,
    db: Session = Depends(get_db),
):
    agent_data = payload.model_dump()
    for field in ("name", "role", "department"):
        agent_data[field] = agent_data[field].strip()
        if not agent_data[field]:
            raise HTTPException(
                status_code=422,
                detail=f"Field {field} tidak boleh kosong.",
            )

    agent = Agent(**agent_data)
    db.add(agent)
    db.flush()
    create_activity_log(
        db,
        "Agent Created",
        f"Agent '{agent.name}' berhasil dibuat.",
    )
    db.commit()
    db.refresh(agent)
    return serialize_agent(agent)


@app.put("/agents/{agent_id}")
def update_agent(
    agent_id: int,
    payload: AgentUpdate,
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="AI Agent tidak ditemukan.")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada data agent yang diperbarui.",
        )

    for field in ("name", "role", "department"):
        if field in changes:
            changes[field] = changes[field].strip()
            if not changes[field]:
                raise HTTPException(
                    status_code=422,
                    detail=f"Field {field} tidak boleh kosong.",
                )

    previous_name = agent.name
    for field, value in changes.items():
        if field in ("preferred_provider_id", "preferred_model") and isinstance(value, str):
            value = value.strip() or None
        setattr(agent, field, value)

    create_activity_log(
        db,
        "Agent Updated",
        f"Agent '{previous_name}' diperbarui menjadi '{agent.name}'.",
    )
    db.commit()
    db.refresh(agent)
    return serialize_agent(agent)


@app.delete("/agents/{agent_id}")
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="AI Agent tidak ditemukan.")

    assigned_tasks = (
        db.query(Task).filter(Task.assigned_agent_id == agent_id).count()
    )
    planned_tasks = (
        db.query(TaskPlanItem)
        .filter(TaskPlanItem.assigned_agent_id == agent_id)
        .count()
    )
    if assigned_tasks or planned_tasks:
        raise HTTPException(
            status_code=409,
            detail=(
                "Agent tidak dapat dihapus karena masih digunakan oleh "
                f"{assigned_tasks} task dan {planned_tasks} item Task Plan."
            ),
        )

    agent_name = agent.name
    db.delete(agent)
    create_activity_log(
        db,
        "Agent Deleted",
        f"Agent '{agent_name}' berhasil dihapus.",
    )
    db.commit()
    return {"success": True, "message": f"Agent '{agent_name}' dihapus."}


@app.get("/ai/task-planner/agents")
def get_task_planner_agents(db: Session = Depends(get_db)):
    agents = (
        db.query(Agent)
        .order_by(Agent.id.asc())
        .all()
    )

    return [
        {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "department": agent.department,
            "status": agent.status,
        }
        for agent in agents
    ]


# ============================================================
# PROJECTS
# ============================================================

@app.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .order_by(Project.created_at.desc())
        .all()
    )

    return [
        {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "created_at": project.created_at,
            "task_count": len(project.tasks),
        }
        for project in projects
    ]


@app.post("/projects")
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
):
    project = Project(
        name=payload.name,
        description=payload.description,
        status=payload.status,
    )

    db.add(project)
    db.flush()

    create_activity_log(
        db,
        "Project Created",
        f"Project '{project.name}' berhasil dibuat.",
    )

    db.commit()
    db.refresh(project)

    return serialize_project(project)


@app.put("/projects/{project_id}")
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada data project yang diperbarui.",
        )

    if "name" in changes:
        changes["name"] = changes["name"].strip()
        if not changes["name"]:
            raise HTTPException(
                status_code=422,
                detail="Nama project tidak boleh kosong.",
            )

    for field, value in changes.items():
        setattr(project, field, value)

    create_activity_log(
        db,
        "Project Updated",
        f"Project '{project.name}' berhasil diperbarui.",
    )
    db.commit()
    db.refresh(project)
    return serialize_project(project)


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project tidak ditemukan.")

    task_count = db.query(Task).filter(Task.project_id == project_id).count()
    plan_count = (
        db.query(TaskPlan).filter(TaskPlan.project_id == project_id).count()
    )
    if task_count or plan_count:
        raise HTTPException(
            status_code=409,
            detail=(
                "Project tidak dapat dihapus karena masih memiliki "
                f"{task_count} task dan {plan_count} Task Plan."
            ),
        )

    project_name = project.name
    db.delete(project)
    create_activity_log(
        db,
        "Project Deleted",
        f"Project '{project_name}' berhasil dihapus.",
    )
    db.commit()
    return {"success": True, "message": f"Project '{project_name}' dihapus."}


# ============================================================
# TASKS
# ============================================================

@app.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.assigned_agent),
            joinedload(Task.project),
        )
        .order_by(Task.created_at.desc())
        .all()
    )

    return [serialize_task(task) for task in tasks]


@app.post("/tasks")
def create_task(
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(
            status_code=422,
            detail="Judul task tidak boleh kosong.",
        )

    attachment_metadata = []
    for file_id in dict.fromkeys(payload.attachment_ids):
        upload = load_upload_metadata(file_id)
        if upload is None:
            raise HTTPException(
                status_code=404,
                detail="Salah satu file lampiran tidak ditemukan. Unggah ulang file tersebut.",
            )
        attachment_metadata.append(upload)

    if payload.assigned_agent_id is not None:
        agent = (
            db.query(Agent)
            .filter(Agent.id == payload.assigned_agent_id)
            .first()
        )

        if not agent:
            raise HTTPException(
                status_code=404,
                detail="AI Agent tidak ditemukan.",
            )

    if payload.project_id is not None:
        project = (
            db.query(Project)
            .filter(Project.id == payload.project_id)
            .first()
        )

        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project tidak ditemukan.",
            )

    task = Task(
        title=title,
        description=payload.description,
        priority=payload.priority,
        assigned_agent_id=payload.assigned_agent_id,
        project_id=payload.project_id,
        status="Pending",
    )

    db.add(task)
    db.flush()

    for upload in attachment_metadata:
        db.add(
            TaskAttachment(
                task_id=task.id,
                file_id=upload["file_id"],
                filename=upload["filename"],
                kind=upload["kind"],
            )
        )

    should_execute = bool(payload.auto_execute and task.assigned_agent_id)

    create_activity_log(
        db,
        "Task Created",
        (
            f"Task '{task.title}' berhasil dibuat"
            + (
                " dan dijadwalkan untuk dieksekusi otomatis."
                if should_execute
                else "."
            )
        ),
    )

    db.commit()
    db.refresh(task)

    if should_execute:
        background_tasks.add_task(
            execute_approved_plan,
            [task.id],
        )

    task = (
        db.query(Task)
        .options(
            joinedload(Task.assigned_agent),
            joinedload(Task.project),
        )
        .filter(Task.id == task.id)
        .first()
    )

    return serialize_task(task)


@app.put("/tasks/{task_id}")
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task tidak ditemukan.",
        )

    if task.status == "In Progress":
        raise HTTPException(
            status_code=409,
            detail="Task yang sedang dikerjakan oleh AI Agent tidak dapat diubah.",
        )

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada data task yang diperbarui.",
        )

    if "title" in changes and changes["title"] is not None:
        changes["title"] = changes["title"].strip()
        if not changes["title"]:
            raise HTTPException(
                status_code=422,
                detail="Judul task tidak boleh kosong.",
            )

    if "assigned_agent_id" in changes and changes["assigned_agent_id"] is not None:
        agent = (
            db.query(Agent)
            .filter(Agent.id == changes["assigned_agent_id"])
            .first()
        )
        if not agent:
            raise HTTPException(
                status_code=404,
                detail="AI Agent tidak ditemukan.",
            )

    if "project_id" in changes and changes["project_id"] is not None:
        project = (
            db.query(Project)
            .filter(Project.id == changes["project_id"])
            .first()
        )
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project tidak ditemukan.",
            )

    for field, value in changes.items():
        setattr(task, field, value)

    create_activity_log(
        db,
        "Task Updated",
        f"Task #{task.id} ('{task.title}') berhasil diperbarui.",
    )
    db.commit()

    updated_task = (
        db.query(Task)
        .options(
            joinedload(Task.assigned_agent),
            joinedload(Task.project),
        )
        .filter(Task.id == task.id)
        .first()
    )
    return serialize_task(updated_task)


@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task tidak ditemukan.",
        )

    if task.status == "In Progress":
        raise HTTPException(
            status_code=409,
            detail="Task yang sedang dikerjakan oleh AI Agent tidak dapat dihapus.",
        )

    task_title = task.title
    db.delete(task)
    create_activity_log(
        db,
        "Task Deleted",
        f"Task #{task_id} ('{task_title}') berhasil dihapus.",
    )
    db.commit()
    return {
        "success": True,
        "message": f"Task '{task_title}' berhasil dihapus.",
    }


# ============================================================
# EXECUTE PENDING TASKS
# ============================================================

@app.post("/tasks/{task_id}/execute")
def execute_single_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .with_for_update()
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task tidak ditemukan.",
        )

    if task.status != "Pending":
        raise HTTPException(
            status_code=400,
            detail=f"Hanya task berstatus Pending yang dapat dieksekusi (status saat ini: {task.status}).",
        )

    if not task.assigned_agent_id:
        raise HTTPException(
            status_code=400,
            detail="Task belum memiliki AI Agent yang ditugaskan.",
        )

    agent = (
        db.query(Agent)
        .filter(Agent.id == task.assigned_agent_id)
        .first()
    )
    if not agent:
        raise HTTPException(
            status_code=400,
            detail="AI Agent yang ditugaskan tidak ditemukan.",
        )

    create_activity_log(
        db,
        "Task Execution Requested",
        f"Founder memulai eksekusi task #{task.id} ('{task.title}') oleh {agent.name}.",
    )
    db.commit()

    background_tasks.add_task(
        execute_approved_plan,
        [task.id],
    )

    return {
        "success": True,
        "message": f"Task '{task.title}' mulai dikerjakan oleh {agent.name}.",
        "task_id": task.id,
        "execution_started": True,
    }


@app.post("/tasks/execute-pending")
def execute_pending_tasks(
    background_tasks: BackgroundTasks,
    payload: Optional[TaskExecuteRequest] = None,
    db: Session = Depends(get_db),
):
    requested_ids = payload.task_ids if payload else None

    query = db.query(Task).filter(Task.status == "Pending")
    if requested_ids:
        query = query.filter(Task.id.in_(requested_ids))

    pending_tasks = query.order_by(Task.id.asc()).all()

    if not pending_tasks:
        raise HTTPException(
            status_code=404,
            detail="Tidak ada task berstatus Pending.",
        )

    valid_task_ids = []
    skipped_tasks = []

    for task in pending_tasks:
        if not task.assigned_agent_id:
            skipped_tasks.append({
                "task_id": task.id,
                "reason": "Belum memiliki AI Agent.",
            })
            continue

        agent_exists = (
            db.query(Agent)
            .filter(Agent.id == task.assigned_agent_id)
            .first()
        )
        if not agent_exists:
            skipped_tasks.append({
                "task_id": task.id,
                "reason": "AI Agent tidak ditemukan.",
            })
            continue

        valid_task_ids.append(task.id)

    if not valid_task_ids:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada task Pending yang sudah ditugaskan ke AI Agent.",
        )

    create_activity_log(
        db,
        "Bulk Task Execution Requested",
        f"Founder menjalankan {len(valid_task_ids)} task Pending: {valid_task_ids}",
    )
    db.commit()

    background_tasks.add_task(
        execute_approved_plan,
        valid_task_ids,
    )

    return {
        "success": True,
        "message": f"{len(valid_task_ids)} task Pending dijadwalkan untuk dieksekusi oleh AI Agents.",
        "executed_count": len(valid_task_ids),
        "task_ids": valid_task_ids,
        "skipped_tasks": skipped_tasks,
        "execution_started": True,
    }


# ============================================================
# RETRY FAILED TASKS
# ============================================================

@app.post("/tasks/{task_id}/retry")
def retry_single_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .with_for_update()
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task tidak ditemukan.",
        )

    if task.status != "Failed":
        raise HTTPException(
            status_code=400,
            detail=f"Task tidak bisa di-retry karena statusnya {task.status}.",
        )

    if not task.assigned_agent_id:
        raise HTTPException(
            status_code=400,
            detail="Task belum memiliki AI Agent.",
        )

    agent_exists = (
        db.query(Agent)
        .filter(Agent.id == task.assigned_agent_id)
        .first()
    )

    if not agent_exists:
        raise HTTPException(
            status_code=400,
            detail="AI Agent yang ditugaskan tidak ditemukan.",
        )

    task.status = "Pending"
    task.result = None
    task.error_message = None
    task.started_at = None
    task.completed_at = None

    create_activity_log(
        db,
        "Task Retry Requested",
        f"Founder meminta retry task #{task.id}: {task.title}",
    )

    db.commit()

    background_tasks.add_task(
        execute_approved_plan,
        [task.id],
    )

    return {
        "success": True,
        "message": "Task berhasil dimasukkan kembali ke antrean eksekusi.",
        "task_id": task.id,
        "status": "Pending",
        "execution_started": True,
    }


@app.post("/tasks/retry-failed")
def retry_failed_tasks(
    background_tasks: BackgroundTasks,
    payload: Optional[TaskRetryRequest] = None,
    db: Session = Depends(get_db),
):
    requested_ids = payload.task_ids if payload else None

    query = db.query(Task).filter(Task.status == "Failed")

    if requested_ids:
        query = query.filter(Task.id.in_(requested_ids))

    failed_tasks = query.order_by(Task.id.asc()).all()

    if not failed_tasks:
        raise HTTPException(
            status_code=404,
            detail="Tidak ada task Failed yang bisa di-retry.",
        )

    valid_tasks = []
    skipped_tasks = []

    for task in failed_tasks:
        if not task.assigned_agent_id:
            skipped_tasks.append({
                "task_id": task.id,
                "reason": "Belum memiliki AI Agent.",
            })
            continue

        agent_exists = (
            db.query(Agent)
            .filter(Agent.id == task.assigned_agent_id)
            .first()
        )

        if not agent_exists:
            skipped_tasks.append({
                "task_id": task.id,
                "reason": "AI Agent tidak ditemukan.",
            })
            continue

        valid_tasks.append(task)

    if not valid_tasks:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Tidak ada task valid yang bisa di-retry.",
                "skipped_tasks": skipped_tasks,
            },
        )

    task_ids = []

    for task in valid_tasks:
        task.status = "Pending"
        task.result = None
        task.error_message = None
        task.started_at = None
        task.completed_at = None

        task_ids.append(task.id)

    create_activity_log(
        db,
        "Bulk Task Retry Requested",
        (
            f"Founder meminta retry untuk "
            f"{len(task_ids)} task: {task_ids}"
        ),
    )

    db.commit()

    background_tasks.add_task(
        execute_approved_plan,
        task_ids,
    )

    return {
        "success": True,
        "message": "Task berhasil dimasukkan kembali ke antrean.",
        "retry_count": len(task_ids),
        "task_ids": task_ids,
        "skipped_tasks": skipped_tasks,
        "execution_started": True,
    }


# ============================================================
# FOUNDER TASK REVIEW
# ============================================================

@app.post("/tasks/{task_id}/review")
def review_task(
    task_id: int,
    payload: TaskReviewRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    task = (
        db.query(Task)
        .filter(Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task tidak ditemukan.",
        )

    if task.status != "Review":
        raise HTTPException(
            status_code=400,
            detail="Task hanya bisa direview ketika statusnya Review.",
        )

    action = payload.action.lower().strip()
    feedback = (payload.feedback or "").strip()

    # --------------------------------------------------------
    # APPROVE RESULT
    # --------------------------------------------------------

    if action == "approve":
        task.status = "Completed"

        approval_note = (
            feedback
            if feedback
            else "(Tidak ada catatan approval dari Founder.)"
        )

        create_activity_log(
            db,
            "Task Approved",
            (
                f"Founder menyetujui hasil task: {task.title}\n\n"
                f"Task ID: {task.id}\n"
                f"Catatan Approval Founder:\n{approval_note}"
            ),
        )

        db.commit()
        db.refresh(task)

        return {
            "success": True,
            "message": "Hasil task berhasil disetujui.",
            "task_id": task.id,
            "status": task.status,
            "founder_note": feedback or None,
        }

    # --------------------------------------------------------
    # REQUEST REVISION
    # --------------------------------------------------------

    if action == "revise":
        if not feedback:
            raise HTTPException(
                status_code=400,
                detail="Feedback revisi wajib diisi.",
            )

        task.description = (
            (task.description or "")
            + "\n\nFOUNDER REVISION FEEDBACK:\n"
            + feedback
        )

        task.status = "Pending"
        task.result = None
        task.error_message = None
        task.started_at = None
        task.completed_at = None

        create_activity_log(
            db,
            "Task Revision Requested",
            (
                f"Founder meminta revisi task: {task.title}\n\n"
                f"Task ID: {task.id}\n"
                f"Catatan Revisi Founder:\n{feedback}"
            ),
        )

        db.commit()

        background_tasks.add_task(
            execute_approved_plan,
            [task.id],
        )

        return {
            "success": True,
            "message": "Feedback revisi berhasil dikirim.",
            "task_id": task.id,
            "status": "Pending",
            "founder_feedback": feedback,
            "execution_started": True,
        }

    raise HTTPException(
        status_code=400,
        detail="Action harus approve atau revise.",
    )


# ============================================================
# ACTIVITY LOGS
# ============================================================

@app.get("/activity-logs")
def get_activity_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 200))

    logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at,
        }
        for log in logs
    ]


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.get("/system/status")
def get_system_status(db: Session = Depends(get_db)):
    total_agents = db.query(Agent).count()
    total_projects = db.query(Project).count()
    total_tasks = db.query(Task).count()

    pending = db.query(Task).filter(
        Task.status == "Pending"
    ).count()

    in_progress = db.query(Task).filter(
        Task.status == "In Progress"
    ).count()

    review = db.query(Task).filter(
        Task.status == "Review"
    ).count()

    completed = db.query(Task).filter(
        Task.status == "Completed"
    ).count()

    failed = db.query(Task).filter(
        Task.status == "Failed"
    ).count()

    return {
        "success": True,
        "agents": {
            "total": total_agents,
        },
        "projects": {
            "total": total_projects,
        },
        "tasks": {
            "total": total_tasks,
            "pending": pending,
            "in_progress": in_progress,
            "review": review,
            "completed": completed,
            "failed": failed,
        },
    }


# ============================================================
# AI CONNECTION STATUS
# ============================================================

@app.get("/ai/status")
def get_ai_status(db: Session = Depends(get_db)):
    init_db_providers(db)
    config = get_active_provider_config(db)
    provider = config.get("name") or config.get("provider_id") or "Unknown"
    model = config.get("default_model") or "Not configured"
    is_configured = bool(config.get("base_url") and config.get("default_model"))

    return {
        "success": is_configured,
        "provider": provider,
        "model": model,
        "base_url": "Configured through Settings" if is_configured else "Unavailable",
        "status": "configured" if is_configured else "missing_configuration",
    }


@app.post("/ai/test")
def test_ai_connection(db: Session = Depends(get_db)):
    try:
        response = ask_claude(
            message="Balas singkat: AI CEO online.",
            system_prompt=build_ceo_system_prompt(db),
            db_session=db,
        )

        return {
            "success": True,
            "message": "AI connection successful.",
            "response": response,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI connection failed: {str(exc)}",
        )


# ============================================================
# AI CEO CHAT
# ============================================================

@app.get("/ai/chat/history")
def get_chat_history(
    session_id: str = "default",
    limit: int = 100,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 200))

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": message.id,
            "session_id": message.session_id,
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at,
        }
        for message in messages
    ]


@app.delete("/ai/chat/history")
def delete_chat_history(
    session_id: str = "default",
    db: Session = Depends(get_db),
):
    db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).delete(synchronize_session=False)

    db.commit()

    return {
        "success": True,
        "message": "Chat history berhasil dihapus.",
    }


@app.get("/ai/models")
def get_available_ai_models(db: Session = Depends(get_db)):
    init_db_providers(db)
    models_list = get_available_models_list(db)
    cfg = get_active_provider_config(db)
    return {
        "default": "auto",
        "active_provider": cfg,
        "models": models_list,
    }


# ============================================================
# AI PROVIDERS MANAGEMENT ENDPOINTS
# ============================================================

@app.get("/ai/providers")
def get_ai_providers(db: Session = Depends(get_db)):
    init_db_providers(db)
    providers = db.query(AIProviderConfig).order_by(AIProviderConfig.id.asc()).all()
    active_cfg = get_active_provider_config(db)
    return {
        "success": True,
        "active_provider_id": active_cfg.get("provider_id"),
        "providers": [
            {
                "id": p.id,
                "provider_id": p.provider_id,
                "name": p.name,
                "base_url": p.base_url,
                "api_key": p.api_key or "",
                "default_model": p.default_model,
                "custom_models_json": p.custom_models_json,
                "is_active": p.is_active == 1,
                "status": p.status,
                "last_tested_at": p.last_tested_at,
                "updated_at": p.updated_at,
            }
            for p in providers
        ],
    }


@app.post("/ai/providers/switch")
def switch_active_provider(
    payload: dict,
    db: Session = Depends(get_db),
):
    init_db_providers(db)
    provider_id = payload.get("provider_id", "").strip().lower()
    target = db.query(AIProviderConfig).filter(AIProviderConfig.provider_id == provider_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Provider tidak ditemukan.")

    db.query(AIProviderConfig).update({AIProviderConfig.is_active: 0})
    target.is_active = 1
    target.status = "Active"
    db.commit()

    create_activity_log(
        db,
        "AI Provider Switched",
        f"Founder mengganti provider AI aktif menjadi '{target.name}' ({target.base_url}).",
    )
    db.commit()

    return {
        "success": True,
        "message": f"Provider AI berhasil diubah ke '{target.name}'.",
        "active_provider": {
            "provider_id": target.provider_id,
            "name": target.name,
            "base_url": target.base_url,
            "default_model": target.default_model,
        },
    }


@app.put("/ai/providers/{provider_id}")
def update_provider_config(
    provider_id: str,
    payload: AIProviderUpdateRequest,
    db: Session = Depends(get_db),
):
    init_db_providers(db)
    target = db.query(AIProviderConfig).filter(AIProviderConfig.provider_id == provider_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Provider tidak ditemukan.")

    target.name = payload.name.strip()
    target.base_url = payload.base_url.strip().rstrip("/")
    if payload.api_key is not None:
        target.api_key = payload.api_key.strip()
    target.default_model = payload.default_model.strip()
    if payload.custom_models_json is not None:
        target.custom_models_json = payload.custom_models_json

    db.commit()
    db.refresh(target)

    create_activity_log(
        db,
        "AI Provider Updated",
        f"Founder memperbarui konfigurasi provider '{target.name}'.",
    )
    db.commit()

    return {
        "success": True,
        "message": f"Konfigurasi '{target.name}' berhasil disimpan.",
        "provider": {
            "provider_id": target.provider_id,
            "name": target.name,
            "base_url": target.base_url,
            "default_model": target.default_model,
        },
    }


@app.post("/ai/providers/test")
def test_provider_endpoint(payload: AIProviderTestRequest):
    result = test_provider_connection(
        base_url=payload.base_url,
        api_key=payload.api_key or "",
        model=payload.model or "",
    )
    return result


@app.post("/ai/providers")
def add_new_provider(
    payload: AIProviderCreateRequest,
    db: Session = Depends(get_db),
):
    init_db_providers(db)
    clean_id = payload.provider_id.strip().lower()
    existing = db.query(AIProviderConfig).filter(AIProviderConfig.provider_id == clean_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Provider ID '{clean_id}' sudah digunakan.")

    new_p = AIProviderConfig(
        provider_id=clean_id,
        name=payload.name.strip(),
        base_url=payload.base_url.strip().rstrip("/"),
        api_key=payload.api_key.strip() if payload.api_key else "",
        default_model=payload.default_model.strip(),
        custom_models_json=payload.custom_models_json,
        is_active=0,
        status="Not Tested",
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)

    create_activity_log(
        db,
        "AI Provider Added",
        f"Founder menambahkan provider AI baru: '{new_p.name}' ({new_p.base_url}).",
    )
    db.commit()

    return {
        "success": True,
        "message": f"Provider '{new_p.name}' berhasil ditambahkan.",
        "provider_id": new_p.provider_id,
    }


@app.delete("/ai/providers/{provider_id}")
def delete_provider(
    provider_id: str,
    db: Session = Depends(get_db),
):
    init_db_providers(db)
    target = db.query(AIProviderConfig).filter(AIProviderConfig.provider_id == provider_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Provider tidak ditemukan.")
    if target.is_active == 1:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus provider yang sedang aktif.")

    name = target.name
    # Reset agen yang sebelumnya diarahkan ke provider yang dihapus
    db.query(Agent).filter(Agent.preferred_provider_id == provider_id).update(
        {"preferred_provider_id": None, "preferred_model": None},
        synchronize_session=False,
    )
    db.delete(target)
    db.commit()

    create_activity_log(
        db,
        "AI Provider Deleted",
        f"Founder menghapus provider AI '{name}'.",
    )
    db.commit()

    return {"success": True, "message": f"Provider '{name}' berhasil dihapus."}


@app.post("/ai/files/upload")
async def upload_ai_file(file: UploadFile = File(...)):
    filename = os.path.basename((file.filename or "").replace("\\", "/"))
    extension = os.path.splitext(filename)[1].lower()
    allowed_extensions = {
        ".xlsx",
        ".xlsm",
        ".csv",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
    }
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=415,
            detail="Format file tidak didukung. Gunakan .xlsx, .xlsm, .csv, PNG, JPG, atau WEBP.",
        )

    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Ukuran setiap file maksimal 10 MB.",
        )
    if not content:
        raise HTTPException(status_code=400, detail="File kosong.")

    trusted_mime_types = {
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
        ".csv": "text/csv",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    if extension in {".png", ".jpg", ".jpeg", ".webp"}:
        valid_image = (
            (extension == ".png" and content.startswith(b"\x89PNG\r\n\x1a\n"))
            or (extension in {".jpg", ".jpeg"} and content.startswith(b"\xff\xd8\xff"))
            or (
                extension == ".webp"
                and len(content) >= 12
                and content[:4] == b"RIFF"
                and content[8:12] == b"WEBP"
            )
        )
        if not valid_image:
            raise HTTPException(
                status_code=415,
                detail="Isi file tidak sesuai dengan format gambar yang dipilih.",
            )
    elif extension in {".xlsx", ".xlsm"} and not content.startswith(b"PK"):
        raise HTTPException(
            status_code=415,
            detail="Isi file tidak dikenali sebagai workbook Excel.",
        )
    elif extension == ".csv":
        try:
            content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=415,
                detail="CSV harus menggunakan encoding UTF-8.",
            ) from exc

    upload = parse_uploaded_file(
        filename,
        content,
        trusted_mime_types[extension],
    )
    save_upload_metadata(upload)
    return {
        key: value
        for key, value in upload.items()
        if key != "image_data_url"
    }


@app.get("/files/download/{stored_name}")
def download_generated_file(stored_name: str):
    if (
        os.path.basename(stored_name) != stored_name
        or not re.fullmatch(r"[A-Za-z0-9._-]+", stored_name)
    ):
        raise HTTPException(status_code=400, detail="Nama file tidak valid.")

    file_path = os.path.join(STORAGE_DIR, stored_name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File hasil tidak ditemukan.")
    return FileResponse(file_path, filename=stored_name)


@app.post("/ai/chat")
def ai_ceo_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
):
    message = payload.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Pesan tidak boleh kosong.",
        )

    attachment_metadata = []
    image_urls = []
    for file_id in dict.fromkeys(payload.attachment_ids):
        upload = load_upload_metadata(file_id)
        if upload is None:
            raise HTTPException(
                status_code=404,
                detail="Salah satu file lampiran tidak ditemukan. Unggah ulang file tersebut.",
            )
        attachment_metadata.append(upload)
        image_url = get_uploaded_image_data_url(file_id)
        if image_url:
            image_urls.append(image_url)

    target_agent: Optional[Agent] = None
    if payload.agent_id is not None:
        target_agent = (
            db.query(Agent).filter(Agent.id == payload.agent_id).first()
        )
        if not target_agent:
            raise HTTPException(
                status_code=404,
                detail="AI Agent tidak ditemukan.",
            )

    target_project: Optional[Project] = None
    if payload.project_id is not None:
        target_project = (
            db.query(Project).filter(Project.id == payload.project_id).first()
        )
        if not target_project:
            raise HTTPException(
                status_code=404,
                detail="Project tidak ditemukan.",
            )

    user_message = ChatMessage(
        session_id=payload.session_id,
        role="user",
        content=message
        + (
            "\n\nLampiran: "
            + ", ".join(upload["filename"] for upload in attachment_metadata)
            if attachment_metadata
            else ""
        ),
    )

    db.add(user_message)
    db.commit()

    history_records = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.session_id == payload.session_id
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(12)
        .all()
    )

    history_records.reverse()

    past_records = history_records[:-1]
    total_past = len(past_records)
    history = [
        {
            "role": item.role,
            "content": (
                _compact_ai_history_text(
                    item.content,
                    max_chars=4000 if idx >= total_past - 4 else 1000,
                )
                if item.role == "assistant"
                else _compact_ai_history_text(item.content, max_chars=4000)
            ),
        }
        for idx, item in enumerate(past_records)
    ]

    context = build_ai_context(db)

    if target_project is not None:
        project_tasks = (
            db.query(Task)
            .options(joinedload(Task.assigned_agent))
            .filter(Task.project_id == target_project.id)
            .order_by(Task.created_at.desc())
            .limit(20)
            .all()
        )
        context["active_project_focus"] = {
            "id": target_project.id,
            "name": target_project.name,
            "status": target_project.status,
            "description": target_project.description,
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "assigned_agent": t.assigned_agent.name
                    if t.assigned_agent
                    else None,
                    "result_preview": (t.result[:400] + "...")
                    if t.result and len(t.result) > 400
                    else t.result,
                }
                for t in project_tasks
            ],
        }

    ws = _get_or_create_workspace_settings(db)
    company_name = (ws.office_name or "Solusi Macro").strip()
    company_focus = (ws.office_subtitle or "Excel · Dashboard · Otomasi").strip()

    if target_agent and target_agent.name.upper() != "AI CEO":
        base_persona_prompt = f"""
Kamu adalah {target_agent.name}, AI Specialist di workspace {company_name}.

IDENTITAS AGENT:
- Nama: {target_agent.name}
- Jabatan / Role: {target_agent.role}
- Departemen: {target_agent.department}
- Deskripsi Tugas: {target_agent.description or "-"}

PROFIL PERUSAHAAN ({company_name}):
- Nama Perusahaan / Brand: {company_name}
- Fokus & Layanan: {company_focus}

ATURAN DISKUSI DENGAN FOUNDER:
1. Jawab langsung sebagai {target_agent.name} ({target_agent.role}) dari {company_name} dengan keahlian teknis/fungsional sesuai departemenmu ({target_agent.department}).
2. Berikan solusi konkret, contoh formula/kode/rancangan/SOP jika relevan.
3. Jangan mengaku telah mengubah database atau mengeksekusi sistem eksternal secara langsung di ruang chat.
4. Gunakan Bahasa Indonesia profesional dan format Markdown yang rapi.
"""
        responder_label = target_agent.name
    else:
        base_persona_prompt = build_ceo_system_prompt(db)
        responder_label = target_agent.name if target_agent else "AI CEO"

    system_prompt = (
        base_persona_prompt
        + "\n\nCURRENT VIRTUAL HQ DATA:\n"
        + json.dumps(context, ensure_ascii=False, default=str)
        + "\n\nUse this data as context. Do not invent records."
        + (
            "\n\n" + build_social_analytics_context(db, sync_live=False)
            if needs_social_analytics(message)
            else ""
        )
    )
    attachment_context = "\n\n".join(
        upload["extracted_text"]
        for upload in attachment_metadata
        if upload.get("kind") != "image"
    )
    message_for_ai = (
        message
        + ("\n\nKONTEKS FILE LAMPIRAN:\n" + attachment_context if attachment_context else "")
    )

    agent_provider_id = (
        getattr(target_agent, "preferred_provider_id", None)
        if target_agent
        else None
    )
    agent_preferred_model = (
        getattr(target_agent, "preferred_model", None)
        if target_agent
        else None
    )
    effective_chat_model = (
        payload.model
        if (payload.model and payload.model.strip() and payload.model.strip() != "auto")
        else agent_preferred_model
    )
    workspace_settings = _get_or_create_workspace_settings(db)

    try:
        response, actual_model = ask_claude_with_model(
            message=message_for_ai,
            system_prompt=system_prompt,
            history=history,
            model=effective_chat_model,
            agent_name=responder_label,
            image_urls=image_urls,
            db_session=db,
            provider_id=agent_provider_id,
        )
        response, generated_artifacts = extract_and_compile_artifacts(
            response,
            prefix=f"{responder_label}_Deliverable",
            force_excel_if_table=needs_excel_vba_builder(message),
            force_documents=needs_document_artifacts(message),
            auto_extract_code=needs_code_artifacts(message) or needs_excel_vba_builder(message),
            document_title=f"Hasil Diskusi {responder_label}",
            brand_name=workspace_settings.office_name or "Workspace",
            brand_color=workspace_settings.brand_color or "#4f46e5",
        )

        assistant_message = ChatMessage(
            session_id=payload.session_id,
            role="assistant",
            content=response,
        )

        db.add(assistant_message)

        create_activity_log(
            db,
            f"{responder_label} Chat",
            f"{responder_label} merespons Founder pada session '{payload.session_id}'.",
        )

        db.commit()
        db.refresh(assistant_message)

        return {
            "success": True,
            "session_id": payload.session_id,
            "agent_name": responder_label,
            "model_used": actual_model,
            "message": response,
            "artifacts": generated_artifacts,
            "created_at": assistant_message.created_at,
        }

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=f"{responder_label} gagal memberikan respons: {str(exc)}",
        )


# ============================================================
# AI CEO TASK PLANNER
# ============================================================

@app.post("/ai/task-planner/generate")
def generate_task_plan_endpoint(
    payload: TaskPlanGenerateRequest,
    db: Session = Depends(get_db),
):
    project = (
        db.query(Project)
        .filter(Project.id == payload.project_id)
        .first()
    )

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project tidak ditemukan.",
        )

    agents = db.query(Agent).all()

    if not agents:
        raise HTTPException(
            status_code=400,
            detail="Belum ada AI Agent yang terdaftar.",
        )

    existing_tasks = (
        db.query(Task)
        .filter(Task.project_id == project.id)
        .all()
    )

    project_data = serialize_project(project)

    agents_data = [
        serialize_agent(agent)
        for agent in agents
    ]

    existing_tasks_data = [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "assigned_agent_id": task.assigned_agent_id,
        }
        for task in existing_tasks
    ]

    try:
        raw_plan = generate_task_plan(
            project=project_data,
            agents=agents_data,
            existing_tasks=existing_tasks_data,
            instruction=payload.instruction or "",
        )

        plan_data = parse_plan_json(raw_plan)

        validated_items = validate_plan_items(
            plan_data,
            agents,
        )

        plan_title = (
            plan_data.get("title")
            or plan_data.get("plan_title")
            or f"Task Plan - {project.name}"
        )

        plan = TaskPlan(
            project_id=project.id,
            title=plan_title,
            summary=plan_data.get("summary", ""),
            notes=plan_data.get("notes", ""),
            status="Pending Approval",
        )

        db.add(plan)
        db.flush()

        for item in validated_items:
            db.add(
                TaskPlanItem(
                    plan_id=plan.id,
                    title=item["title"],
                    description=item["description"],
                    priority=item["priority"],
                    assigned_agent_id=item["assigned_agent_id"],
                )
            )

        create_activity_log(
            db,
            "Task Plan Generated",
            (
                f"AI CEO membuat Task Plan '{plan.title}' "
                f"untuk project '{project.name}'. "
                "Menunggu persetujuan Founder."
            ),
        )

        db.commit()

        saved_plan = (
            db.query(TaskPlan)
            .options(
                joinedload(TaskPlan.project),
                joinedload(TaskPlan.items).joinedload(
                    TaskPlanItem.assigned_agent
                ),
            )
            .filter(TaskPlan.id == plan.id)
            .first()
        )

        return {
            "success": True,
            "message": (
                "Usulan task berhasil dibuat. "
                "Menunggu persetujuan Founder."
            ),
            "plan": serialize_plan(saved_plan),
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=f"Gagal membuat Task Plan: {str(exc)}",
        )


@app.get("/ai/task-planner/plans")
def get_task_plans(db: Session = Depends(get_db)):
    plans = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.project),
            joinedload(TaskPlan.items).joinedload(
                TaskPlanItem.assigned_agent
            ),
        )
        .order_by(TaskPlan.created_at.desc())
        .all()
    )

    return [serialize_plan(plan) for plan in plans]


@app.get("/ai/task-planner/plans/{plan_id}")
def get_task_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    plan = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.project),
            joinedload(TaskPlan.items).joinedload(
                TaskPlanItem.assigned_agent
            ),
        )
        .filter(TaskPlan.id == plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    return serialize_plan(plan)


@app.put("/ai/task-planner/plans/{plan_id}")
def update_task_plan(
    plan_id: int,
    payload: TaskPlanUpdateRequest,
    db: Session = Depends(get_db),
):
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    if plan.status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail="Hanya Task Plan berstatus Pending Approval yang dapat diubah.",
        )

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada perubahan pada Task Plan.",
        )

    if "title" in changes and changes["title"] is not None:
        changes["title"] = changes["title"].strip()
        if not changes["title"]:
            raise HTTPException(
                status_code=422,
                detail="Judul Task Plan tidak boleh kosong.",
            )

    for field, value in changes.items():
        setattr(plan, field, value)

    create_activity_log(
        db,
        "Task Plan Updated",
        f"Founder memperbarui detail Task Plan #{plan.id} ('{plan.title}').",
    )
    db.commit()

    updated_plan = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.project),
            joinedload(TaskPlan.items).joinedload(
                TaskPlanItem.assigned_agent
            ),
        )
        .filter(TaskPlan.id == plan_id)
        .first()
    )
    return serialize_plan(updated_plan)


@app.delete("/ai/task-planner/plans/{plan_id}")
def delete_task_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    plan_title = plan.title
    db.delete(plan)
    create_activity_log(
        db,
        "Task Plan Deleted",
        f"Founder menghapus Task Plan #{plan_id} ('{plan_title}').",
    )
    db.commit()
    return {
        "success": True,
        "message": f"Task Plan '{plan_title}' berhasil dihapus.",
    }


@app.post("/ai/task-planner/plans/{plan_id}/items")
def add_task_plan_item(
    plan_id: int,
    payload: TaskPlanItemCreateRequest,
    db: Session = Depends(get_db),
):
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    if plan.status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail="Item hanya dapat ditambahkan pada Task Plan berstatus Pending Approval.",
        )

    title = payload.title.strip()
    if not title:
        raise HTTPException(
            status_code=422,
            detail="Judul item task tidak boleh kosong.",
        )

    agent = db.query(Agent).filter(Agent.id == payload.assigned_agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=404,
            detail="AI Agent tidak ditemukan.",
        )

    item = TaskPlanItem(
        plan_id=plan.id,
        title=title,
        description=payload.description,
        priority=payload.priority,
        assigned_agent_id=payload.assigned_agent_id,
    )
    db.add(item)
    create_activity_log(
        db,
        "Task Plan Item Added",
        f"Founder menambahkan item '{title}' ke Task Plan #{plan.id}.",
    )
    db.commit()

    updated_plan = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.project),
            joinedload(TaskPlan.items).joinedload(
                TaskPlanItem.assigned_agent
            ),
        )
        .filter(TaskPlan.id == plan_id)
        .first()
    )
    return serialize_plan(updated_plan)


@app.put("/ai/task-planner/plans/{plan_id}/items/{item_id}")
def update_task_plan_item(
    plan_id: int,
    item_id: int,
    payload: TaskPlanItemUpdateRequest,
    db: Session = Depends(get_db),
):
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    if plan.status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail="Item hanya dapat diubah pada Task Plan berstatus Pending Approval.",
        )

    item = (
        db.query(TaskPlanItem)
        .filter(
            TaskPlanItem.id == item_id,
            TaskPlanItem.plan_id == plan_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item Task Plan tidak ditemukan.",
        )

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=400,
            detail="Tidak ada perubahan pada item task.",
        )

    if "title" in changes and changes["title"] is not None:
        changes["title"] = changes["title"].strip()
        if not changes["title"]:
            raise HTTPException(
                status_code=422,
                detail="Judul item task tidak boleh kosong.",
            )

    if "assigned_agent_id" in changes and changes["assigned_agent_id"] is not None:
        agent = (
            db.query(Agent)
            .filter(Agent.id == changes["assigned_agent_id"])
            .first()
        )
        if not agent:
            raise HTTPException(
                status_code=404,
                detail="AI Agent tidak ditemukan.",
            )

    for field, value in changes.items():
        setattr(item, field, value)

    create_activity_log(
        db,
        "Task Plan Item Updated",
        f"Founder mengubah item #{item.id} ('{item.title}') pada Task Plan #{plan.id}.",
    )
    db.commit()

    updated_plan = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.project),
            joinedload(TaskPlan.items).joinedload(
                TaskPlanItem.assigned_agent
            ),
        )
        .filter(TaskPlan.id == plan_id)
        .first()
    )
    return serialize_plan(updated_plan)


@app.delete("/ai/task-planner/plans/{plan_id}/items/{item_id}")
def delete_task_plan_item(
    plan_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    if plan.status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail="Item hanya dapat dihapus pada Task Plan berstatus Pending Approval.",
        )

    item = (
        db.query(TaskPlanItem)
        .filter(
            TaskPlanItem.id == item_id,
            TaskPlanItem.plan_id == plan_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item Task Plan tidak ditemukan.",
        )

    item_title = item.title
    db.delete(item)
    create_activity_log(
        db,
        "Task Plan Item Deleted",
        f"Founder menghapus item '{item_title}' dari Task Plan #{plan.id}.",
    )
    db.commit()

    updated_plan = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.project),
            joinedload(TaskPlan.items).joinedload(
                TaskPlanItem.assigned_agent
            ),
        )
        .filter(TaskPlan.id == plan_id)
        .first()
    )
    return serialize_plan(updated_plan)


# ============================================================
# APPROVE TASK PLAN AND START AGENT EXECUTION
# ============================================================

@app.post("/ai/task-planner/plans/{plan_id}/approve")
def approve_task_plan(
    plan_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    plan = (
        db.query(TaskPlan)
        .options(
            joinedload(TaskPlan.items),
        )
        .filter(TaskPlan.id == plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    if plan.status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail=f"Task Plan sudah berstatus {plan.status}.",
        )

    if not plan.items:
        raise HTTPException(
            status_code=400,
            detail="Task Plan tidak memiliki task.",
        )

    task_ids = []

    for item in plan.items:
        task = Task(
            title=item.title,
            description=item.description,
            priority=item.priority,
            assigned_agent_id=item.assigned_agent_id,
            project_id=plan.project_id,
            status="Pending",
        )

        db.add(task)
        db.flush()

        task_ids.append(task.id)

    plan.status = "Approved"
    plan.approved_at = datetime.now()

    create_activity_log(
        db,
        "Task Plan Approved",
        (
            f"Founder menyetujui Task Plan '{plan.title}'. "
            f"{len(task_ids)} task siap dieksekusi."
        ),
    )

    db.commit()

    background_tasks.add_task(
        execute_approved_plan,
        task_ids,
    )

    return {
        "success": True,
        "message": (
            "Task Plan disetujui. "
            "AI Agents mulai mengerjakan task secara otomatis."
        ),
        "plan_id": plan_id,
        "status": "Approved",
        "execution_started": True,
        "created_tasks": len(task_ids),
        "task_ids": task_ids,
    }


# ============================================================
# REJECT TASK PLAN
# ============================================================

@app.post("/ai/task-planner/plans/{plan_id}/reject")
def reject_task_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    plan = (
        db.query(TaskPlan)
        .filter(TaskPlan.id == plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Task Plan tidak ditemukan.",
        )

    if plan.status != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail=(
                "Hanya Task Plan yang menunggu approval "
                "yang dapat ditolak."
            ),
        )

    plan.status = "Rejected"

    create_activity_log(
        db,
        "Task Plan Rejected",
        f"Founder menolak Task Plan '{plan.title}'.",
    )

    db.commit()

    return {
        "success": True,
        "message": "Task Plan berhasil ditolak.",
        "plan_id": plan.id,
        "status": plan.status,
    }


# ============================================================
# OMNICHANNEL SOCIAL HUB (GOOGLE APPS SCRIPT BRIDGE)
# ============================================================

VALID_SOCIAL_PLATFORMS = {
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
    "threads",
}


class SocialConfigUpdateRequest(BaseModel):
    gas_webapp_url: Optional[str] = None
    gas_secret_key: Optional[str] = None
    default_platforms: Optional[list[str]] = None


class SocialGenerateRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=10000)
    platforms: list[str] = Field(
        default_factory=lambda: [
            "facebook",
            "instagram",
            "youtube",
            "tiktok",
            "threads",
        ]
    )
    tone: Optional[str] = (
        "Profesional, edukatif, dan menarik untuk UMKM & pebisnis"
    )
    source_task_id: Optional[int] = None
    project_id: Optional[int] = None
    source_task_id: Optional[int] = None
    project_id: Optional[int] = None
    scheduled_at: Optional[str] = None
    model: Optional[str] = "auto"
    save_as_draft: bool = True


class SocialPostCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    topic: Optional[str] = None
    platforms: list[str] = Field(
        default_factory=lambda: [
            "facebook",
            "instagram",
            "youtube",
            "tiktok",
            "threads",
        ]
    )
    content_facebook: Optional[str] = None
    content_instagram: Optional[str] = None
    content_youtube: Optional[str] = None
    content_tiktok: Optional[str] = None
    content_threads: Optional[str] = None
    media_url: Optional[str] = None
    scheduled_at: Optional[str] = None
    model: Optional[str] = "auto"
    source_task_id: Optional[int] = None
    project_id: Optional[int] = None


class SocialPostUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    topic: Optional[str] = None
    platforms: Optional[list[str]] = None
    content_facebook: Optional[str] = None
    content_instagram: Optional[str] = None
    content_youtube: Optional[str] = None
    content_tiktok: Optional[str] = None
    content_threads: Optional[str] = None
    media_url: Optional[str] = None
    scheduled_at: Optional[str] = None
    model: Optional[str] = "auto"


class SocialPushRequest(BaseModel):
    platforms: Optional[list[str]] = None
    action: str = "publish_or_queue"


def _get_or_create_social_config(db: Session) -> SocialConfig:
    config = db.query(SocialConfig).order_by(SocialConfig.id.asc()).first()
    if not config:
        config = SocialConfig(
            gas_webapp_url=os.getenv("VHQ_GAS_WEBAPP_URL", "").strip() or None,
            gas_secret_key=os.getenv("VHQ_GAS_SECRET", "").strip() or None,
            default_platforms="facebook,instagram,youtube,tiktok,threads",
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _normalize_platforms(platforms: list[str] | str | None) -> list[str]:
    if isinstance(platforms, str):
        raw = [p.strip().lower() for p in platforms.split(",") if p.strip()]
    elif isinstance(platforms, list):
        raw = [str(p).strip().lower() for p in platforms if str(p).strip()]
    else:
        raw = []
    filtered = [p for p in raw if p in VALID_SOCIAL_PLATFORMS]
    return filtered or ["facebook", "instagram", "youtube", "tiktok", "threads"]


def _serialize_social_post(post: SocialPost) -> dict:
    platforms = _normalize_platforms(post.platforms)
    return {
        "id": post.id,
        "title": post.title,
        "topic": post.topic,
        "platforms": platforms,
        "content": {
            "facebook": post.content_facebook or "",
            "instagram": post.content_instagram or "",
            "youtube": post.content_youtube or "",
            "tiktok": post.content_tiktok or "",
            "threads": normalize_threads_text(post.content_threads or ""),
        },
        "threads_items": split_threads_items(post.content_threads or ""),
        "media_url": post.media_url,
        "scheduled_at": post.scheduled_at,
        "status": post.status,
        "gas_response": post.gas_response,
        "source_task_id": post.source_task_id,
        "project_id": post.project_id,
        "created_at": post.created_at,
        "published_at": post.published_at,
    }


def _send_to_gas_webhook(
    webapp_url: str,
    payload: dict,
) -> tuple[int, str]:
    body_bytes = json.dumps(payload, ensure_ascii=False, default=str).encode(
        "utf-8"
    )
    req = urllib.request.Request(
        webapp_url,
        data=body_bytes,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "WorkspaceAPI/0.8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as http_err:
        # Google Apps Script often returns 302 Redirect after doPost execution
        if http_err.code in (301, 302, 303, 307, 308):
            redirect_url = http_err.headers.get("Location")
            if redirect_url:
                with urllib.request.urlopen(redirect_url, timeout=25) as r2:
                    return (
                        r2.status,
                        r2.read().decode("utf-8", errors="replace"),
                    )
        err_body = (
            http_err.read().decode("utf-8", errors="replace")
            if http_err.fp
            else str(http_err)
        )
        raise RuntimeError(
            f"GAS HTTP {http_err.code}: {err_body[:500]}"
        ) from http_err


@app.get("/social/config")
def get_social_config(db: Session = Depends(get_db)):
    config = _get_or_create_social_config(db)
    return {
        "gas_webapp_url": config.gas_webapp_url or "",
        "has_secret_key": bool(config.gas_secret_key),
        "gas_secret_key": config.gas_secret_key or "",
        "default_platforms": _normalize_platforms(config.default_platforms),
        "configured": bool(config.gas_webapp_url),
        "updated_at": config.updated_at,
    }


@app.put("/social/config")
def update_social_config(
    payload: SocialConfigUpdateRequest,
    db: Session = Depends(get_db),
):
    config = _get_or_create_social_config(db)

    if payload.gas_webapp_url is not None:
        url = payload.gas_webapp_url.strip()
        if url and not (
            url.startswith("https://") or url.startswith("http://")
        ):
            raise HTTPException(
                status_code=422,
                detail="URL Google Apps Script harus diawali dengan https:// atau http://",
            )
        config.gas_webapp_url = url or None

    if payload.gas_secret_key is not None:
        config.gas_secret_key = payload.gas_secret_key.strip() or None

    if payload.default_platforms is not None:
        normalized = _normalize_platforms(payload.default_platforms)
        config.default_platforms = ",".join(normalized)

    create_activity_log(
        db,
        "Social Hub Configured",
        "Founder memperbarui konfigurasi Google Apps Script Social Hub.",
    )
    db.commit()
    db.refresh(config)

    return {
        "success": True,
        "message": "Konfigurasi Google Apps Script berhasil disimpan.",
        "gas_webapp_url": config.gas_webapp_url or "",
        "has_secret_key": bool(config.gas_secret_key),
        "default_platforms": _normalize_platforms(config.default_platforms),
        "configured": bool(config.gas_webapp_url),
    }


@app.post("/social/test-connection")
def test_social_gas_connection(db: Session = Depends(get_db)):
    config = _get_or_create_social_config(db)
    if not config.gas_webapp_url:
        raise HTTPException(
            status_code=400,
            detail="URL Web App Google Apps Script belum diatur.",
        )

    test_payload = {
        "action": "ping",
        "source": _get_or_create_workspace_settings(db).office_name or "Workspace",
        "secret": config.gas_secret_key or "",
        "timestamp": datetime.now().isoformat(),
    }

    try:
        status_code, response_text = _send_to_gas_webhook(
            config.gas_webapp_url,
            test_payload,
        )
        return {
            "success": True,
            "status_code": status_code,
            "message": "Berhasil terhubung ke endpoint Google Apps Script.",
            "gas_response": response_text[:1000],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal menghubungi Google Apps Script: {str(exc)}",
        )


@app.post("/social/generate")
def generate_social_post_endpoint(
    payload: SocialGenerateRequest,
    db: Session = Depends(get_db),
):
    platforms = _normalize_platforms(payload.platforms)
    source_context = ""

    if payload.source_task_id:
        task = (
            db.query(Task)
            .filter(Task.id == payload.source_task_id)
            .first()
        )
        if task:
            source_context += (
                f"Task #{task.id}: {task.title}\n"
                f"Deskripsi: {task.description or '-'}\n"
                f"Hasil Kerja Agent:\n{task.result or '-'}\n\n"
            )

    if payload.project_id:
        project = (
            db.query(Project)
            .filter(Project.id == payload.project_id)
            .first()
        )
        if project:
            source_context += (
                f"Project: {project.name}\n"
                f"Deskripsi Project: {project.description or '-'}\n"
            )

    try:
        raw_output = generate_social_content(
            model=payload.model,
            topic=payload.topic.strip(),
            platforms=platforms,
            source_context=source_context,
            winning_posts_context=_get_winning_posts_context(db),
            tone=payload.tone
            or "Profesional, edukatif, dan menarik untuk UMKM & pebisnis",
        )
        parsed = parse_plan_json(raw_output)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI gagal membuat draf konten sosial media: {str(exc)}",
        )

    generated = {
        "title": str(
            parsed.get("title") or payload.topic.strip()[:80]
        ).strip(),
        "facebook": str(parsed.get("facebook", "")).strip(),
        "instagram": str(parsed.get("instagram", "")).strip(),
        "youtube": str(parsed.get("youtube", "")).strip(),
        "tiktok": str(parsed.get("tiktok", "")).strip(),
        "threads": normalize_threads_text(parsed.get("threads", "")),
        "scheduled_at": (
            payload.scheduled_at
            or (
                str(parsed.get("scheduled_at")).strip()
                if parsed.get("scheduled_at")
                and str(parsed.get("scheduled_at")).lower() != "null"
                else None
            )
        ),
    }

    saved_post = None
    if payload.save_as_draft:
        post = SocialPost(
            title=generated["title"],
            topic=payload.topic.strip(),
            platforms=",".join(platforms),
            content_facebook=generated["facebook"],
            content_instagram=generated["instagram"],
            content_youtube=generated["youtube"],
            content_tiktok=generated["tiktok"],
            content_threads=generated["threads"],
            status="Draft",
            scheduled_at=generated.get("scheduled_at"),
            source_task_id=payload.source_task_id,
            project_id=payload.project_id,
        )
        db.add(post)
        create_activity_log(
            db,
            "Social Content Generated",
            f"AI membuat draf konten Omnichannel '{post.title}' untuk {len(platforms)} platform.",
        )
        db.commit()
        db.refresh(post)
        if generated.get("scheduled_at"):
            post.status = "Scheduled"
            db.commit()
            db.refresh(post)
        saved_post = _serialize_social_post(post)

    return {
        "success": True,
        "generated": generated,
        "model_used": resolve_ai_model(payload.model, task_type="social_post"),
        "post": saved_post,
    }


@app.get("/social/posts")
def get_social_posts(db: Session = Depends(get_db)):
    posts = (
        db.query(SocialPost)
        .order_by(SocialPost.created_at.desc())
        .limit(100)
        .all()
    )
    return [_serialize_social_post(post) for post in posts]


@app.post("/social/posts")
def create_social_post(
    payload: SocialPostCreateRequest,
    db: Session = Depends(get_db),
):
    platforms = _normalize_platforms(payload.platforms)
    post = SocialPost(
        title=payload.title.strip(),
        topic=payload.topic,
        platforms=",".join(platforms),
        content_facebook=payload.content_facebook,
        content_instagram=payload.content_instagram,
        content_youtube=payload.content_youtube,
        content_tiktok=payload.content_tiktok,
        content_threads=payload.content_threads,
        media_url=payload.media_url,
        scheduled_at=payload.scheduled_at,
        status="Draft",
        source_task_id=payload.source_task_id,
        project_id=payload.project_id,
    )
    db.add(post)
    create_activity_log(
        db,
        "Social Draft Saved",
        f"Founder menyimpan draf konten sosial media '{post.title}'.",
    )
    db.commit()
    db.refresh(post)
    return _serialize_social_post(post)


@app.put("/social/posts/{post_id}")
def update_social_post(
    post_id: int,
    payload: SocialPostUpdateRequest,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    changes = payload.model_dump(exclude_unset=True)
    if "platforms" in changes and changes["platforms"] is not None:
        changes["platforms"] = ",".join(
            _normalize_platforms(changes["platforms"])
        )

    for field, value in changes.items():
        setattr(post, field, value)

    db.commit()
    db.refresh(post)
    return _serialize_social_post(post)


@app.delete("/social/posts/{post_id}")
def delete_social_post(
    post_id: int,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    title = post.title
    db.delete(post)
    create_activity_log(
        db,
        "Social Post Deleted",
        f"Founder menghapus konten sosial media '{title}'.",
    )
    db.commit()
    return {"success": True, "message": f"Konten '{title}' dihapus."}


@app.post("/social/posts/{post_id}/push")
def push_social_post_to_gas(
    post_id: int,
    payload: Optional[SocialPushRequest] = None,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    config = _get_or_create_social_config(db)
    if not config.gas_webapp_url:
        raise HTTPException(
            status_code=400,
            detail=(
                "URL Web App Google Apps Script belum dikonfigurasi. "
                "Silakan masukkan URL doPost(e) Anda di panel Konfigurasi GAS."
            ),
        )

    selected_platforms = (
        _normalize_platforms(payload.platforms)
        if payload and payload.platforms
        else _normalize_platforms(post.platforms)
    )

    gas_payload = {
        "action": payload.action if payload else "publish_or_queue",
        "source": _get_or_create_workspace_settings(db).office_name or "Workspace",
        "secret": config.gas_secret_key or "",
        "post_id": post.id,
        "title": post.title,
        "topic": post.topic or "",
        "platforms": selected_platforms,
        "media_url": post.media_url or "",
        "scheduled_at": post.scheduled_at or "",
        "content": {
            "facebook": post.content_facebook or "",
            "instagram": post.content_instagram or "",
            "youtube": post.content_youtube or "",
            "tiktok": post.content_tiktok or "",
            "threads": normalize_threads_text(post.content_threads or ""),
        },
        # Flat fields for compatibility with typical GAS e.parameter / JSON parsers
        "facebook_content": post.content_facebook or "",
        "instagram_content": post.content_instagram or "",
        "youtube_content": post.content_youtube or "",
        "tiktok_content": post.content_tiktok or "",
        "threads_content": post.content_threads or "",
        "timestamp": datetime.now().isoformat(),
    }

    try:
        status_code, response_text = _send_to_gas_webhook(
            config.gas_webapp_url,
            gas_payload,
        )
        post.status = "Sent to GAS"
        post.published_at = datetime.now()
        post.gas_response = response_text[:2000]

        create_activity_log(
            db,
            "Social Post Pushed to GAS",
            (
                f"Konten '{post.title}' berhasil dikirim ke Google Apps Script "
                f"untuk platform: {', '.join(selected_platforms)} (HTTP {status_code})."
            ),
        )
        db.commit()
        db.refresh(post)

        return {
            "success": True,
            "message": (
                f"Berhasil dikirim ke Google Apps Script untuk "
                f"{', '.join(p.upper() for p in selected_platforms)}."
            ),
            "post": _serialize_social_post(post),
            "gas_response": response_text[:1000],
        }
    except Exception as exc:
        post.status = "Failed"
        post.gas_response = str(exc)
        create_activity_log(
            db,
            "Social Post Push Failed",
            f"Gagal mengirim '{post.title}' ke Google Apps Script: {str(exc)}",
        )
        db.commit()
        raise HTTPException(
            status_code=502,
            detail=f"Gagal mengirim ke Google Apps Script: {str(exc)}",
        )


# ============================================================
# ============================================================
# DIRECT NATIVE SOCIAL MEDIA ACCOUNTS & PUBLISHING
# ============================================================

PLATFORM_LABELS = {
    "facebook": "Facebook Page",
    "instagram": "Instagram Business",
    "youtube": "YouTube Channel",
    "tiktok": "TikTok",
    "threads": "Threads",
}


class SocialAccountUpdateRequest(BaseModel):
    enabled: Optional[bool] = True
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    credentials: dict[str, str] = Field(default_factory=dict)


class SocialPublishRequest(BaseModel):
    platforms: Optional[list[str]] = None


def _get_or_create_social_accounts(db: Session) -> dict[str, SocialAccount]:
    existing = db.query(SocialAccount).all()
    by_platform = {acc.platform: acc for acc in existing}
    created = False

    for p in ["facebook", "instagram", "youtube", "tiktok", "threads"]:
        if p not in by_platform:
            acc = SocialAccount(
                platform=p,
                enabled=1,
                status="Not Connected",
                credentials_json="{}",
            )
            db.add(acc)
            by_platform[p] = acc
            created = True

    if created:
        db.commit()
        for acc in by_platform.values():
            db.refresh(acc)

    return by_platform


def _parse_account_creds(acc: SocialAccount) -> dict[str, str]:
    if not acc.credentials_json:
        return {}
    try:
        parsed = json.loads(acc.credentials_json)
        if isinstance(parsed, dict):
            return {str(k): str(v) for k, v in parsed.items() if v is not None}
    except Exception:
        pass
    return {}


def _serialize_social_account(acc: SocialAccount) -> dict[str, Any]:
    creds = _parse_account_creds(acc)
    has_creds = any(bool(v.strip()) for v in creds.values())
    return {
        "id": acc.id,
        "platform": acc.platform,
        "label": PLATFORM_LABELS.get(acc.platform, acc.platform.title()),
        "enabled": bool(acc.enabled),
        "account_name": acc.account_name or "",
        "account_id": acc.account_id or "",
        "status": acc.status or ("Configured" if has_creds else "Not Connected"),
        "has_credentials": has_creds,
        "credentials": creds,
        "last_verified_at": acc.last_verified_at,
        "updated_at": acc.updated_at,
    }


@app.get("/social/accounts")
def get_social_accounts(db: Session = Depends(get_db)):
    accounts_map = _get_or_create_social_accounts(db)
    ordered = ["facebook", "instagram", "youtube", "tiktok", "threads"]
    return [_serialize_social_account(accounts_map[p]) for p in ordered]


@app.put("/social/accounts/{platform}")
def update_social_account(
    platform: str,
    payload: SocialAccountUpdateRequest,
    db: Session = Depends(get_db),
):
    p = platform.strip().lower()
    if p not in VALID_SOCIAL_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Platform '{platform}' tidak didukung.",
        )

    accounts_map = _get_or_create_social_accounts(db)
    acc = accounts_map[p]

    current_creds = _parse_account_creds(acc)
    for k, v in payload.credentials.items():
        current_creds[k] = str(v).strip()

    acc.credentials_json = json.dumps(current_creds, ensure_ascii=False)
    if payload.enabled is not None:
        acc.enabled = 1 if payload.enabled else 0
    if payload.account_name is not None:
        acc.account_name = payload.account_name.strip() or acc.account_name
    if payload.account_id is not None:
        acc.account_id = payload.account_id.strip() or acc.account_id

    has_any = any(bool(v.strip()) for v in current_creds.values())
    if not has_any:
        acc.status = "Not Connected"
        acc.account_name = None
        acc.account_id = None
    elif acc.status == "Not Connected":
        acc.status = "Configured"

    create_activity_log(
        db,
        "Social Account Updated",
        f"Founder memperbarui kredensial koneksi {PLATFORM_LABELS.get(p, p)}.",
    )
    db.commit()
    db.refresh(acc)
    return {
        "success": True,
        "message": f"Konfigurasi {PLATFORM_LABELS.get(p, p)} berhasil disimpan.",
        "account": _serialize_social_account(acc),
    }


@app.post("/social/accounts/{platform}/verify")
def verify_social_account_endpoint(
    platform: str,
    db: Session = Depends(get_db),
):
    p = platform.strip().lower()
    if p not in VALID_SOCIAL_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Platform '{platform}' tidak didukung.",
        )

    accounts_map = _get_or_create_social_accounts(db)
    acc = accounts_map[p]
    creds = _parse_account_creds(acc)

    verifiers = {
        "facebook": verify_facebook,
        "instagram": verify_instagram,
        "threads": verify_threads,
        "youtube": verify_youtube,
        "tiktok": verify_tiktok,
    }

    try:
        info = verifiers[p](creds)
        acc.status = "Connected"
        acc.account_name = info.get("account_name") or acc.account_name
        acc.account_id = info.get("account_id") or acc.account_id
        acc.last_verified_at = datetime.now()
        create_activity_log(
            db,
            "Social Account Verified",
            f"Koneksi {PLATFORM_LABELS.get(p, p)} terverifikasi sebagai '{acc.account_name}'.",
        )
        db.commit()
        db.refresh(acc)
        return {
            "success": True,
            "message": f"Berhasil terhubung ke {PLATFORM_LABELS.get(p, p)}: {acc.account_name}",
            "account": _serialize_social_account(acc),
        }
    except Exception as exc:
        acc.status = "Error"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Verifikasi {PLATFORM_LABELS.get(p, p)} gagal: {str(exc)}",
        )


@app.post("/social/posts/{post_id}/publish")
def publish_social_post_direct(
    post_id: int,
    payload: Optional[SocialPublishRequest] = None,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    selected_platforms = (
        _normalize_platforms(payload.platforms)
        if payload and payload.platforms
        else _normalize_platforms(post.platforms)
    )

    accounts_map = _get_or_create_social_accounts(db)
    results: dict[str, Any] = {}
    succeeded: list[str] = []
    failed: list[str] = []

    content_by_platform = {
        "facebook": (post.content_facebook or "").strip(),
        "instagram": (post.content_instagram or "").strip(),
        "youtube": (post.content_youtube or "").strip(),
        "tiktok": (post.content_tiktok or "").strip(),
        "threads": (post.content_threads or "").strip(),
    }

    for p in selected_platforms:
        acc = accounts_map.get(p)
        creds = _parse_account_creds(acc) if acc else {}
        text_content = content_by_platform.get(p, "")

        if not text_content:
            results[p] = {
                "success": False,
                "error": f"Konten {PLATFORM_LABELS.get(p, p)} masih kosong.",
            }
            failed.append(p)
            continue

        try:
            if p == "facebook":
                res = publish_to_facebook(creds, text_content, post.media_url)
            elif p == "instagram":
                res = publish_to_instagram(creds, text_content, post.media_url)
            elif p == "threads":
                res = publish_to_threads(creds, text_content, post.media_url)
            elif p == "youtube":
                res = publish_to_youtube(
                    creds, post.title, text_content, post.media_url
                )
            elif p == "tiktok":
                res = publish_to_tiktok(creds, text_content, post.media_url)
            else:
                raise ValueError(f"Platform {p} belum didukung.")

            results[p] = {
                "success": True,
                "post_id": res.get("post_id"),
                "details": res,
            }
            succeeded.append(p)
        except Exception as exc:
            results[p] = {
                "success": False,
                "error": str(exc),
            }
            failed.append(p)

    if succeeded and not failed:
        post.status = "Published"
    elif succeeded and failed:
        post.status = "Partial"
    else:
        post.status = "Failed"

    if succeeded:
        post.published_at = datetime.now()

    post.gas_response = json.dumps(results, ensure_ascii=False)

    create_activity_log(
        db,
        "Social Post Published",
        (
            f"Publish langsung '{post.title}': "
            f"Berhasil ({', '.join(succeeded) or '-'}), "
            f"Gagal ({', '.join(failed) or '-'})."
        ),
    )
    db.commit()
    db.refresh(post)

    return {
        "success": len(succeeded) > 0,
        "message": (
            f"Berhasil dipublish ke {', '.join(PLATFORM_LABELS.get(p, p) for p in succeeded)}."
            if succeeded and not failed
            else (
                f"Berhasil di {', '.join(PLATFORM_LABELS.get(p, p) for p in succeeded)}; "
                f"gagal di {', '.join(PLATFORM_LABELS.get(p, p) for p in failed)}."
                if succeeded
                else "Gagal mempublish ke platform yang dipilih. Periksa konfigurasi kredensial & Media URL."
            )
        ),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
        "post": _serialize_social_post(post),
    }


class SocialScheduleRequest(BaseModel):
    scheduled_at: str = Field(min_length=10, max_length=64)
    platforms: Optional[list[str]] = None


@app.post("/social/posts/{post_id}/schedule")
def schedule_social_post_endpoint(
    post_id: int,
    payload: SocialScheduleRequest,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    sched_str = payload.scheduled_at.strip()
    try:
        # Validate ISO datetime e.g. 2026-11-12T09:00
        datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Format waktu jadwal tidak valid (gunakan YYYY-MM-DDTHH:MM).",
        )

    if payload.platforms:
        post.platforms = ",".join(_normalize_platforms(payload.platforms))

    post.scheduled_at = sched_str
    post.status = "Scheduled"

    create_activity_log(
        db,
        "Social Post Scheduled",
        f"Konten '{post.title}' dijadwalkan tayang otomatis pada {sched_str}.",
    )
    db.commit()
    db.refresh(post)
    return {
        "success": True,
        "message": f"Konten berhasil dijadwalkan untuk tayang otomatis pada {sched_str}.",
        "post": _serialize_social_post(post),
    }


@app.post("/social/posts/{post_id}/unschedule")
def unschedule_social_post_endpoint(
    post_id: int,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    post.status = "Draft"
    create_activity_log(
        db,
        "Social Schedule Cancelled",
        f"Jadwal tayang otomatis untuk '{post.title}' dibatalkan (kembali ke Draft).",
    )
    db.commit()
    db.refresh(post)
    return {
        "success": True,
        "message": "Jadwal otomatis dibatalkan. Status kembali ke Draft.",
        "post": _serialize_social_post(post),
    }


def _run_scheduled_social_posts_once():
    db = SessionLocal()
    try:
        scheduled_posts = (
            db.query(SocialPost)
            .filter(SocialPost.status == "Scheduled")
            .all()
        )
        now = datetime.now()
        for post in scheduled_posts:
            if not post.scheduled_at:
                continue
            try:
                due_dt = datetime.fromisoformat(
                    post.scheduled_at.strip().replace("Z", "")
                )
            except Exception:
                continue

            if now >= due_dt:
                try:
                    publish_social_post_direct(
                        post_id=post.id,
                        payload=None,
                        db=db,
                    )
                except Exception as exc:
                    post.status = "Failed"
                    post.gas_response = json.dumps(
                        {"scheduler_error": {"success": False, "error": str(exc)}}
                    )
                    db.commit()
    except Exception:
        pass
    finally:
        db.close()


_SCHEDULER_STARTED = False


def _start_social_scheduler_daemon():
    global _SCHEDULER_STARTED
    if _SCHEDULER_STARTED:
        return
    _SCHEDULER_STARTED = True

    def _loop():
        while True:
            time.sleep(20)
            _run_scheduled_social_posts_once()

    t = threading.Thread(target=_loop, daemon=True, name="vhq-social-scheduler")
    t.start()


class SocialCalendarGenerateRequest(BaseModel):
    campaign_theme: str = Field(min_length=1, max_length=10000)
    days: int = Field(default=5, ge=1, le=7)
    start_date: Optional[str] = None
    post_time: str = "09:00"
    auto_schedule: bool = True
    model: Optional[str] = "auto"
    platforms: list[str] = Field(
        default_factory=lambda: [
            "facebook",
            "instagram",
            "youtube",
            "tiktok",
            "threads",
        ]
    )
    tone: Optional[str] = (
        "Profesional, edukatif, dan menarik untuk UMKM & pebisnis"
    )
    project_id: Optional[int] = None


class SocialRefineRequest(BaseModel):
    platform: str
    instruction: str = Field(min_length=1, max_length=2000)
    current_content: Optional[str] = None
    model: Optional[str] = "auto"


@app.post("/social/generate-calendar")
def generate_social_calendar_endpoint(
    payload: SocialCalendarGenerateRequest,
    db: Session = Depends(get_db),
):
    platforms = _normalize_platforms(payload.platforms)
    source_context = ""

    if payload.project_id:
        project = (
            db.query(Project).filter(Project.id == payload.project_id).first()
        )
        if project:
            source_context += (
                f"Project: {project.name}\n"
                f"Deskripsi: {project.description or '-'}\n"
            )

    try:
        raw_output = generate_social_calendar(
            campaign_theme=payload.campaign_theme.strip(),
            model=payload.model,
            days=payload.days,
            platforms=platforms,
            tone=payload.tone
            or "Profesional, edukatif, dan menarik untuk UMKM & pebisnis",
            source_context=source_context,
            winning_posts_context=_get_winning_posts_context(db),
        )
        parsed = parse_plan_json(raw_output)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI gagal menyusun kalender konten: {str(exc)}",
        )

    days_list = parsed.get("days")
    if not isinstance(days_list, list) or not days_list:
        raise HTTPException(
            status_code=502,
            detail="AI tidak mengembalikan daftar hari kalender konten yang valid.",
        )

    try:
        base_date = (
            datetime.strptime(payload.start_date.strip(), "%Y-%m-%d")
            if payload.start_date and payload.start_date.strip()
            else datetime.now() + timedelta(days=1)
        )
    except Exception:
        base_date = datetime.now() + timedelta(days=1)

    time_part = (payload.post_time or "09:00").strip()
    if not re.match(r"^\d{2}:\d{2}$", time_part):
        time_part = "09:00"

    created_posts: list[SocialPost] = []
    campaign_name = str(
        parsed.get("campaign_name") or payload.campaign_theme[:50]
    ).strip()

    for idx, day_item in enumerate(days_list):
        if not isinstance(day_item, dict):
            continue
        target_dt = base_date + timedelta(days=idx)
        sched_iso = f"{target_dt.strftime('%Y-%m-%d')}T{time_part}"
        day_num = day_item.get("day") or (idx + 1)
        angle = str(day_item.get("angle") or "").strip()
        raw_title = str(
            day_item.get("title") or f"{campaign_name} - Hari {day_num}"
        ).strip()
        full_title = (
            f"[Hari {day_num} · {angle}] {raw_title}"
            if angle
            else f"[Hari {day_num}] {raw_title}"
        )

        post = SocialPost(
            title=full_title[:280],
            topic=payload.campaign_theme.strip(),
            platforms=",".join(platforms),
            content_facebook=str(day_item.get("facebook") or "").strip(),
            content_instagram=str(day_item.get("instagram") or "").strip(),
            content_youtube=str(day_item.get("youtube") or "").strip(),
            content_tiktok=str(day_item.get("tiktok") or "").strip(),
            content_threads=normalize_threads_text(
                day_item.get("threads") or ""
            ),
            scheduled_at=sched_iso if payload.auto_schedule else None,
            status="Scheduled" if payload.auto_schedule else "Draft",
            project_id=payload.project_id,
        )
        db.add(post)
        created_posts.append(post)

    create_activity_log(
        db,
        "Social Content Calendar Generated",
        (
            f"AI membuat Kalender Konten '{campaign_name}' berisi "
            f"{len(created_posts)} hari postingan omnichannel."
        ),
    )
    db.commit()
    for p in created_posts:
        db.refresh(p)

    return {
        "success": True,
        "campaign_name": campaign_name,
        "model_used": resolve_ai_model(payload.model, task_type="calendar"),
        "count": len(created_posts),
        "posts": [_serialize_social_post(p) for p in created_posts],
    }


@app.post("/social/posts/{post_id}/refine")
def refine_social_post_platform_endpoint(
    post_id: int,
    payload: SocialRefineRequest,
    db: Session = Depends(get_db),
):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=404,
            detail="Konten sosial media tidak ditemukan.",
        )

    p = payload.platform.strip().lower()
    if p not in VALID_SOCIAL_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Platform '{payload.platform}' tidak valid.",
        )

    field_map = {
        "facebook": "content_facebook",
        "instagram": "content_instagram",
        "youtube": "content_youtube",
        "tiktok": "content_tiktok",
        "threads": "content_threads",
    }
    attr_name = field_map[p]
    existing_text = (
        payload.current_content
        if payload.current_content is not None
        else (getattr(post, attr_name) or "")
    )

    try:
        refined = refine_social_platform_content(
            platform=p,
            current_content=existing_text,
            model=payload.model,
            instruction=payload.instruction.strip(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI gagal merevisi konten {p}: {str(exc)}",
        )

    if p == "threads":
        refined = normalize_threads_text(refined)

    setattr(post, attr_name, refined)
    create_activity_log(
        db,
        "Social Content Refined",
        f"AI menyempurnakan konten {PLATFORM_LABELS.get(p, p)} pada '{post.title}'.",
    )
    db.commit()
    db.refresh(post)

    return {
        "success": True,
        "platform": p,
        "refined_content": refined,
        "model_used": resolve_ai_model(payload.model, task_type="refine"),
        "post": _serialize_social_post(post),
    }


# ============================================================
# AI ENGAGEMENT INTELLIGENCE & WINNING COPYWRITING ENGINE
# ============================================================

DEFAULT_WINNING_BENCHMARKS = [
    {
        "platform": "threads",
        "title_or_hook": "90% pemilik UMKM merasa omzetnya naik, tapi saldo rekeningnya jalan di tempat.",
        "content_snippet": (
            "90% pemilik UMKM merasa omzetnya naik, tapi saldo rekeningnya jalan di tempat.\n\n"
            "Setelah kami audit 40+ pembukuan bisnis, penyebab nomor 1 bukan kurang jualan.\n"
            "Tapi 'kebocoran mikro' yang tak tercatat karena rekap Excel masih ketik manual tiap malam.\n\n"
            "---\n\n"
            "3 tanda laporan keuangan bisnismu butuh otomasi sekarang:\n"
            "1. Butuh >2 hari buat tahu laba bersih bulan lalu\n"
            "2. Stok barang di gudang beda sama catatan admin\n"
            "3. Piutang customer sering lupa ditagih\n\n"
            "Nomor berapa yang paling sering kejadian di tempatmu?"
        ),
        "views": 18400,
        "likes": 642,
        "comments": 138,
        "shares": 215,
        "saves": 310,
        "ai_pattern_notes": "Hook kontras (Omzet naik vs Saldo jalan di tempat) + Angka spesifik (90%, 40+ bisnis) + Pertanyaan penutup yang mudah dijawab dengan nomor (1/2/3).",
    },
    {
        "platform": "instagram",
        "title_or_hook": "Jangan rekrut admin tambahan sebelum kamu memperbaiki 1 file Excel ini.",
        "content_snippet": (
            "[Slide 1] Jangan rekrut admin tambahan sebelum kamu memperbaiki 1 file Excel ini.\n"
            "[Slide 2] Banyak founder kira timnya kewalahan karena kurang orang. Padahal 4 jam/hari habis cuma buat copy-paste data dari marketplace & WA ke laporan harian.\n"
            "[Slide 3] Dengan Macro & Dashboard Otomatis, pekerjaan 4 jam dipangkas jadi 1 klik (15 detik).\n\n"
            "Caption: Pernah hitung berapa jam timmu habis cuma buat rekap berulang? Simpan postingan ini & tulis 'AUDIT' di komentar kalau mau kami bantu cek alur spreadsheet bisnismu."
        ),
        "views": 24900,
        "likes": 910,
        "comments": 194,
        "shares": 280,
        "saves": 620,
        "ai_pattern_notes": "Hook kontra-intuitif ('Jangan rekrut admin...') + Perbandingan waktu ekstrem (4 jam vs 15 detik) + CTA 1 kata di komentar ('AUDIT').",
    },
    {
        "platform": "facebook",
        "title_or_hook": "Studi Kasus: Bagaimana distributor bahan bangunan memangkas selisih stok Rp 18 juta/bulan dengan Dashboard Otomatis.",
        "content_snippet": (
            "Studi Kasus Nyata Minggu Ini:\n\n"
            "Seorang klien distributor menghubungi kami karena tiap akhir bulan selalu ada selisih stok Rp 15-18 juta yang tidak jelas rimbanya.\n\n"
            "Masalahnya sederhana: 3 gudang memakai file Excel terpisah tanpa validasi rumus otomatis.\n\n"
            "Solusi yang kami bangun dalam 5 hari:\n"
            "✅ Sistem input terpusat dengan pengunci sel otomatis\n"
            "✅ Peringatan stok minimum (Early Warning) real-time\n"
            "✅ Dashboard Laba-Rugi & Arus Kas harian 1 layar\n\n"
            "Hasilnya: Bulan pertama selisih stok turun ke 0, dan owner bisa pantau bisnis dari HP.\n"
            "Bagian mana di operasional bisnis Anda yang paling menyita waktu saat ini?"
        ),
        "views": 14200,
        "likes": 485,
        "comments": 96,
        "shares": 164,
        "saves": 190,
        "ai_pattern_notes": "Storytelling studi kasus nyata dengan nilai rupiah konkret (Rp 18 juta/bulan) + Bullet point Before/After jelas + Pertanyaan terbuka.",
    },
]


class SocialMetricCreateRequest(BaseModel):
    post_id: Optional[int] = None
    platform: str = "threads"
    title_or_hook: str = Field(min_length=1, max_length=300)
    content_snippet: str = Field(min_length=1, max_length=10000)
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    ai_pattern_notes: Optional[str] = None


class SocialWinningReplicateRequest(BaseModel):
    new_topic: Optional[str] = ""
    platforms: list[str] = Field(
        default_factory=lambda: [
            "facebook",
            "instagram",
            "youtube",
            "tiktok",
            "threads",
        ]
    )
    tone: Optional[str] = (
        "Tajam, relevan, memancing diskusi tinggi & shareable"
    )
    scheduled_at: Optional[str] = None
    model: Optional[str] = "auto"
    save_as_draft: bool = True


def _ensure_initial_engagement_benchmarks(db: Session) -> list[SocialPostMetric]:
    count = db.query(SocialPostMetric).count()
    if count == 0:
        for item in DEFAULT_WINNING_BENCHMARKS:
            score, rate_str = calculate_engagement_score(
                views=item["views"],
                likes=item["likes"],
                comments=item["comments"],
                shares=item["shares"],
                saves=item["saves"],
            )
            metric = SocialPostMetric(
                platform=item["platform"],
                title_or_hook=item["title_or_hook"],
                content_snippet=item["content_snippet"],
                views=item["views"],
                likes=item["likes"],
                comments=item["comments"],
                shares=item["shares"],
                saves=item["saves"],
                engagement_score=score,
                engagement_rate=rate_str,
                ai_pattern_notes=item["ai_pattern_notes"],
            )
            db.add(metric)
        db.commit()

    return (
        db.query(SocialPostMetric)
        .order_by(SocialPostMetric.engagement_score.desc())
        .limit(30)
        .all()
    )


def _serialize_post_metric(m: SocialPostMetric) -> dict[str, Any]:
    return {
        "id": m.id,
        "post_id": m.post_id,
        "platform": m.platform,
        "label": PLATFORM_LABELS.get(m.platform, m.platform.title()),
        "external_post_id": m.external_post_id,
        "title_or_hook": m.title_or_hook,
        "content_snippet": m.content_snippet,
        "views": m.views or 0,
        "likes": m.likes or 0,
        "comments": m.comments or 0,
        "shares": m.shares or 0,
        "saves": m.saves or 0,
        "engagement_score": m.engagement_score or 0,
        "engagement_rate": m.engagement_rate or "0%",
        "ai_pattern_notes": m.ai_pattern_notes or "",
        "recorded_at": m.recorded_at,
    }


def _get_winning_posts_context(db: Session, limit: int = 5) -> str:
    metrics = _ensure_initial_engagement_benchmarks(db)[:limit]
    if not metrics:
        return ""
    lines = [
        "PELAJARI DAN TIRU POLA COPYWRITING DARI POSTINGAN ENGAGEMENT TERTINGGI BERIKUT:"
    ]
    for idx, m in enumerate(metrics, start=1):
        lines.append(
            f"\n[Winning Post #{idx} · Platform: {m.platform.upper()} · "
            f"Score: {m.engagement_score} (Views: {m.views}, Likes: {m.likes}, Comments: {m.comments}, Shares: {m.shares}, Saves: {m.saves})]\n"
            f"Hook: {m.title_or_hook}\n"
            f"Copywriting:\n{m.content_snippet}\n"
            f"Catatan Pola Viral: {m.ai_pattern_notes or '-'}"
        )
    return "\n".join(lines)


@app.get("/social/engagement/top")
def get_top_engagement_posts(db: Session = Depends(get_db)):
    metrics = _ensure_initial_engagement_benchmarks(db)
    return [_serialize_post_metric(m) for m in metrics]


@app.post("/social/engagement/metrics")
def add_or_update_engagement_metric(
    payload: SocialMetricCreateRequest,
    db: Session = Depends(get_db),
):
    p = payload.platform.strip().lower()
    if p not in VALID_SOCIAL_PLATFORMS:
        p = "threads"

    score, rate_str = calculate_engagement_score(
        views=payload.views,
        likes=payload.likes,
        comments=payload.comments,
        shares=payload.shares,
        saves=payload.saves,
    )

    metric = SocialPostMetric(
        post_id=payload.post_id,
        platform=p,
        title_or_hook=payload.title_or_hook.strip(),
        content_snippet=payload.content_snippet.strip(),
        views=max(0, payload.views),
        likes=max(0, payload.likes),
        comments=max(0, payload.comments),
        shares=max(0, payload.shares),
        saves=max(0, payload.saves),
        engagement_score=score,
        engagement_rate=rate_str,
        ai_pattern_notes=(payload.ai_pattern_notes or "").strip() or None,
    )
    db.add(metric)
    create_activity_log(
        db,
        "Winning Post Metric Recorded",
        f"Menambahkan referensi postingan engagement tinggi '{metric.title_or_hook[:60]}' (Score: {score}).",
    )
    db.commit()
    db.refresh(metric)
    return {
        "success": True,
        "message": f"Data engagement berhasil disimpan (Engagement Score: {score}).",
        "metric": _serialize_post_metric(metric),
    }


@app.delete("/social/engagement/metrics/{metric_id}")
def delete_engagement_metric(
    metric_id: int,
    db: Session = Depends(get_db),
):
    metric = (
        db.query(SocialPostMetric)
        .filter(SocialPostMetric.id == metric_id)
        .first()
    )
    if not metric:
        raise HTTPException(
            status_code=404,
            detail="Data histori engagement tidak ditemukan.",
        )
    db.delete(metric)
    db.commit()
    return {"success": True, "message": "Data histori engagement dihapus."}


@app.post("/social/engagement/sync-live")
def sync_live_engagement_from_apis(db: Session = Depends(get_db)):
    accounts_map = _get_or_create_social_accounts(db)
    synced_count = 0
    errors: dict[str, str] = {}

    for p, acc in accounts_map.items():
        creds = _parse_account_creds(acc)
        if not any(bool(v.strip()) for v in creds.values()):
            continue
        try:
            fetched_items = fetch_live_platform_metrics(p, creds)
            for item in fetched_items:
                ext_id = item.get("external_post_id")
                existing = None
                if ext_id:
                    existing = (
                        db.query(SocialPostMetric)
                        .filter(
                            SocialPostMetric.platform == p,
                            SocialPostMetric.external_post_id == ext_id,
                        )
                        .first()
                    )
                score, rate_str = calculate_engagement_score(
                    views=item.get("views", 0),
                    likes=item.get("likes", 0),
                    comments=item.get("comments", 0),
                    shares=item.get("shares", 0),
                    saves=item.get("saves", 0),
                )
                if existing:
                    existing.views = item.get("views", 0)
                    existing.likes = item.get("likes", 0)
                    existing.comments = item.get("comments", 0)
                    existing.shares = item.get("shares", 0)
                    existing.saves = item.get("saves", 0)
                    existing.engagement_score = score
                    existing.engagement_rate = rate_str
                else:
                    db.add(
                        SocialPostMetric(
                            platform=p,
                            external_post_id=ext_id,
                            title_or_hook=item["title_or_hook"],
                            content_snippet=item["content_snippet"],
                            views=item.get("views", 0),
                            likes=item.get("likes", 0),
                            comments=item.get("comments", 0),
                            shares=item.get("shares", 0),
                            saves=item.get("saves", 0),
                            engagement_score=score,
                            engagement_rate=rate_str,
                        )
                    )
                synced_count += 1
        except Exception as exc:
            errors[p] = str(exc)

    db.commit()
    metrics = _ensure_initial_engagement_benchmarks(db)
    return {
        "success": True,
        "synced_count": synced_count,
        "errors": errors,
        "message": (
            f"Berhasil menyinkronkan {synced_count} histori postingan dari API sosmed."
            if synced_count > 0
            else "Menampilkan histori benchmark engagement terbaik yang tersimpan di workspace."
        ),
        "metrics": [_serialize_post_metric(m) for m in metrics],
    }


@app.post("/social/engagement/analyze-and-generate")
def analyze_and_replicate_winning_endpoint(
    payload: SocialWinningReplicateRequest,
    db: Session = Depends(get_db),
):
    platforms = _normalize_platforms(payload.platforms)
    top_metrics = _ensure_initial_engagement_benchmarks(db)[:6]
    serialized_top = [_serialize_post_metric(m) for m in top_metrics]

    try:
        raw_output = analyze_and_replicate_winning_posts(
            winning_posts=serialized_top,
            model=payload.model,
            new_topic=payload.new_topic or "",
            platforms=platforms,
            tone=payload.tone
            or "Tajam, relevan, memancing diskusi tinggi & shareable",
        )
        parsed = parse_plan_json(raw_output)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI gagal menganalisis & mereplikasi postingan terbaik: {str(exc)}",
        )

    pattern_analysis = parsed.get("pattern_analysis") or {}
    generated_title = str(
        parsed.get("title")
        or (payload.new_topic or "Konten Berbasis Winning Engagement")[:100]
    ).strip()

    generated = {
        "title": f"🔥 [Winning Formula] {generated_title}",
        "facebook": str(parsed.get("facebook", "")).strip(),
        "instagram": str(parsed.get("instagram", "")).strip(),
        "youtube": str(parsed.get("youtube", "")).strip(),
        "tiktok": str(parsed.get("tiktok", "")).strip(),
        "threads": normalize_threads_text(parsed.get("threads", "")),
    }

    saved_post = None
    if payload.save_as_draft:
        sched = (
            payload.scheduled_at.strip()
            if payload.scheduled_at and payload.scheduled_at.strip()
            else None
        )
        post = SocialPost(
            title=generated["title"][:280],
            topic=payload.new_topic
            or "Replikasi Pola Engagement Tertinggi (Winning DNA)",
            platforms=",".join(platforms),
            content_facebook=generated["facebook"],
            content_instagram=generated["instagram"],
            content_youtube=generated["youtube"],
            content_tiktok=generated["tiktok"],
            content_threads=generated["threads"],
            scheduled_at=sched,
            status="Scheduled" if sched else "Draft",
        )
        db.add(post)
        create_activity_log(
            db,
            "Winning Copywriting Replicated",
            (
                f"AI mempelajari {len(serialized_top)} postingan engagement tertinggi "
                f"dan membuat konten baru: '{post.title}'."
            ),
        )
        db.commit()
        db.refresh(post)
        saved_post = _serialize_social_post(post)

    return {
        "success": True,
        "pattern_analysis": pattern_analysis,
        "model_used": resolve_ai_model(payload.model, task_type="winning_copy"),
        "generated": generated,
        "model_used": resolve_ai_model(payload.model, task_type="social_post"),
        "post": saved_post,
    }


class WorkspaceSettingsUpdate(BaseModel):
    office_name: Optional[str] = None
    office_subtitle: Optional[str] = None
    office_badge: Optional[str] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = Field(
        default=None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
    )
    led_line_1: Optional[str] = None
    led_line_2: Optional[str] = None
    chalk_line_1: Optional[str] = None
    chalk_line_2: Optional[str] = None
    chalk_line_3: Optional[str] = None


def _get_or_create_workspace_settings(db: Session) -> WorkspaceSettings:
    settings = db.query(WorkspaceSettings).first()
    if not settings:
        settings = WorkspaceSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _serialize_workspace_settings(s: WorkspaceSettings) -> dict[str, Any]:
    return {
        "id": s.id,
        "office_name": s.office_name or "Solusi Macro",
        "office_subtitle": s.office_subtitle or "Excel · Dashboard · Otomasi",
        "office_badge": s.office_badge or "Virtual Office · AI Team",
        "logo_url": s.logo_url or "/solusi-macro-logo.png",
        "brand_color": s.brand_color or "#4f46e5",
        "led_line_1": s.led_line_1 or "DREAM IT",
        "led_line_2": s.led_line_2 or "MAKE IT REAL",
        "chalk_line_1": s.chalk_line_1 or "Good",
        "chalk_line_2": s.chalk_line_2 or "Vibes",
        "chalk_line_3": s.chalk_line_3 or "Only",
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@app.get("/workspace/settings")
def get_workspace_settings(db: Session = Depends(get_db)):
    settings = _get_or_create_workspace_settings(db)
    return _serialize_workspace_settings(settings)


@app.put("/workspace/settings")
def update_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    db: Session = Depends(get_db),
):
    settings = _get_or_create_workspace_settings(db)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is not None:
            setattr(settings, field, value.strip())
    create_activity_log(
        db,
        "Workspace Branding Updated",
        f"Pengaturan branding & kantor '{settings.office_name}' diperbarui.",
    )
    db.commit()
    db.refresh(settings)
    return {"success": True, "settings": _serialize_workspace_settings(settings)}


@app.post("/workspace/logo")
async def upload_workspace_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = file.filename or "logo.png"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        raise HTTPException(
            status_code=400,
            detail="Format logo harus berupa gambar (.png, .jpg, .jpeg, .webp, .svg).",
        )
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Ukuran file logo maksimal 5MB.",
        )

    upload_dir = os.path.join(os.path.dirname(__file__), "uploaded_files")
    os.makedirs(upload_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_filename = f"custom_logo_{ts}{ext}"
    file_path = os.path.join(upload_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    logo_url = f"/workspace/logo/{safe_filename}"
    settings = _get_or_create_workspace_settings(db)
    settings.logo_url = logo_url
    create_activity_log(
        db,
        "Workspace Logo Updated",
        f"Logo kantor custom diunggah: {safe_filename}",
    )
    db.commit()
    db.refresh(settings)
    return {
        "success": True,
        "logo_url": logo_url,
        "settings": _serialize_workspace_settings(settings),
    }


@app.get("/workspace/logo/{filename}")
def get_workspace_logo(filename: str):
    if not re.match(r"^[a-zA-Z0-9_.-]+$", filename):
        raise HTTPException(status_code=400, detail="Nama file tidak valid.")
    upload_dir = os.path.join(os.path.dirname(__file__), "uploaded_files")
    file_path = os.path.join(upload_dir, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Logo tidak ditemukan.")
    return FileResponse(file_path)


# APPLICATION STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():
    from sqlalchemy import inspect, text
    try:
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        agent_cols = {col["name"] for col in inspector.get_columns("agents")}
        workspace_cols = {
            col["name"] for col in inspector.get_columns("workspace_settings")
        }
        with engine.begin() as conn:
            if "preferred_provider_id" not in agent_cols:
                conn.execute(text("ALTER TABLE agents ADD COLUMN preferred_provider_id VARCHAR"))
            if "preferred_model" not in agent_cols:
                conn.execute(text("ALTER TABLE agents ADD COLUMN preferred_model VARCHAR"))
            if "brand_color" not in workspace_cols:
                conn.execute(
                    text(
                        "ALTER TABLE workspace_settings "
                        "ADD COLUMN brand_color VARCHAR(7) DEFAULT '#4f46e5'"
                    )
                )
    except Exception as exc:
        print(f"[Migration warning] {exc}")

    print("==========================================")
    print(" WORKSPACE")
    print(" Backend API is running")
    print(f" Version: {APP_VERSION}")
    print(" AI Agent Executor: ENABLED")
    print(" Failed Task Retry: ENABLED")
    print(" Founder Approval: ENABLED")
    _start_social_scheduler_daemon()
    print(" Social Auto-Scheduler: ENABLED")
    print(" Founder Approval Notes: ENABLED")
    print("==========================================")
