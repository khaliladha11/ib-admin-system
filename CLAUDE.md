# IB Admin System — Rebuild

## Konteks
Proyek ini berasal dari skripsi Muhammad Khalil Adha (Ilmu Komputer IPB, 2025):
"Pengembangan Sistem Informasi Permintaan Inseminasi Buatan (IB) Berbasis Web
Guna Mendukung Koordinasi Stakeholder". Versi skripsi diarsipkan di folder
`legacy/` dan tag git `v3.1-legacy`. Folder `legacy/` hanya referensi logika
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
- Fase 0 selesai (tag `v3.1-legacy` masih perlu dibuat manual di GitHub).
- Fase 1 selesai: 1.1 monorepo, 1.2 model data, 1.3 mesin status reproduksi, 1.4 API
  (login, peran, CRUD, event, permintaan layanan, pengingat, OpenAPI di `/api/docs`).
  Langkah berikutnya: 2.0 lapisan data lokal di web. Setelah Fase 1 di-merge: tag `v0.1.0`.

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
- `pnpm dev` — web (http://localhost:5173) + server (http://localhost:3000), proxy `/api`
- `pnpm test` / `pnpm typecheck` / `pnpm lint` (ESLint + Prettier check) / `pnpm format`
- `pnpm build` — build produksi web
- `pnpm db:migrate` — jalankan migrasi (`DATABASE_URL`, bawaan `apps/server/data/ib.sqlite`)
- `pnpm db:seed` — isi data contoh fiktif; `pnpm db:seed --reset` untuk mengisi ulang
- `pnpm db:generate` — buat file migrasi baru setelah mengubah `apps/server/src/db/schema.ts`
- API: `http://localhost:3000/api/docs` (Swagger UI) dan `/api/openapi.json`. Akun seed:
  `admin.dinas@contoh.test`, `admin.ktt01@contoh.test`, petugas `081200000201`–`203`,
  peternak `081200000100`; password `contoh123`.

## Keputusan teknis
- pnpm 10 (`packageManager`), Node 22 (`.nvmrc`); versi bersama lewat `catalog:`
  di `pnpm-workspace.yaml`.
- TypeScript dikunci ~6.0: typescript-eslint belum mendukung TS 7.
- `packages/shared` source-only (`exports` ke `src/index.ts`, tanpa build);
  resolusi modul `Bundler`. Impor antarpaket: `@ib/shared`.
- Alias `@/` di web menunjuk `apps/web/src`.
- Komponen shadcn/ui ada di `apps/web/src/components/ui`; ukuran tombol dinaikkan
  ke ≥ 44px. Registry shadcn tidak bisa diakses dari sandbox cloud, jadi
  komponen baru ditulis manual mengikuti keluaran CLI.
- Paket yang butuh build script didaftarkan di `onlyBuiltDependencies`.
- Database: enum di `packages/shared/src/enums.ts`, skema Zod di
  `packages/shared/src/schemas/`, tabel Drizzle di `apps/server/src/db/schema.ts`
  (memakai enum yang sama + CHECK di database). Kolom snake_case di DB, camelCase di TS.
- ID: `uuidv7()` dari `@ib/shared`. Cap waktu INTEGER ms UTC; tanggal TEXT `YYYY-MM-DD`.
- Event tidak pernah di-update: koreksi = event baru dengan `voidsEventId`.
  Ganti petugas = baris `assignments` baru, yang lama ditutup.
- Hitung baris dengan `countRows()` (`apps/server/src/db/client.ts`), bukan
  `db.$count()` yang mengembalikan builder async.
- Zod 4: opsi pesan di `.refine()` memakai `error`, bukan `message`.
- API (`apps/server/src/routes/`): Hono + `@hono/zod-openapi`. Skema dari `@ib/shared`
  dibungkus `z.object(x.shape)` dengan `z` dari `@hono/zod-openapi` sebelum `.openapi()`.
  Error selalu `{ error: { code, message, details? } }` (`http/errors.ts`).
- Login: argon2id (`@node-rs/argon2`), sesi di tabel `sessions` (id = SHA-256 token),
  cookie `ib_session` httpOnly SameSite=Lax. Cakupan akses di `auth/scope.ts`; data di
  luar cakupan dijawab 404. Peternak tidak bisa mencatat IB/PKB.
- Event via API wajib lolos `validateNextEvent`: error → 422, peringatan → 409 sampai
  dikirim ulang dengan `confirmWarnings: true`. LH dengan anak hidup mendaftarkan anaknya.
- Swagger UI disajikan dari `swagger-ui-dist` (bukan CDN) agar jalan offline.
- Logika reproduksi di `packages/shared/src/domain/`: `deriveReproStatus`,
  `validateNextEvent`, `computeSchedule` memakai satu mesin status (`replay`).
  Semua angka hari di `domain/constants.ts`. Pengingat 9 bulan = lewat konsepsi +
  300 hari; BH saat bunting hanya peringatan (keputusan langkah 1.3).

Versi skripsi: `cd legacy && docker compose up` (detail di `legacy/README.md`).

## Versi
- `v3.1-legacy` = versi skripsi. Rebuild memakai semver: `v0.1.0` setelah Fase 1,
  naik minor per fase, `v1.0.0` di langkah 6.1 (lihat `docs/PLAN.md` §9).

## Catatan lingkungan
- Di sesi cloud Claude Code, push tag git ditolak (403); push branch bisa.
  Tag dibuat manual oleh pemilik repo di GitHub.
- Docker bisa dipakai di sesi cloud setelah `dockerd` dijalankan, tetapi container
  butuh override jaringan host + CA proxy untuk `npm ci`. Override itu khusus
  sandbox dan JANGAN di-commit.
