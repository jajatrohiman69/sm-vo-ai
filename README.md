# 🏢 Solusi Macro Virtual HQ (VHQ)
### *Next-Gen Autonomous AI Multi-Agent Office & Studio*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js%20r187-black.svg?style=flat&logo=three.js&logoColor=white)](https://threejs.org)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![OpenAI Compatible](https://img.shields.io/badge/AI%20Engine-Universal%20OpenAI%20API-412991.svg?style=flat&logo=openai&logoColor=white)](https://platform.openai.com)

Solusi Macro Virtual HQ (VHQ) adalah platform manajemen kerja kolaboratif berbasis **Multi-Agent AI** dengan visualisasi **3D Pixar-Style Isometric Office**. Dirancang khusus untuk mengelola operasional bisnis, otomatisasi spreadsheet Excel & Macro VBA, riset pasar, quality assurance, hingga produksi konten media sosial secara mandiri 24/7.

---

## 🌟 Fitur Utama (Key Features)

### 1. 🎮 3D Pixar-Style Virtual Office Diorama
* **Visualisasi Kantor 3D Interaktif**: Ruang kerja isometrik hangat lengkap dengan workstation kayu, laptop dengan layar kode berpendar, tanaman monstera, area sofa lounge, beanbag, rak kopi, dan latar jendela gedung pencakar langit.
* **8 Humanoid 3D Character Avatars**: Setiap agen AI memiliki wujud 3D bergaya Pixar dengan variasi gaya rambut, pakaian, kacamata, headphone, serta animasi napas (*breathing*), mengetik (*typing*), dan orb status aktif/idle.
* **Founder / CEO Click-to-Walk**: Karakter Founder (CEO) dapat digerakkan secara interaktif ke setiap stasiun meja agen untuk berdiskusi atau memberikan tugas langsung.
* **Dual Camera Mode**: Beralih fleksibel antara sudut pandang **2.5D Isometric Diorama** (tampilan estetik terarah) dan **3D Orbit 360°** (bisa diputar, di-zoom, dan di-pan bebas).

### 2. 🤖 Autonomous Multi-Agent Hierarchy
* **Raka (AI CEO)**: Memimpin Virtual HQ, menerima arahan strategis Founder, memecah proyek menjadi sub-tugas, dan mendelegasikannya.
* **Hendra (Excel Engineer)**: Spesialis formula Excel rumit, pemodelan spreadsheet data besar, dan perancangan kode VBA Macro otomatis.
* **Nadia (Secretary & PMO)**: Mengelola jadwal, administrasi berkas, dan memonitor SLA pengerjaan tugas.
* **Sari (Dashboard Analyst)**: Mengolah data mentah menjadi KPI visual, ringkasan metrik eksekutif, dan charting.
* **Bima (Automation Engineer)**: Merancang integrasi proses, skrip otomatisasi backend, dan optimasi alur kerja berulang.
* **Dinda (Business Analyst)**: Menganalisis kebutuhan pasar, studi kelayakan proses bisnis, dan validasi requirement klien.
* **Reza (QA & Documentation)**: Melakukan audit kode, stress-testing logika formula/VBA, dan menyusun standar SOP dokumentasi.
* **Tania (Social Media Specialist)**: Riset tren viral, copywriting omnichannel, dan penyusunan kalender konten mingguan/bulanan.

### 3. 📎 Attachment Knowledge Learner (Excel & Gambar)
* **Dukungan Format Lengkap**: Upload file `.xlsx`, `.xlsm` (Macro-Enabled), `.csv`, serta tangkapan layar gambar `.png`, `.jpg`, `.jpeg`, `.webp`.
* **Deep VBA Macro Inspection**: Menggunakan *olevba parser* untuk mengekstrak modul VBA tersembunyi dari workbook lama secara aman tanpa perlu membuka aplikasi Excel.
* **Spreadsheet Header & Data Profiling**: AI membaca nama sheet, jumlah baris, header kolom, dan sampel data untuk memahami konteks masalah bisnis secara mendalam.

### 4. 📊 Auto-Artifact Builder (.xlsx & .bas VBA Downloads)
* **Generasi File Excel Asli (`.xlsx`)**: Agen otomatis menyusun workbook Excel fungsional lengkap dengan format tabel profesional, header berwarna, formula matematika/logika, dan pembungkus teks.
* **Ekstraksi Modul VBA (`.bas`)**: Setiap blok kode VBA Macro yang dirancang agen otomatis dikonversi menjadi file modul `.bas` siap pakai.
* **One-Click Download**: File hasil rancangan agen dapat langsung diunduh dari modal hasil pekerjaan atau task board.

### 5. ⚡ AI Provider & Endpoint Hub (`/settings`)
* **Multi-Provider Realtime Switching**: Pindah provider AI (OCTA Telkomsel, GarapinAja/Custom OpenAI, Google Gemini Direct, Groq, OpenRouter, atau Ollama Lokal) langsung dari dashboard web tanpa restart server dan tanpa ubah file `.env`.
* **Live Connection Test & Latency Monitor**: Uji keaktifan endpoint beserta waktu respons (ms).
* **Auto-Discovery Models**: Endpoint `/models` memindai daftar model yang didukung oleh server provider secara otomatis dalam 1 klik.

### 6. 📡 Omnichannel Social Media Growth Studio (`/social`)
* Perencanaan dan pembuatan konten lintas platform (Facebook Page, Instagram Feeds/Reels, YouTube Shorts, TikTok, dan Threads).
* Kalender posting otomatis dengan status jadwal, pilar konten, dan pratinjau layout postingan.

