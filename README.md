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

### 1. 🎮 3D Modern Dark Executive Virtual Office
* **Visualisasi Kantor 3D Cozy & Modern Dark Executive**: Ruang kerja bernuansa gelap elegan dengan partisi kaca beraksen neon *cyan*, lampu lantai sudut *warm glow*, pod meja kerja simetris, area executive lounge, sofa kulit gelap, tanaman, dan latar jendela kota malam.
* **Realistic Humanoid 3D Avatars & Auto-Spawn Meja**: Setiap agen memiliki proporsi manusia realistis lengkap dengan detail wajah, pakaian korporat, kacamata, dan *headset*. Penambahan role baru di `/agents` otomatis memunculkan meja, kursi, dan avatar baru di kantor 3D.
* **Kocheng Oren Kantor, Jokes per Role, Stretching & Istirahat Pantry**: Kocheng Oren CMO berjalan keliling kantor (bisa diklik!), bubble celotehan *relate* per masing-masing role, mode **☕ Stretching** (keluar meja dengan 4 gerakan pemanasan), serta toggle **🍱 Istirahat Pantry** (karyawan ngopi di pantry, makan siang, rebahan di sofa, ngobrol, hingga scroll HP).
* **Compact HUD, Dual Camera & Toggle Label Kepala**: Bar kontrol 1 baris yang ringkas, sudut pandang **2.5D / 3D Orbit**, serta toggle label kepala (**Nama**, **Role**, **Semua**, atau **Hide**).

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

### 4. 📊 Multi-Format Auto-Artifact Builder (`.xlsx` Pro, `.bas`, `.docx`, `.pdf`, Script & `.zip`)
* **Excel Workbook Pro (`.xlsx`)**: Mendukung banner `title`/`subtitle`, strip `kpi_cards`, format kolom (`currency`, `percent`, `date`, `number`), *zebra striping*, *freeze panes*, *auto-filter*, *dropdown data validation*, *conditional formatting*, serta grafik (`BarChart`, `LineChart`, `PieChart`).
* **Modul Macro VBA (`.bas`) & Script/Data**: Otomatis mengekstrak kode VBA (`.bas`), Python (`.py`), Google Apps Script (`.gs`), SQL (`.sql`), CSV (`.csv`), HTML (`.html`), dan JSON (`.json`) bila diminta.
* **Dokumen Resmi (`.docx` & `.pdf`) & Paket `.zip`**: Mengonversi laporan, SOP, dan proposal menjadi dokumen Word (`.docx`) dan PDF (`.pdf`) siap unduh, serta membundel multi-file menjadi `.zip`.
* **Kartu Artifact Interaktif (`ArtifactCards`)**: Ditampilkan di `/ai-chat` dan `/tasks` lengkap dengan badge tipe file, ukuran KB, tombol unduh individual, dan **Unduh Semua (.ZIP)** — hanya terpicu saat Anda meminta pembuatan file/dokumen atau saat eksekusi task proyek.

### 5. ⚡ AI Provider & Endpoint Hub (`/settings`) & Per-Agent Routing
* **Multi-Provider Realtime Switching & CRUD**: Tambah, edit, aktifkan, atau hapus provider AI (Custom OpenAI-Compatible, **9Router**, OCTA Telkomsel, Google Gemini Direct, Groq, OpenRouter, atau Ollama Lokal) langsung dari dashboard web tanpa restart server.
* **Per-Agent Model & Endpoint Routing**: Setiap agen AI dapat diarahkan menggunakan endpoint provider dan model spesifik sesuai kebutuhan tugasnya melalui menu **Kelola Tim (`/agents`)**.
* **Live Connection Test & Auto-Discovery Models**: Uji keaktifan endpoint beserta latensi (ms) dan pindai daftar model yang didukung (`/models`) secara otomatis dalam 1 klik.

### 6. 💬 Direct Agent Room (`/ai-chat`) & Code UX
* **Ruang Diskusi Langsung & Persona Dinamis**: Chat interaktif dengan AI CEO maupun spesialis lain dengan identitas perusahaan mengikuti pengaturan **Branding Kantor (`/settings`)**.
* **Sticky Header, Compact Composer & Guard Output**: Header dan bar input tetap diam saat bubble chat di-scroll, dilengkapi unggah lampiran, optimasi efisiensi token riwayat, serta pembersih otomatis kebocoran *reasoning/thinking* dari model LLM.
* **Claude-Style Pasted Code Chips**: Menempelkan kode atau teks panjang di kolom chat maupun modal tugas otomatis diringkas menjadi kartu lampiran (`CODE` / `PASTED`) dengan modal pratinjau penuh agar kotak input tetap rapi.
* **Interactive Code Block (Salin & Lipat)**: Setiap blok kode di hasil tugas (`/tasks`) dan chat (`/ai-chat`) dilengkapi header bahasa, tombol **Salin kode** (menyalin seluruh isi blok), serta tombol **Sembunyikan / Tampilkan** untuk melipat kode panjang.

