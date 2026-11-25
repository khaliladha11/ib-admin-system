# IB Admin System — Rebuild

## Konteks
Proyek ini berasal dari skripsi Muhammad Khalil Adha (Ilmu Komputer IPB, 2025):
"Pengembangan Sistem Informasi Permintaan Inseminasi Buatan (IB) Berbasis Web
Guna Mendukung Koordinasi Stakeholder". Versi skripsi diarsipkan di folder
`legacy/` dan tag git `v3.1-skripsi`. Folder `legacy/` hanya referensi logika
bisnis: JANGAN diubah, JANGAN diimpor oleh kode baru.

Tujuan rebuild: aplikasi open-source, offline-first, mobile-first untuk
mencatat siklus reproduksi sapi (birahi, IB, PKB, kelahiran) bagi peternak,
inseminator, dan admin kelompok/dinas. Rencana lengkap: `docs/PLAN.md`.

## Prinsip
1. Offline-first: semua pencatatan harus bisa tanpa internet; sinkron menyusul.
2. Mobile-first: target utama HP Android layar 5,5 inci; PC untuk rekap/admin.
3. Ternak sebagai pusat data: status sapi DIHITUNG dari urutan event, bukan
   disimpan sebagai teks bebas.
4. Mudah dipasang: satu perintah untuk menjalankan server lokal (SQLite).
5. Selaras iSIKHNAS: kode event BH, IB, PKB, KGG, LH, BB.

## Stack
- Monorepo pnpm: `apps/web`, `apps/server`, `packages/shared`
- TypeScript strict di semua paket
- Web: React + Vite, TanStack Router & Query, Tailwind CSS, shadcn/ui,
  ikon lucide-react, PWA via vite-plugin-pwa, data lokal Dexie (IndexedDB)
- Server: Hono (Node), Zod, Drizzle ORM, SQLite (better-sqlite3);
  PostgreSQL opsional lewat env
- Tes: Vitest (unit), Playwright (end-to-end)
- Validasi dan tipe domain didefinisikan SEKALI di `packages/shared`

## Istilah domain
- Peternak (owner), Ternak (animal), Event, Permintaan layanan (service request),
  Petugas/inseminator, Admin kelompok, Admin dinas
- Event: BH = birahi, IB = inseminasi buatan (kode straw, ID pejantan, batch),
  PKB = pemeriksaan kebuntingan (hasil, umur janin bulan), KGG = keguguran
  (trimester 1-3), LH = lahir (jenis kelamin, ID anak), BB = berat badan (kg)
- Aturan pengingat dari skripsi: hasil IB belum dilaporkan > 3 bulan,
  kelahiran/keguguran belum dilaporkan > 9 bulan setelah dinyatakan bunting
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

## Perintah
- `pnpm dev` — jalankan web dan server
- `pnpm test` / `pnpm typecheck` / `pnpm lint`
- `pnpm db:migrate` / `pnpm db:seed`
