from datetime import datetime
import json
import re
from typing import Any, Literal, Optional

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    BackgroundTasks,
    Request,
    Response,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
)

from ai_service import (
    ask_claude,
    generate_task_plan,
    execute_agent_task,
)
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
    title="Solusi Macro Virtual HQ API",
    description="Internal AI-powered management system for Solusi Macro.",
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
    }:
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


class FounderLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=1024)


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "Normal"
    assigned_agent_id: Optional[int] = None
    project_id: Optional[int] = None


class AIChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class TaskPlanGenerateRequest(BaseModel):
    project_id: int
    instruction: Optional[str] = None


class TaskReviewRequest(BaseModel):
    action: str
    feedback: Optional[str] = None


class TaskRetryRequest(BaseModel):
    task_ids: Optional[list[int]] = None


# ============================================================
# SYSTEM PROMPT
# ============================================================

CEO_SYSTEM_PROMPT = """
You are the AI CEO of Solusi Macro.

COMPANY PROFILE:
Solusi Macro provides:
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


def build_ai_context(db: Session):
    agents = db.query(Agent).all()
    projects = db.query(Project).all()

    tasks = (
        db.query(Task)
        .order_by(Task.created_at.desc())
        .limit(30)
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
                "description": project.description,
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

            result = execute_agent_task(
                agent=agent,
                project=task.project,
                task=task,
                prior_results=prior_results,
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
                "result": result,
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
def root():
    return {
        "success": True,
        "application": "Solusi Macro Virtual HQ",
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
    db: Session = Depends(get_db),
):
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
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        assigned_agent_id=payload.assigned_agent_id,
        project_id=payload.project_id,
        status="Pending",
    )

    db.add(task)
    db.flush()

    create_activity_log(
        db,
        "Task Created",
        f"Task '{task.title}' berhasil dibuat.",
    )

    db.commit()
    db.refresh(task)

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
def get_ai_status():
    return {
        "success": True,
        "provider": "OCTA Telkomsel",
        "model": "Configured through OCTA_MODEL",
        "base_url": "Configured through OCTA_BASE_URL",
        "status": "configured",
    }


@app.post("/ai/test")
def test_ai_connection():
    try:
        response = ask_claude(
            message="Balas singkat: AI CEO Solusi Macro online.",
            system_prompt=CEO_SYSTEM_PROMPT,
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

    user_message = ChatMessage(
        session_id=payload.session_id,
        role="user",
        content=message,
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

    history = [
        {
            "role": item.role,
            "content": item.content,
        }
        for item in history_records[:-1]
    ]

    context = build_ai_context(db)

    system_prompt = (
        CEO_SYSTEM_PROMPT
        + "\n\nCURRENT VIRTUAL HQ DATA:\n"
        + json.dumps(context, ensure_ascii=False, default=str)
        + "\n\nUse this data as context. Do not invent records."
    )

    try:
        response = ask_claude(
            message=message,
            system_prompt=system_prompt,
            history=history,
        )

        assistant_message = ChatMessage(
            session_id=payload.session_id,
            role="assistant",
            content=response,
        )

        db.add(assistant_message)

        create_activity_log(
            db,
            "AI CEO Chat",
            f"AI CEO merespons session {payload.session_id}.",
        )

        db.commit()
        db.refresh(assistant_message)

        return {
            "success": True,
            "session_id": payload.session_id,
            "message": response,
            "created_at": assistant_message.created_at,
        }

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=f"AI CEO gagal memberikan respons: {str(exc)}",
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
# APPLICATION STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():
    print("==========================================")
    print(" SOLUSI MACRO VIRTUAL HQ")
    print(" Backend API is running")
    print(f" Version: {APP_VERSION}")
    print(" AI Agent Executor: ENABLED")
    print(" Failed Task Retry: ENABLED")
    print(" Founder Approval: ENABLED")
    print(" Founder Approval Notes: ENABLED")
    print("==========================================")
