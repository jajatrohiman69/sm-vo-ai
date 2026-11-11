
from sqlalchemy import inspect, text

from database import engine, Base
import models


def migrate_database():
    inspector = inspect(engine)

    # Tambahkan project_id ke tabel tasks jika belum tersedia.
    task_columns = [
        column["name"]
        for column in inspector.get_columns("tasks")
    ]

    if "project_id" not in task_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE tasks "
                    "ADD COLUMN project_id INTEGER "
                    "REFERENCES projects(id)"
                )
            )

        print("[OK] Kolom project_id berhasil ditambahkan.")
    else:
        print("[SKIP] Kolom project_id sudah tersedia.")

    # Membuat tabel baru TaskPlan dan TaskPlanItem.
    Base.metadata.create_all(bind=engine)

    print("[OK] Tabel Task Planner berhasil diperiksa/dibuat.")

    # Verifikasi tabel.
    inspector = inspect(engine)

    for table in [
        "agents",
        "projects",
        "tasks",
        "activity_logs",
        "chat_messages",
        "task_plans",
        "task_plan_items"
    ]:
        if inspector.has_table(table):
            print(f"[OK] Tabel {table} tersedia.")
        else:
            print(f"[ERROR] Tabel {table} belum tersedia.")

    print("\nMigrasi selesai.")


if __name__ == "__main__":
    migrate_database()
