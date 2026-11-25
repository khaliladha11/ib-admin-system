# IB Admin System — Rebuild

## Konteks
Proyek ini berasal dari skripsi Muhammad Khalil Adha (Ilmu Komputer IPB, 2025):
"Pengembangan Sistem Informasi Permintaan Inseminasi Buatan (IB) Berbasis Web
Guna Mendukung Koordinasi Stakeholder". Versi skripsi diarsipkan di folder
`legacy/` dan tag git `v3.1-skripsi`. Folder `legacy/` hanya referensi logika
bisnis: JANGAN diubah, JANGAN diimpor oleh kode baru. Pengecualian yang sudah
disetujui: konfigurasi lewat environment variable untuk Docker, dicatat di
`legacy/README.md`.

Tujuan rebuild: aplikasi open-source, offline-first, mobile-first untuk
mencatat siklus reproduksi sapi (birahi, IB, PKB, kelahiran) bagi peternak,
inseminator, dan admin kelompok/dinas.

## Dokumen acuan
- `docs/PLAN.md`: roadmap Fase 0–6, model data inti, logika domain, sinkron
- `docs/PROMPTS.md`: prompt per langkah; nomor langkah sama dengan PLAN.md
- `docs/legacy/DOMAIN.md` + `schema.sql`: analisis kode lama (status, endpoint,
  aturan bisnis, daftar masalah S*/B*/I*). Rujuk ID masalahnya saat relevan.

## Status saat ini
- Fase 0 (arsip skripsi) selesai, termasuk 0.3 (`cd legacy && docker compose up`),
  kecuali tag `v3.1-skripsi` yang belum ada di GitHub. Monorepo belum dibuat;
  langkah berikutnya: 1.1 kerangka monorepo.

## Prinsip
1. Offline-first: semua pencatatan harus bisa tanpa internet; sinkron menyusul.
2. Mobile-first: target utama HP Android layar 5,5 inci; PC untuk rekap/admin.
3. Ternak sebagai pusat data: status sapi DIHITUNG dari urutan event, bukan
   disimpan sebagai teks bebas. Pengingat juga dihitung, bukan disimpan sebagai flag.
4. Event tambah-saja: koreksi lewat event baru, tidak menimpa data lama.
5. Mudah dipasang: satu perintah untuk menjalankan server lokal (SQLite).
6. Selaras iSIKHNAS: kode event BH, IB, PKB, KGG, LH, BB.

## Stack
- Monorepo pnpm: `apps/web`, `apps/server`, `packages/shared`
- TypeScript strict di semua paket
- Web: React + Vite, TanStack Router & Query, Tailwind CSS, shadcn/ui,
  ikon lucide-react, PWA via vite-plugin-pwa, data lokal Dexie (IndexedDB)
- Server: Hono (Node), Zod, Drizzle ORM, SQLite (better-sqlite3);
  PostgreSQL opsional lewat env
- Tes: Vitest (unit), Playwright (end-to-end)
- Validasi dan tipe domain didefinisikan SEKALI di `packages/shared`;
  `packages/shared` berisi fungsi murni, tanpa I/O, tidak mengimpor `apps/*`

## Istilah domain
- Peternak (`farmer`), Ternak (`animal`), Event, Permintaan layanan
  (`service_request`), Penugasan (`assignment`), Petugas/inseminator
  (`inseminator`), Admin kelompok (`group_admin`), Admin dinas (`agency_admin`)
- Event: BH = birahi, IB = inseminasi buatan (kode straw, ID pejantan, batch),
  PKB = pemeriksaan kebuntingan (hasil, umur janin bulan), KGG = keguguran
  (trimester 1-3), LH = lahir (jenis kelamin, ID anak), BB = berat badan (kg),
  HEALTH = catatan kesehatan, EXIT = ternak keluar (mati, dijual, dipotong)
- Aturan pengingat dari skripsi: hasil IB belum dilaporkan > 3 bulan,
  kelahiran/keguguran belum dilaporkan > 9 bulan setelah dinyatakan bunting.
  Patokannya tanggal event sebenarnya, bukan waktu laporan diketik.
- Perkiraan: siklus birahi sekitar 21 hari; kebuntingan sapi sekitar 9-10 bulan
  (simpan sebagai konstanta yang bisa diubah, jangan ditulis tersebar)

## Aturan kerja
- Teks UI: Bahasa Indonesia sederhana. Nama kode, variabel, tabel: Bahasa Inggris.
- Logika domain (state machine, pengingat, statistik) wajib punya unit test.
- Sebelum menyatakan selesai: jalankan `pnpm typecheck`, `pnpm lint`, `pnpm test`
  dan laporkan hasilnya apa adanya.
- Perubahan kecil dan terfokus; jangan mengubah file di luar lingkup tugas.
- Commit dengan format Conventional Commits (feat:, fix:, chore:, docs:, test:).
- Tidak ada rahasia di kode; semua konfigurasi lewat `.env`, sediakan `.env.example`.
- Data contoh (seed) harus fiktif.
- Tanya dulu sebelum menambah dependensi besar atau mengganti bagian stack.
- Komponen UI harus nyaman disentuh (target minimal 44px) dan terbaca di luar ruangan.
- Setelah satu langkah selesai, centang langkahnya di `docs/PROMPTS.md` dan
  perbarui "Status saat ini" di file ini.

## Hindari (pelajaran dari legacy, lihat DOMAIN.md)
- Route tanpa otorisasi di server; cek peran dan cakupan di setiap route (S1–S5).
- Mengandalkan peran di sisi klien saja.
- Menimpa laporan/kolom lama dengan data baru (B4, B7, B8).
- Beberapa penulisan berurutan tanpa transaksi (B10).
- URL atau kredensial ditulis langsung di kode (S6, I5).
- Beda huruf besar/kecil antara nama file dan import: build gagal di Linux (B11).

## Perintah
Belum ada; dibuat di langkah 1.1. Yang direncanakan:
- `pnpm dev` — jalankan web dan server
- `pnpm test` / `pnpm typecheck` / `pnpm lint`
- `pnpm db:migrate` / `pnpm db:seed`

Versi skripsi: `cd legacy && docker compose up` (detail di `legacy/README.md`).

## Catatan lingkungan
- Di sesi cloud Claude Code, push tag git ditolak (403); push branch bisa.
  Tag dibuat manual oleh pemilik repo di GitHub.
- Docker bisa dipakai di sesi cloud setelah `dockerd` dijalankan, tetapi container
  butuh override jaringan host + CA proxy untuk `npm ci`. Override itu khusus
  sandbox dan JANGAN di-commit.
