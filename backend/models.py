
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    status = Column(String, default="Standby")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    assigned_tasks = relationship(
        "Task",
        back_populates="assigned_agent"
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="Planning")
    created_at = Column(DateTime, default=datetime.now)

    tasks = relationship(
        "Task",
        back_populates="project"
    )


class Task(Base):
    __tablename__ = "tasks"

    result = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    attempt_count = Column(Integer, default=0)
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="Pending")
    priority = Column(String, default="Normal")

    assigned_agent_id = Column(
        Integer,
        ForeignKey("agents.id"),
        nullable=True
    )

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=True
    )

    created_at = Column(DateTime, default=datetime.now)

    assigned_agent = relationship(
        "Agent",
        back_populates="assigned_tasks"
    )

    attachments = relationship(
        "TaskAttachment",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    project = relationship(
        "Project",
        back_populates="tasks"
    )


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id = Column(String(32), nullable=False)
    filename = Column(String, nullable=False)
    kind = Column(String(20), nullable=False)

    task = relationship("Task", back_populates="attachments")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class TaskPlan(Base):
    __tablename__ = "task_plans"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False
    )

    title = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Pending Approval, Approved, Rejected
    status = Column(
        String,
        default="Pending Approval",
        nullable=False
    )

    created_at = Column(DateTime, default=datetime.now)
    approved_at = Column(DateTime, nullable=True)

    project = relationship("Project")

    items = relationship(
        "TaskPlanItem",
        back_populates="plan",
        cascade="all, delete-orphan"
    )


class TaskPlanItem(Base):
    __tablename__ = "task_plan_items"

    id = Column(Integer, primary_key=True, index=True)

    plan_id = Column(
        Integer,
        ForeignKey("task_plans.id"),
        nullable=False
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, default="Normal")

    assigned_agent_id = Column(
        Integer,
        ForeignKey("agents.id"),
        nullable=False
    )

    plan = relationship(
        "TaskPlan",
        back_populates="items"
    )

    assigned_agent = relationship("Agent")


class SocialConfig(Base):
    __tablename__ = "social_configs"

    id = Column(Integer, primary_key=True, index=True)
    gas_webapp_url = Column(Text, nullable=True)
    gas_secret_key = Column(String, nullable=True)
    default_platforms = Column(
        String,
        default="facebook,instagram,youtube,tiktok,threads"
    )
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, unique=True, index=True, nullable=False)
    enabled = Column(Integer, default=1)
    account_name = Column(String, nullable=True)
    account_id = Column(String, nullable=True)
    credentials_json = Column(Text, nullable=True)
    status = Column(String, default="Not Connected")
    last_verified_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class SocialPost(Base):
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    topic = Column(Text, nullable=True)
    platforms = Column(String, nullable=False)
    content_facebook = Column(Text, nullable=True)
    content_instagram = Column(Text, nullable=True)
    content_youtube = Column(Text, nullable=True)
    content_tiktok = Column(Text, nullable=True)
    content_threads = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    scheduled_at = Column(String, nullable=True)
    status = Column(String, default="Draft")
    gas_response = Column(Text, nullable=True)
    source_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    published_at = Column(DateTime, nullable=True)


class SocialPostMetric(Base):
    __tablename__ = "social_post_metrics"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("social_posts.id"), nullable=True)
    platform = Column(String, nullable=False, index=True)
    external_post_id = Column(String, nullable=True)
    title_or_hook = Column(String, nullable=False)
    content_snippet = Column(Text, nullable=False)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    engagement_score = Column(Integer, default=0, index=True)
    engagement_rate = Column(String, nullable=True)
    ai_pattern_notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.now)


class AIProviderConfig(Base):
    __tablename__ = "ai_provider_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(String, unique=True, index=True, nullable=False)  # octa, gemini, custom, openrouter, groq
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key = Column(String, nullable=True)
    default_model = Column(String, nullable=False)
    custom_models_json = Column(Text, nullable=True)  # JSON list of model objects
    is_active = Column(Integer, default=0)  # 1 if this is the active provider
    status = Column(String, default="Not Tested")  # Active, Connected, Failed, Not Tested
    last_tested_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

