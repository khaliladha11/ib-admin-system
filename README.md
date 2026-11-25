# 🐄 IB Admin System

Aplikasi open-source untuk mencatat siklus reproduksi sapi (birahi, IB, PKB,
kelahiran) bagi peternak, inseminator, dan admin kelompok/dinas. Dirancang
**offline-first** dan **mobile-first**: pencatatan tetap bisa dilakukan di HP
tanpa internet, lalu disinkronkan saat terhubung.

Proyek ini adalah **rebuild** dari skripsi *"Pengembangan Sistem Informasi
Permintaan Inseminasi Buatan (IB) Berbasis Web Guna Mendukung Koordinasi
Stakeholder"* (Muhammad Khalil Adha, Ilmu Komputer IPB, 2025). Versi skripsi
diarsipkan di [`legacy/`](legacy/README.md) dan tag git `v3.1-legacy`.

> **Status:** Fase 1, kerangka monorepo. Belum siap dipakai.
> Roadmap: [`docs/PLAN.md`](docs/PLAN.md).

## Menjalankan

Prasyarat: Node.js 22 (lihat `.nvmrc`) dan pnpm 10.

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Buka `http://localhost:5173`. Web memanggil server di `http://localhost:3000`
lewat proxy `/api`. Konfigurasi opsional: salin `.env.example` menjadi `.env`.

Port 5173 juga dipakai versi skripsi di Docker, jadi jangan jalankan keduanya
bersamaan.

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Jalankan web dan server bersamaan |
| `pnpm test` | Unit test (Vitest) di semua paket |
| `pnpm typecheck` | Pemeriksaan tipe TypeScript |
| `pnpm lint` | ESLint + cek format Prettier |
| `pnpm format` | Rapikan format dengan Prettier |
| `pnpm build` | Build produksi web |
| `pnpm db:migrate` | Buat/perbarui database SQLite (`apps/server/data/ib.sqlite`) |
| `pnpm db:seed` | Isi data contoh fiktif (`--reset` untuk mengisi ulang) |
| `pnpm db:generate` | Buat migrasi baru setelah skema diubah |

## Struktur

```
apps/web         Aplikasi web (React + Vite + Tailwind + shadcn/ui)
apps/server      API (Hono)
packages/shared  Tipe dan logika domain yang dipakai web & server
legacy/          Arsip versi skripsi, hanya referensi
docs/            Rencana, prompt kerja, analisis versi lama
```

## Dokumen

- [`docs/PLAN.md`](docs/PLAN.md): roadmap dan model data
- [`docs/PROMPTS.md`](docs/PROMPTS.md): langkah kerja per fase
- [`docs/legacy/DOMAIN.md`](docs/legacy/DOMAIN.md): analisis logika bisnis versi skripsi
- [`legacy/README.md`](legacy/README.md): menjalankan versi skripsi (`cd legacy && docker compose up`)
- [`docs/skripsi/README.md`](docs/skripsi/README.md): abstrak skripsi

## Lisensi

MIT License © 2025 Muhammad Khalil Adha
