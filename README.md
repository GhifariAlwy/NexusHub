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

## 📄 Lisensi
Apache License 2.0 - NexusHub Open Interoperability Architecture.

