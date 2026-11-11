from database import SessionLocal
from models import Agent

agents = [
    {
        "name": "AI CEO",
        "role": "Chief Executive Officer",
        "department": "Management",
        "status": "Online",
        "description": "Memimpin Virtual HQ, menerima instruksi Founder, dan mendelegasikan pekerjaan."
    },
    {
        "name": "Secretary",
        "role": "Administration & PMO",
        "department": "Operations",
        "status": "Standby",
        "description": "Mengelola administrasi, jadwal, dokumentasi, dan koordinasi tugas."
    },
    {
        "name": "Business Analyst",
        "role": "Business Analysis",
        "department": "Analysis",
        "status": "Standby",
        "description": "Menganalisis kebutuhan bisnis dan merancang solusi."
    },
    {
        "name": "Excel Engineer",
        "role": "Excel Solutions",
        "department": "Development",
        "status": "Standby",
        "description": "Membangun solusi Excel, formula, dan spreadsheet."
    },
    {
        "name": "Automation Engineer",
        "role": "Process Automation",
        "department": "Development",
        "status": "Standby",
        "description": "Membangun otomatisasi proses dan workflow."
    },
    {
        "name": "Dashboard Analyst",
        "role": "Data Visualization",
        "department": "Analytics",
        "status": "Standby",
        "description": "Mengolah data menjadi dashboard dan visualisasi."
    },
    {
        "name": "QA & Documentation",
        "role": "Quality Assurance",
        "department": "Quality",
        "status": "Standby",
        "description": "Memeriksa kualitas hasil kerja dan menyiapkan dokumentasi."
    }
]

db = SessionLocal()

try:
    added = 0

    for agent_data in agents:
        existing = db.query(Agent).filter(
            Agent.name == agent_data["name"]
        ).first()

        if not existing:
            db.add(Agent(**agent_data))
            added += 1

    db.commit()

    total = db.query(Agent).count()

    print(f"Berhasil menambahkan {added} agent.")
    print(f"Total agent dalam database: {total}")

except Exception as error:
    db.rollback()
    print(f"Terjadi error: {error}")

finally:
    db.close()