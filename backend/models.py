
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

    project = relationship(
        "Project",
        back_populates="tasks"
    )


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
