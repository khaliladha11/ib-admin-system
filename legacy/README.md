# Arsip Versi Skripsi (V3.1)

> **Pengembangan Sistem Informasi Permintaan Inseminasi Buatan (IB) Berbasis Web
> Guna Mendukung Koordinasi Stakeholder**

- **Penulis:** Muhammad Khalil Adha
- **Program studi:** Ilmu Komputer, IPB University — lulus November 2025
- **Pembimbing:** Lailan Sahrina Hasibuan
- **Tag git:** `v3.1-skripsi`
- **Abstrak & naskah:** [`docs/skripsi/README.md`](../docs/skripsi/README.md)

Folder ini adalah arsip kode persis seperti saat skripsi. Isinya hanya menjadi
referensi logika bisnis untuk rebuild: **jangan diubah dan jangan diimpor** oleh
kode baru.

## Isi folder

| Folder      | Isi                              |
| ----------- | -------------------------------- |
| `backend/`  | API Express + PostgreSQL         |
| `frontend/` | Aplikasi web React + Vite        |

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

## Cara menjalankan secara lokal

Prasyarat: Node.js 18+ dan PostgreSQL yang berjalan di `localhost:5432`.

### 1. Database

Koneksi ditulis langsung di `backend/config/db.js`
(user `postgres`, password `postgres`, database `postgres`, port `5432`).
Sesuaikan PostgreSQL lokal dengan nilai tersebut.

Skema tabel **tidak disertakan** di repo. Backend memakai tabel `users`,
`requests`, `checkups`, dan `activity_logs`; kolomnya dapat dilihat dari kueri
di `backend/controllers/`.

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

Akun dibuat lewat endpoint `POST /api/register` atau langsung di tabel `users`.
