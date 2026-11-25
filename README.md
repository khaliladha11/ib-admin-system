# 🐄 IB Admin System

Sistem informasi untuk mencatat siklus reproduksi sapi (birahi, IB, PKB, kelahiran)
bagi peternak, inseminator, dan admin kelompok/dinas.

> **Status:** sedang dibangun ulang (rebuild) sebagai aplikasi open-source,
> offline-first, dan mobile-first. Kode versi skripsi diarsipkan di folder
> [`legacy/`](legacy/README.md).

## 📁 Struktur Folder

```
ib-admin-system/
├── legacy/          # Arsip versi skripsi (V3.1) — hanya referensi, jangan diubah
│   ├── backend/     # API Express + PostgreSQL
│   └── frontend/    # Web React + Vite
├── docs/
│   └── skripsi/     # Abstrak dan tautan naskah skripsi
├── CLAUDE.md
└── README.md
```

## 🎓 Versi Skripsi

Versi ini berasal dari skripsi *"Pengembangan Sistem Informasi Permintaan
Inseminasi Buatan (IB) Berbasis Web Guna Mendukung Koordinasi Stakeholder"*
(Ilmu Komputer IPB, 2025). Kodenya tersimpan di folder `legacy/` dan tag git
`v3.1-legacy`.

- Cara menjalankan versi skripsi: [`legacy/README.md`](legacy/README.md)
- Abstrak dan naskah: [`docs/skripsi/README.md`](docs/skripsi/README.md)

Menjalankan versi skripsi dengan data contoh fiktif:

```bash
cd legacy && docker compose up
```

Lalu buka `http://localhost:5173` dan masuk dengan `admin@ib.test` / `admin123`
atau `petugas1@ib.test` / `petugas123`.

## 📄 Lisensi

MIT License © 2025 Muhammad Khalil Adha
