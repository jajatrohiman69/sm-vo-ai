import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OCTA_API_KEY = os.getenv("OCTA_API_KEY")
OCTA_BASE_URL = os.getenv(
    "OCTA_BASE_URL",
    "https://octa.telkomsel.com/v1"
)
OCTA_MODEL = os.getenv(
    "OCTA_MODEL",
    "claude-sonnet-5-5"
)


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
# AI CLIENT
# ============================================================

def get_ai_client():
    if not OCTA_API_KEY:
        raise RuntimeError(
            "OCTA_API_KEY belum diatur di file .env"
        )

    return OpenAI(
        api_key=OCTA_API_KEY,
        base_url=OCTA_BASE_URL
    )


# ============================================================
# AI CEO CHAT
# ============================================================

def ask_claude(
    message: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None
) -> str:

    client = get_ai_client()

    messages = [
        {
            "role": "system",
            "content": system_prompt or (
                "Kamu adalah AI CEO Solusi Macro Virtual HQ. "
                "Bantu Founder mengelola bisnis secara profesional. "
                "Gunakan Bahasa Indonesia yang jelas dan profesional. "
                "Gunakan Markdown normal tanpa meng-escape tanda baca."
            )
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

    messages.append({
        "role": "user",
        "content": message
    })

    response = client.chat.completions.create(
        model=OCTA_MODEL,
        messages=messages,
        max_tokens=2000,
        temperature=0.7
    )

    return response.choices[0].message.content or ""


# ============================================================
# AI CEO TASK PLANNER
# ============================================================

def generate_task_plan(
    project: dict,
    agents: list[dict],
    existing_tasks: list[dict],
    instruction: str
) -> str:

    client = get_ai_client()

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

    response = client.chat.completions.create(
        model=OCTA_MODEL,
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
        temperature=0.2
    )

    return response.choices[0].message.content or ""


# ============================================================
# AI AGENT TASK EXECUTOR
# ============================================================

def execute_agent_task(
    agent,
    project,
    task,
    prior_results=None
) -> str:

    client = get_ai_client()

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

INSTRUKSI:
Kerjakan task ini sekarang sesuai jabatan dan tanggung jawabmu.

Berikan hasil pekerjaan yang lengkap, konkret, dan bisa ditinjau Founder.
"""

    response = client.chat.completions.create(
        model=OCTA_MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        max_tokens=4000,
        temperature=0.3
    )

    result = response.choices[0].message.content

    if not result:
        raise RuntimeError(
            f"AI Agent {agent_name} tidak menghasilkan output."
        )

    return result