### 7. 👥 Kelola Tim & Kustomisasi Agen (`/agents`)
* **Team Directory Modern**: Tampilan kartu grid dengan pencarian, filter departemen, ringkasan cakupan kapabilitas yang dapat dilipat, tombol chat langsung, serta modal tambah/edit agen lengkap dengan routing provider & model AI per agen.

### 8. 📡 Omnichannel Social Hub (`/social-hub`)
* **Workspace Konten & Setup API Terpisah**: Pemisahan area operasional konten/kalender dari konfigurasi API platform sosial media agar tampilan lebih bersih dan fokus.
* **Multi-Platform Growth Studio**: Perencanaan dan pembuatan konten lintas platform (Facebook Page, Instagram Feeds/Reels, YouTube Shorts, TikTok, dan Threads) lengkap dengan kalender jadwal.

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
* **Excel, Dokumen & Macro Engine**:
  * `openpyxl`: Pembuatan workbook Excel, chart, validasi data, dan conditional formatting.
  * `oletools`: Inspeksi dan ekstraksi kode Macro VBA dari format OLE / `.xlsm`.
  * `python-docx` & `reportlab`: Generasi dokumen Word (`.docx`) dan PDF (`.pdf`) siap unduh.
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

## 🌐 Panduan Deploy di VPS (Production)

Jika Anda ingin menjalankan Virtual HQ di VPS (Ubuntu/Debian) agar bisa diakses 24/7 dari browser maupun dihubungkan ke agen eksternal:

1. **Clone & Install Dependensi:**
   Ikuti Langkah 1–3 di atas pada VPS Anda, lalu build frontend untuk production:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Wajib Atur Autentikasi di `backend/.env`:**
   ```env
   VHQ_FOUNDER_USERNAME=founder
   VHQ_FOUNDER_PASSWORD=ganti-password-minimal-10-karakter
   VHQ_AUTH_SECRET=ganti-secret-acak-minimal-10-karakter
   # Set true jika sudah memakai HTTPS (Nginx/Caddy/Cloudflare)
   VHQ_COOKIE_SECURE=true
   ```

3. **Jalankan Backend & Frontend sebagai Service (`systemd`):**
   * `/etc/systemd/system/vhq-backend.service`:
     ```ini
     [Unit]
     Description=Solusi Macro VHQ Backend (FastAPI)
     After=network.target

     [Service]
     User=root
     WorkingDirectory=/root/sm-vo-ai/backend
     ExecStart=/root/sm-vo-ai/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
     Restart=always

     [Install]
     WantedBy=multi-user.target
     ```
   * `/etc/systemd/system/vhq-frontend.service`:
     ```ini
     [Unit]
     Description=Solusi Macro VHQ Frontend (Next.js)
     After=network.target vhq-backend.service

     [Service]
     User=root
     WorkingDirectory=/root/sm-vo-ai/frontend
     Environment=VHQ_API_URL=http://127.0.0.1:8000
     ExecStart=/usr/bin/npm run start -- --port 3000
     Restart=always

     [Install]
     WantedBy=multi-user.target
     ```
   * Aktifkan keduanya:
     ```bash
     sudo systemctl daemon-reload
     sudo systemctl enable --now vhq-backend vhq-frontend
     ```

4. **Reverse Proxy (Cukup Buka Port `3000`):**
   Next.js sudah otomatis mem-proxy rute `/api/backend/*` ke `http://127.0.0.1:8000`. Anda cukup mengarahkan domain HTTPS Anda ke port `3000` (tanpa perlu membuka port `8000` ke publik dan bebas masalah CORS). Contoh **Caddy**:
   ```caddyfile
   vhq.domainanda.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```

---

## 🤖 Integrasi dengan Hermes Agent (Telegram & VPS)

Jika Anda sudah menjalankan **Hermes Agent** di VPS yang terhubung ke **Telegram**, Anda dapat menggabungkannya dengan Virtual HQ dalam dua skenario:

### Opsi A: Kontrol VHQ dari Telegram via Hermes (Remote Control)
Karena Hermes dan VHQ berada di VPS yang sama, Hermes dapat memanggil REST API VHQ secara lokal di `http://127.0.0.1:8000` (misalnya melalui tool shell/HTTP atau custom skill Hermes):

1. **Login untuk mendapatkan cookie sesi (`vhq_session`):**
   ```bash
   curl -s -c /tmp/vhq_cookies.txt -X POST http://127.0.0.1:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"founder","password":"PASSWORD_ANDA"}'
   ```
