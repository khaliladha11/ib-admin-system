# Arsip Versi Skripsi (V3.1)

> **Pengembangan Sistem Informasi Permintaan Inseminasi Buatan (IB) Berbasis Web
> Guna Mendukung Koordinasi Stakeholder**

- **Penulis:** Muhammad Khalil Adha
- **Program studi:** Ilmu Komputer, IPB University — lulus November 2025
- **Pembimbing:** Lailan Sahrina Hasibuan
- **Tag git:** `v3.1-legacy`
- **Abstrak & naskah:** [`docs/skripsi/README.md`](../docs/skripsi/README.md)

Folder ini adalah arsip kode seperti saat skripsi (kode persisnya ada di tag
`v3.1-legacy`). Satu-satunya perubahan sesudahnya adalah konfigurasi koneksi
database lewat environment variable agar bisa dijalankan dengan Docker; lihat
[Catatan perubahan untuk Docker](#catatan-perubahan-untuk-docker). Isinya hanya
menjadi referensi logika bisnis untuk rebuild: **jangan diubah dan jangan
diimpor** oleh kode baru.

## Isi folder

| Path | Isi |
| --- | --- |
| `backend/` | API Express + PostgreSQL |
| `frontend/` | Aplikasi web React + Vite |
| `docker-compose.yml` | Menjalankan database, backend, dan frontend sekaligus |
| `seed/seed.sql` | Data contoh fiktif untuk Docker |
| `.env.example` | Variabel opsional untuk Docker |

## Ringkasan fitur

Dua peran pengguna: **admin dinas** (pengelola) dan **petugas inseminator** (lapangan).

- Login dengan peran (JWT, kata sandi di-hash bcrypt).
- Pengajuan permintaan layanan IB.
- Admin memverifikasi atau menolak permintaan, menugaskan dan mengganti petugas.
- Petugas memproses permintaan dan mengirim laporan IB.
- Penugasan dan konfirmasi pemeriksaan lanjutan (checkup): kebuntingan (PKB),
  keguguran, dan kelahiran; laporan kematian ternak.
- Log aktivitas untuk setiap permintaan.
- Pengingat: penanda otomatis untuk laporan yang terlambat, daftar permintaan
  yang belum diproses, dan pengiriman pengingat ke petugas.
- Dasbor terpisah untuk admin dan petugas.

## Teknologi

- **Frontend:** React 19 + Vite, React Router, Axios, SweetAlert2, React Icons
- **Backend:** Node.js, Express 5, jsonwebtoken, bcrypt, dotenv
- **Database:** PostgreSQL (driver `pg`)

## Cara menjalankan dengan Docker (paling mudah)

Prasyarat: Docker dengan Docker Compose.

```bash
cd legacy
docker compose up
```

Tunggu sampai log frontend menampilkan `VITE ... ready`, lalu buka
`http://localhost:5173`. Isinya:

| Service | Isi | Port host |
| --- | --- | --- |
| `db` | PostgreSQL 16, memuat [`docs/legacy/schema.sql`](../docs/legacy/schema.sql) lalu [`seed/seed.sql`](seed/seed.sql) | 5433 |
| `backend` | API Express lama (`node server.js`) | 5000 |
| `frontend` | Web React lama (Vite dev server) | 5173 |

Skema dan data contoh hanya dimuat saat volume database masih kosong. Untuk
mengulang dari awal:

```bash
docker compose down -v
```

Opsional: atur `LEGACY_JWT_SECRET` (lihat [`.env.example`](.env.example)); tanpa itu
dipakai nilai bawaan yang hanya cocok untuk lokal.

### Data contoh (fiktif)

| Peran | Email | Password |
| --- | --- | --- |
| Admin | `admin@ib.test` | `admin123` |
| Petugas | `petugas1@ib.test`, `petugas2@ib.test` | `petugas123` |
| Peternak | `peternak1@ib.test`, `peternak2@ib.test` | `peternak123` |

Akun peternak hanya pemilik permintaan; aplikasi peternak tidak ada di repo ini.

Lima permintaan IB dengan status berbeda:

| # | Status | Yang bisa dilihat |
| --- | --- | --- |
| 1 | Menunggu Verifikasi | Admin bisa verifikasi & tugaskan, atau tolak |
| 2 | Diproses | Laporan IB petugas 4 bulan lalu, hasil belum dilaporkan, sehingga **pengingat 3 bulan** muncul di dasbor admin |
| 3 | Ditolak | Log alasan penolakan |
| 4 | Berhasil | Checkup kebuntingan menunggu penugasan admin |
| 5 | Selesai | Siklus lengkap dengan checkup kebuntingan & kelahiran |

### Catatan perubahan untuk Docker

Kode lama hanya diubah sebatas konfigurasi lewat environment variable:

| File | Perubahan | Alasan |
| --- | --- | --- |
| `backend/config/db.js` | Koneksi membaca `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Bila kosong, nilai bawaannya sama persis dengan aslinya (`postgres@localhost:5432/postgres`) | Backend harus terhubung ke service `db`, bukan `localhost` |

Yang **tidak** diubah:

- **Base URL API frontend** tetap tertulis langsung `http://localhost:5000/api` di setiap halaman. Docker memetakan backend ke port 5000 di host, dan URL itu dipanggil dari browser, jadi tetap berfungsi tanpa perubahan.
- **Import beda huruf besar/kecil** (`./pages/DetailRequestPetugas`, `../components/Navbar`) membuat frontend gagal jalan di Linux (lihat [DOMAIN.md](../docs/legacy/DOMAIN.md), B11). Ini diatasi tanpa mengubah kode: container menyalin source lalu membuat symlink alias **di dalam container saja**.

Kode sumber di-mount read-only dan disalin ke dalam container, jadi `npm ci`
tidak membuat `node_modules` di folder repo.

File baru: `docker-compose.yml`, `seed/seed.sql`, `.env.example`.

## Cara menjalankan secara manual

Prasyarat: Node.js 18+ dan PostgreSQL yang berjalan di `localhost:5432`.
Di Linux, frontend butuh penyesuaian huruf besar/kecil seperti di atas; cara
Docker lebih mudah.

### 1. Database

Koneksi diatur di `backend/config/db.js` lewat `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME` (bawaan: user `postgres`, password `postgres`,
database `postgres`, port `5432`).

Muat skema hasil rekonstruksi dan data contoh:

```bash
psql -U postgres -f docs/legacy/schema.sql
psql -U postgres -f legacy/seed/seed.sql
```

Skema asli tidak pernah disertakan di repo; [`schema.sql`](../docs/legacy/schema.sql)
disusun ulang dari kueri di `backend/controllers/`.

### 2. Backend

```bash
cd legacy/backend
npm install
```

Buat file `legacy/backend/.env`:

```env
PORT=5000
JWT_SECRET=ganti-dengan-teks-acak
```

Jalankan server (entry utama adalah `server.js`, bukan `index.js`; tidak ada
skrip `npm run dev`):

```bash
node server.js
```

Server berjalan di `http://localhost:5000`.

### 3. Frontend

```bash
cd legacy/frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Alamat API ditulis langsung sebagai
`http://localhost:5000/api`, jadi backend harus berjalan di port 5000.

### Akun

Pakai akun dari data contoh di atas, atau buat lewat endpoint
`POST /api/register` atau langsung di tabel `users`.
