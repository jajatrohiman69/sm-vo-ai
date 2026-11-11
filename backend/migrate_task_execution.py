
import sqlite3

DB_PATH = "vhq.db"

columns = {
    "result": "TEXT",
    "error_message": "TEXT",
    "started_at": "DATETIME",
    "completed_at": "DATETIME",
    "attempt_count": "INTEGER DEFAULT 0",
}

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

existing_columns = {
    row[1]
    for row in cursor.execute("PRAGMA table_info(tasks)").fetchall()
}

for column_name, column_type in columns.items():
    if column_name not in existing_columns:
        cursor.execute(
            f"ALTER TABLE tasks ADD COLUMN {column_name} {column_type}"
        )
        print(f"Kolom {column_name} berhasil ditambahkan.")
    else:
        print(f"Kolom {column_name} sudah tersedia.")

conn.commit()
conn.close()

print("Migrasi database selesai.")