2. **Kirim tugas baru ke agen VHQ (mis. dari instruksi Telegram Anda):**
   ```bash
   curl -s -b /tmp/vhq_cookies.txt -X POST http://127.0.0.1:8000/tasks \
     -H "Content-Type: application/json" \
     -d '{"title":"Rekap Penjualan Q4","description":"Buat workbook Excel + grafik","priority":"High","assigned_agent_id":2}'
   ```
3. **Pantau status/hasil tugas atau chat langsung ke agen:**
   ```bash
   # Cek daftar task & hasil
   curl -s -b /tmp/vhq_cookies.txt http://127.0.0.1:8000/tasks

   # Chat langsung dengan agen
   curl -s -b /tmp/vhq_cookies.txt -X POST http://127.0.0.1:8000/ai/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"Ringkas progres proyek hari ini","session_id":"telegram-hermes"}'
   ```

### Opsi B: Gunakan Endpoint Hermes sebagai Provider AI di VHQ
Jika Hermes di VPS Anda mengekspos API **OpenAI-compatible** (`/v1`), buka menu **Pengaturan AI (`/settings`)** di VHQ, tambahkan provider baru bertipe OpenAI-compatible, lalu arahkan **Base URL** ke endpoint lokal Hermes Anda.

---

## ⚙️ Konfigurasi Provider AI & Routing Agen

Setelah aplikasi terbuka di `http://localhost:3000`:
1. Klik menu **Pengaturan AI** (atau navigasi ke `http://localhost:3000/settings`).
2. Pilih preset atau tambahkan provider baru (**Custom OpenAI-Compatible**, **9Router**, **OCTA Telkomsel**, **Google Gemini**, **Groq**, **OpenRouter**, atau **Ollama**). Anda juga dapat menghapus provider kustom yang sudah tidak dipakai.
3. Masukkan **Base URL** dan **API Key / Token** Anda, lalu klik **"🔍 Tes Koneksi & Deteksi Model"**.
4. Pilih model default, klik **"Simpan Perubahan"**, dan aktifkan provider utama.
5. *(Opsional)* Buka menu **Kelola Tim** (`/agents`) untuk mengkustomisasi profil agen serta mengarahkan setiap agen ke provider & model AI tertentu secara terpisah.

---

## 🎨 White-label Workspace

Setiap instalasi menggunakan satu identitas workspace. Setelah login, buka
**Pengaturan AI & Brand** → **Brand & White-label** untuk mengatur nama,
logo, tagline, dan warna utama. Pengaturan diterapkan pada halaman login,
navigasi, judul browser, favicon, tema aksen, kantor 3D, prompt AI, serta
branding file hasil yang dibuat aplikasi.

Unggah logo milik Anda dan simpan perubahan branding dari halaman tersebut.
Setiap pelanggan white-label sebaiknya menggunakan instalasi dan database
workspace terpisah.

---

## 📁 Struktur Direktori

```text
solusi-macro-vhq/
├── backend/
│   ├── .env.example              # Template variabel lingkungan
│   ├── ai_service.py             # Multi-provider routing, per-agent model, prompts
│   ├── auth.py                   # Autentikasi & manajemen sesi
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
│   │   ├── agents/page.tsx       # Kelola Tim, Profil & Routing Model per Agen
│   │   ├── ai-chat/page.tsx      # Direct Agent Room (Chat Langsung dengan Agen)
│   │   ├── projects/page.tsx     # Manajemen Proyek
│   │   ├── settings/page.tsx     # Hub Pengaturan Provider & Endpoint AI
│   │   ├── social-hub/           # Omnichannel Social Hub & Setup API
│   │   ├── task-planner/page.tsx # Perencanaan & Breakdown Tugas
│   │   ├── tasks/page.tsx        # Task Board & Deliverables
│   │   └── virtual-office/page.tsx # Ruang Kantor Virtual 3D
│   ├── components/
│   │   ├── artifact-cards.tsx    # Kartu unduhan artifact interaktif (.xlsx/.docx/.pdf/.zip)
│   │   ├── auth-guard.tsx        # Proteksi rute autentikasi
│   │   ├── branding-runtime.tsx  # Sinkronisasi tema & white-label workspace
│   │   ├── code-block.tsx        # Blok kode dengan tombol salin & collapse
│   │   ├── pasted-blocks.tsx     # Kartu lampiran paste kode/teks ala Claude
│   │   ├── vhq-shell.tsx         # Sidebar, navigasi, dan indikator status AI
│   │   ├── virtual-office-3d.tsx # Engine 3D Pixar Studio Diorama dinamis (Three.js)
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