---

## 🛠️ Tech Stack

### Frontend
* **Core Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript)
* **3D Graphics Engine**: [Three.js](https://threejs.org) (r187) dengan procedural canvas texturing, RoundedBox geometry, dan custom skeletal animation rigs
* **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com), Lucide Icons style
* **Markdown Renderer**: [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm)

### Backend
* **Web Framework**: [FastAPI](https://fastapi.tiangolo.com) (Python 3.11+) dengan Uvicorn ASGI Server
* **Database & ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) dengan SQLite (mudah dimigrasi ke PostgreSQL/MySQL)
* **AI Client**: Universal [OpenAI Python SDK](https://github.com/openai/openai-python) kompatibel dengan OpenAI, Google Gemini, Groq, DeepSeek, Ollama, dan Claude wrapper.
* **Excel & Macro Engine**:
  * `openpyxl`: Pembuatan, parsing, dan penataan gaya sheet Excel.
  * `oletools`: Inspeksi dan ekstraksi kode Macro VBA dari format OLE / `.xlsm`.
  * `python-multipart`: Handler streaming upload file biner dan gambar.

---

## 🚀 Panduan Instalasi (Installation Guide)

### 📋 Prasyarat Sistem
Pastikan perangkat Anda telah terpasang:
1. **Node.js** v18.18+ atau v20+ & **npm**
2. **Python** 3.10, 3.11, atau 3.12
3. **Git**

---

### Langkah 1: Clone Repository
```bash
git clone https://github.com/jajatrohiman69/sm-vo-ai.git
cd sm-vo-ai
```

---

### Langkah 2: Setup & Jalankan Backend (FastAPI)

1. **Masuk ke direktori backend:**
   ```bash
   cd backend
   ```

2. **Buat virtual environment Python & aktifkan:**
   * Di Windows (PowerShell):
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   * Di macOS / Linux:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependensi Python:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Konfigurasi Environment Variable (`.env`):**
   Salin berkas contoh:
   ```bash
   cp .env.example .env
   ```
   *(Opsional)* Anda dapat mengisi API Key default di file `.env` atau mengaturnya langsung nanti melalui menu **Pengaturan AI** di browser.

5. **Inisialisasi Database & Data Agen:**
   ```bash
   python seed.py
   ```

6. **Jalankan Server Backend FastAPI:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   Backend aktif di: `http://localhost:8000` (Dokumentasi API Swagger: `http://localhost:8000/docs`).

---

### Langkah 3: Setup & Jalankan Frontend (Next.js)

1. **Buka terminal baru, masuk ke direktori frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependensi Node:**
   ```bash
   npm install
   ```

3. **Jalankan server development Next.js:**
   ```bash
   npm run dev
   ```
   Frontend aktif di: `http://localhost:3000`.

---

## ⚙️ Konfigurasi Provider AI

Setelah aplikasi terbuka di `http://localhost:3000`:
1. Klik menu **Pengaturan AI** (atau navigasi langsung ke `http://localhost:3000/settings`).
2. Pilih provider yang ingin Anda gunakan (tersedia preset **Custom OpenAI-Compatible**, **OCTA Telkomsel**, **Google Gemini**, **Groq**, dan **OpenRouter**).
3. Masukkan **Base URL** dan **API Key / Token** Anda.
4. Klik tombol **"🔍 Tes Koneksi & Deteksi Model"**.
5. Klik **"⚡ Pakai N Model yang Terdeteksi"**, pilih model default, lalu klik **"Simpan Perubahan"** dan **"Jadikan Provider Aktif"**.
6. Semua agen AI sekarang siap menerima instruksi dan mengeksekusi tugas secara instan!

---

## 📁 Struktur Direktori

```text
solusi-macro-vhq/
├── backend/
│   ├── .env.example              # Template variabel lingkungan
│   ├── ai_service.py             # Multi-provider routing, dynamic models, prompts
│   ├── database.py               # Koneksi database SQLAlchemy
│   ├── excel_vba_service.py      # Parser file, builder Excel .xlsx, ekstrak .bas VBA
│   ├── main.py                   # REST API endpoints FastAPI
│   ├── models.py                 # Skema tabel database (Agent, Task, Project, AIProviderConfig)
│   ├── requirements.txt          # Daftar paket dependensi Python
│   ├── seed.py                   # Inisialisasi awal daftar 8 agen AI
│   └── social_service.py         # Logika generator & kalender media sosial
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx            # Root layout Next.js
│   │   ├── page.tsx              # Halaman beranda utama
│   │   ├── home-client.tsx       # State manajemen beranda & delegasi agen
│   │   ├── settings/page.tsx     # Hub Pengaturan Provider & Endpoint AI
│   │   └── social/page.tsx       # Studio Konten & Kalender Media Sosial
│   ├── components/
│   │   ├── vhq-shell.tsx         # Navbar, navigasi, dan indikator status AI
│   │   ├── virtual-office-3d.tsx # Engine 3D Pixar Studio Diorama (Three.js)
│   │   └── markdown-deliverable.tsx # Renderer markdown output agen
│   └── package.json              # Skrip & dependensi npm
│
├── .gitignore                    # Proteksi berkas sensitif, db, dan venv
└── README.md                     # Dokumentasi panduan proyek
```
---

## 📜 Lisensi & Kontributor
Dikembangkan secara eksklusif untuk **Solusi Macro Virtual HQ**.
*Hak Cipta © 2026 Solusi Macro. All rights reserved.*
