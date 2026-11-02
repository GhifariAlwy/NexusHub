# 🌐 NexusHub Lite: Data Exchange Platform (SPLP-Like Architecture)

> **Platform Interoperabilitas & Pertukaran Data Nasional Terpadu untuk 1 Laptop**  
> Mengintegrasikan pertukaran data **Sinkronus** (REST API) dan **Asinkronus** (Apache Kafka KRaft), enkripsi muatan bisnis **AES-256-GCM**, perutean **Fan-Out 1:N** via **MES Engine**, katalog layanan terpadu, serta **Unified Observability** & **Kalkulator Capacity Planning** berbasis ClickHouse OLAP.

---

## 📋 Daftar Isi
1. [Arsitektur & Konsep Utama](#-arsitektur--konsep-utama)
2. [Alokasi Memori 1 Laptop (< 2.6 GB RAM)](#-alokasi-memori-1-laptop--26-gb-ram)
3. [Daftar Port Layanan](#-daftar-port-layanan)
4. [Akun Pengguna & Peran RBAC Bawaan](#-akun-pengguna--peran-rbac-bawaan)
5. [Panduan Menjalankan dari Nol (Quick Start)](#-panduan-menjalankan-dari-nol-quick-start)
6. [Fitur & Alur Kerja Utama](#-fitur--alur-kerja-utama)
7. [Simulasi Beban & Capacity Planning](#-simulasi-beban--capacity-planning)
8. [Profil Opsional (WSO2 & Security)](#-profil-opsional-wso2--security)
9. [SonarQube: SAST & Code Quality (Profil Opsional)](#sonarqube-sast--code-quality-profil-opsional)

---

## 🏛 Arsitektur & Konsep Utama

NexusHub Lite mengimplementasikan pola arsitektur SPLP modern:

```
[Aplikasi Bisnis Tenant]
       │
       ▼ (gRPC / HTTP Lokal)
[Client SDK (@nexushub/client-sdk)]
       │
       ▼
[Client Agent (:5050)] ──(AES-256-GCM SEAL)──► [Apache Kafka (ingress.{tenant})]
                                                        │
                                                        ▼
                                               [MES Routing Engine]
                                               ├── 1. Baca Cache (DragonFly)
                                               ├── 2. Fallback DB (PostgreSQL)
                                               ├── 3. Fan-out ke inbox.{targets}
                                               ├── 4. Kirim Audit (ClickHouse)
                                               └── 5. Error ➔ dlq.global
                                                        │
                                                        ▼
                                               [Client Agent Penerima]
                                               └── Dekripsi AES ➔ Aplikasi Bisnis
```

- **Client SDK (`packages/client-sdk`)**: Pustaka tipis untuk aplikasi klien, menghasilkan *Canonical Message Envelope* dengan standar W3C `traceparent`.
- **Client Agent (`apps/client-agent`)**: Runtime lokal tenant yang menangani enkripsi muatan data bisnis sebelum dikirim ke broker (sehingga payload tetap *opaque* bagi perantara), memproses inbox masuk, dan mengalihkan kegagalan ke DLQ.
- **MES Engine (`apps/mes-engine`)**: Mesin perutean stateless yang mengonsumsi pesan `ingress.*`, memeriksa rute di cache memori DragonFly, mendistribusikan pesan ke banyak inbox (Fan-Out 1:N), dan mencatat log audit.
- **Portal Backend (`apps/portal-backend`)**: Internal API Gateway dengan rate limiter DragonFly, autentikasi JWT, 4 modul microservices, dan kalkulator estimasi kapasitas.
- **Portal Frontend (`apps/portal-frontend`)**: Single Page Application (React + Vite + Tailwind CSS) dengan Role Switcher, etalase katalog, approval workflow otomatis, dan live dashboard.

---

## ⚡ Alokasi Memori 1 Laptop (< 2.6 GB RAM)

Didesain khusus agar seluruh ekosistem dapat dijalankan di 1 laptop pengembang tanpa memberatkan sistem:

| Komponen | Container / Proses | Alokasi RAM Maks. | Deskripsi |
|---|---|---|---|
| **PostgreSQL 16** | `nexushub-postgres` | ~128 MB | Database Source of Truth (`portal_db`), shared buffer 64MB |
| **DragonFly** | `nexushub-dragonfly` | ~256 MB | In-Memory Routing Table berkecepatan mikrodetik |
| **Kafka KRaft** | `nexushub-kafka` | ~512 MB | Apache Kafka KRaft mode (tanpa Zookeeper) |
| **Kafka UI** | `nexushub-kafka-ui` | ~180 MB | Web explorer topik, partition, dan consumer groups |
| **ClickHouse Server** | `nexushub-clickhouse` | ~768 MB | Database analitik OLAP untuk Audit Log & Metrik Kapasitas |
| **Grafana Alloy** | `nexushub-alloy` | ~120 MB | Unified OTel Collector |
| **Grafana OSS** | `nexushub-grafana` | ~150 MB | Visualisasi Single Pane of Glass |
| **Node.js Services** | Agent, MES, Portal | ~380 MB | Total memori aplikasi JavaScript/TypeScript |
| **TOTAL** | | **≈ 2.5 GB RAM** | Sangat ringan untuk laptop dengan RAM 8GB / 16GB / 32GB |

---

## 🔌 Daftar Port Layanan

| Service | Port | Tautan Akses | Keterangan |
|---|---|---|---|
| **Portal Frontend** | `5173` | [http://localhost:5173](http://localhost:5173) | Single Page Application (React) |
| **Portal Backend API** | `4000` | [http://localhost:4000](http://localhost:4000) | REST API & Internal Gateway |
| **Client Agent API** | `5050` | [http://localhost:5050](http://localhost:5050) | Endpoint lokal SDK tenant |
| **Kafka UI** | `8080` | [http://localhost:8080](http://localhost:8080) | Web console Apache Kafka |
| **Grafana Dashboard** | `3000` | [http://localhost:3000](http://localhost:3000) | Single Pane of Glass (User/Pass: `admin`/`admin`) |
| **ClickHouse HTTP** | `8123` | [http://localhost:8123](http://localhost:8123) | Endpoint kueri analitik OLAP |
| **ClickHouse Native TCP** | `9001` | `localhost:9001` | Digeser dari 9000 ke 9001 agar port host 9000 bebas untuk UI SonarQube (internal antar-container tetap 9000) |
| **DragonFly Cache** | `6379` | `localhost:6379` | In-memory Redis-compatible routing table |
| **PostgreSQL** | `5432` | `localhost:5432` | Database portal (`portal_db`) |
| **Apache Kafka Broker** | `9092` | `localhost:9092` | Message broker KRaft mode |

---

## 👥 Akun Pengguna & Peran RBAC Bawaan

Semua akun menggunakan kata sandi bawaan: **`admin123`**

| Username | Peran (RBAC) | Organisasi (Tenant) | Hak Akses Utama |
|---|---|---|---|
| **`superadmin`** | `SUPER_ADMIN` | Platform Pusat (Pemerintah/Operator) | Approval Workflow, provisioning Kafka & DragonFly, manajemen DLQ global, konfigurasi kapasitas. |
| **`tenantadmin_ecom`** | `TENANT_ADMIN` | `ecommerce-corp` | Mengelola pengguna tenant & mendaftarkan katalog layanan. |
| **`publisher_ecom`** | `PUBLISHER` | `ecommerce-corp` | Mendaftarkan event `order.created` dan API ke katalog nasional. |
| **`subscriber_logistics`**| `SUBSCRIBER` | `logistics-express` | Berlangganan event `order.created`, menerima inbox, dan mempublikasikan API cek resi. |
| **`subscriber_fintech`** | `SUBSCRIBER` | `fintech-pay` | Menerima event fan-out `order.created` untuk otomatisasi pencairan dana. |

*(Anda dapat berpindah peran secara instan menggunakan tombol **Role Switcher** di pojok kanan atas Portal Frontend).*

---

## 🚀 Panduan Menjalankan dari Nol (Quick Start)

### Prasyarat
- **Docker Desktop** (atau Docker Engine v24+)
- **Node.js** (v20+ atau v24+)
- **npm** (v10+)

### Langkah 1: Jalankan Infrastruktur Docker
Buka terminal dan jalankan:
```bash
docker compose up -d
```
Pastikan seluruh 7 container berjalan (`docker compose ps`):
- `nexushub-postgres`
- `nexushub-dragonfly`
- `nexushub-kafka`
- `nexushub-clickhouse`
- `nexushub-alloy`
- `nexushub-grafana`
- `nexushub-kafka-ui`

### Langkah 2: Instal Dependensi Monorepo
```bash
npm install
```

### Langkah 3: Build Pustaka Client SDK
```bash
npm --workspace=@nexushub/client-sdk run build
```

### Langkah 4: Jalankan Komponen Layanan
Buka beberapa tab terminal (atau jalankan di background):

**Terminal 1 (MES Routing Engine):**
```bash
npm run dev:mes
```

**Terminal 2 (Client Agent):**
```bash
npm run dev:agent
```

**Terminal 3 (Portal Backend):**
```bash
npm run dev:backend
```

**Terminal 4 (Portal Frontend):**
```bash
npm run dev:frontend
```

Sekarang Anda dapat membuka Portal Manajemen di browser Anda:  
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🎯 Simulasi Beban & Capacity Planning

Untuk mengisi database ClickHouse dengan data transaksi nyata (REST sinkron, Event asinkron, lonjakan burst, dan DLQ error), jalankan:

```bash
npm run simulate
```

Skrip ini akan menembakkan:
1. **20 Event Terenkripsi (`SEAL_SIMULATED`)**: Diverifikasi dan didekripsi end-to-end.
2. **30 Request REST API**: Dicatat ke ClickHouse dengan latensi terdistribusi.
3. **50 Pesan Burst**: Menghasilkan lonjakan throughput instan (*Peak MPS*).
4. **6 Skenario Error DLQ**: Menguji penanganan pesan gagal ke topik `dlq.global` dan tabel `dlq_records`.

Setelah simulasi berjalan, buka menu **Kalkulator Kapasitas** di portal untuk melihat:
- Proyeksi kebutuhan SSD Hot Storage (30 hari & 1 tahun).
- Proyeksi kebutuhan S3 Cold Storage (5 tahun).
- Rekomendasi otomatis jumlah partisi Kafka dan replika pod MES Engine.
- Simulasi penggeser skala beban (*What-If Scale Slider 1x hingga 50x*).

---

## 🛡 Profil Opsional (WSO2 & Security)

Untuk pengujian lanjutan di mesin dengan spesifikasi RAM lebih tinggi:

### Profil WSO2 (WSO2 Identity Server & WSO2 API Manager)
```bash
docker compose -f docker-compose.yml -f docker-compose.wso2.yml --profile wso2 up -d
```
- WSO2 IS Admin: `https://localhost:9443/carbon`
- WSO2 APIM Publisher/DevPortal: `https://localhost:9444/publisher`

### Profil Keamanan (BunkerWeb WAF & Falco IDS)
```bash
docker compose -f docker-compose.yml -f docker-compose.security.yml --profile security up -d
```
- BunkerWeb WAF melindungi port `80` dan `443` dengan aturan OWASP CRS.
- Falco memantau integritas kontainer secara real-time.

---

## 🧪 SonarQube: SAST & Code Quality (Profil Opsional)

Analisis statik (SAST) & kualitas kode monorepo TypeScript menggunakan **SonarQube Community Edition** yang berbagi instance **PostgreSQL yang sudah ada** (`nexushub-postgres`) — tanpa instance database baru, tanpa instalasi Java/SDK di laptop host. Stack ini **tidak ikut berjalan** dengan `docker compose up -d` biasa (hemat RAM), dan hanya aktif saat diminta (limit memori 2GB).

### a. Menyalakan & Mematikan SonarQube

```bash
# Nyalakan (idempotent): membuat DB 'sonar' + user 'sonar' di PostgreSQL yang ada,
# lalu start container UI
npm run sonar:up

# Pantau proses boot pertama (±2–3 menit; log CE/Web/ES akan stabil)
docker logs -f nexushub-sonarqube

# Matikan SonarQube tanpa menyentuh service lain (service utama tetap jalan)
npm run sonar:down
```

> Catatan: host port `9000` milik UI SonarQube; native TCP ClickHouse digeser ke host port `9001`. Komunikasi internal antar-container tidak berubah, jadi Grafana/Alloy tetap berfungsi.

### b. Membuat Project Token Pertama Kali

1. Buka [http://localhost:9000](http://localhost:9000) — login pertama: `admin` / `admin`, lalu ganti password.
2. Saat wizard **"How do you want to create your project"** muncul, pilih **Manually**, isi:
   - **Project display name:** `NexusHub Lite`
   - **Project key:** `nexushub-lite`
3. Di wizard **"Set up project for Clean as You Code"**: pilih **Use a global setting**, lalu **Locally** → buat token dengan nama misal `nexushub-lite-local`, klik **Generate**, dan salin token (`sqa_...` / `sqp_...`).
4. Analisis kode di mesin lokal memakai **token user (bu_...)**; token project (sqp_...) sebaiknya disimpan untuk CI. Persistensi token opsional — sesi terminal saja sudah cukup:

```bash
export SONAR_TOKEN="isi_token_anda"
```

> Jika wizard sudah terlewat, buat token via menu: **Account (avatar) → My Account → Security → Generate Tokens** (type: *User Token*), atau **Project Settings → Project Analysis Token**.

### c. Menjalankan Scanning

```bash
npm run sonar
```

Script ini:
- Menjalankan `sonarsource/sonar-scanner-cli` sebagai kontainer Docker (tanpa Java di host).
- Debug bergabung ke network compose yang sama dengan SonarQube & PostgreSQL.
- Scoping otomatis sesuai `sonar-project.properties`: 5 module workspace (`apps/portal-backend`, `apps/portal-frontend`, `apps/client-agent`, `apps/mes-engine`, `packages/client-sdk`), dengan exclusions `**/node_modules/**`, `**/dist/**`, `**/build/**`, artefak bundler (`vite/webpack/rollup/esbuild.config`), serta pengenalan tsconfig (portal-frontend & client-sdk).

Jika berhasil, output scanner diakhiri dengan `EXECUTION SUCCESS` + link halaman hasil di UI SonarQube.

### d. Membaca Laporan: Quality Gate, Vulnerabilities, & Security Hotspots

Setelah scan, buka dashboard project `nexushub-lite` di [http://localhost:9000](http://localhost:9000):

| Panel | URL Halaman | Arti |
|---|---|---|
| **Quality Gate** | halaman utama project (badge kanan atas) | `Passed` ✅ = lolos kondisi default (mis. Heredity Coverage/API density, Reliability Rating ≤ A, Security Rating ≤ A, Duplicated Lines ≤ 3%, Maintainability ≤ A). `Failed` ❌ = salah satu kondisi gagal. Cek detail di tab **Conditions** untuk melihat metrik mana yang merah. |
| **Vulnerabilities** | **Issues** → filter *Type: Vulnerability* | Bug/lemah keamanan yang **terkonfirmasi** (mis. injeksi, XSS, crypto lemah) di kode — wajib diperbaiki; masing-masing menurunkan *Security Rating* & menambah **Security Hotspot Review/Building Issues** di gate. |
| **Security Hotspots** | **Security Hotspots** (menu kiri) | Titik kode **potensial** berisiko yang butuh **review manusia**: mark **Review — Safe** apabila aman, atau **Resolve — Fix this issue** bila benar perlu perbaikan. Hotspot yang menunggu review muncul di kolom **Security Hotspots Reviewed = 0%** pada gate (*Security*). |

> ⚙️ Diagnosis bila scanner gagal / datasource error: cek `docker logs nexushub-sonarqube` (khususnya log `web` & `ce`) dan pastikan `docker exec nexushub-postgres psql -U postgres -c '\l sonar'` menampilkan database `sonar` dengan owner `sonar` (buat ulang via `npm run sonar:db:init` bila terhapus).

---

## 🚀 GitHub Actions CI/CD Pipeline

Proyek ini telah dilengkapi dengan pipeline DevSecOps CI/CD terotomasi di [.github/workflows/ci-cd.yml](file:///Users/mac/local-integration-hub/.github/workflows/ci-cd.yml):

```text
[Push / Pull Request]
        │
        ├─── 1. Build & Typecheck (Semua workspace: SDK, Backend, Frontend, MES, Agent)
        ├─── 2. Security Gate (GitLeaks Secret Scanner & Trivy SCA Vulnerability Scan)
        ├─── 3. Ephemeral Integration Smoke Test (Postgres, Kafka, DragonFly, ClickHouse)
        └─── 4. Build & Push Docker Images ke GitHub Container Registry (ghcr.io)
```

### Cara Menghubungkan ke GitHub:
1. Pastikan remote git sudah mengarah ke repositori GitHub Anda:
   ```bash
   git remote add origin https://github.com/<USERNAME>/nexushub-lite.git
   ```
2. Commit dan push kode:
   ```bash
   git add .
   git commit -m "feat: complete devsecops ci-cd with github actions"
   git push -u origin main
   ```
3. Buka tab **Actions** di repositori GitHub Anda untuk memantau proses build, scanning keamanan, dan penerbitan image secara real-time.

---

## 📄 Lisensi
Apache License 2.0 - NexusHub Open Interoperability Architecture.

