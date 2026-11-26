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
  Tag `v0.1.0` (commit merge Fase 1) masih perlu dibuat manual di GitHub.
- Fase 2: 2.0 lapisan data lokal selesai (Dexie + outbox + hook + sinkron sederhana).
  2.1 sistem desain selesai (`docs/DESIGN.md`, review di `/dev/komponen`).
  2.2 layar HP selesai (masuk + PIN, Hari ini, Ternak, profil, catat event, Tugas).
  2.3 dashboard admin selesai (Ringkasan, Permintaan + verifikasi/tolak/ganti petugas + log,
  Tindak lanjut + WhatsApp, Peternak, Pengguna). 2.4 review UI selesai (tema "padang pagi",
  10 temuan teratas diperbaiki, `docs/REVIEW-2.4.md`). Fase 2 selesai; tag `v0.2.0` masih perlu
  dibuat manual di GitHub.
- Fase 3: 3.1 kode QR & cetak label selesai (daftar kode `qr_codes`, label A4 24/40, label
  kosong, riwayat tag pasang/ganti/cabut di profil). 3.2 pemindai QR selesai (Scan dengan
  BarcodeDetector/ZXing, offline, scan beruntun, daftar sapi baru dari kode). Uji di HP sungguhan
  belum dilakukan (panduan `docs/UJI-HP.md`). Fase 3 selesai setelah uji itu; tag `v0.3.0` manual.

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
- `pnpm dev:hp` — sama, tetapi Vite HTTPS (sertifikat buatan sendiri, `@vitejs/plugin-basic-ssl`)
  dan terbuka di Wi-Fi, untuk mencoba kamera di HP. Panduan: `docs/UJI-HP.md`.
- `pnpm test` / `pnpm typecheck` / `pnpm lint` (ESLint + Prettier check) / `pnpm format`
- `pnpm build` — build produksi web
- `pnpm e2e` — Playwright 360×740 (`apps/web/e2e/`): menyalakan server port 3100 dengan
  `data/e2e.sqlite` yang diisi ulang + Vite port 5174, lalu menyimpan screenshot ke
  `docs/screenshots/2.2-*.png` dan `2.3-*.png` (admin di 1280×800 + cek HP 360).
  `review.spec.ts` menyimpan `2.4-sesudah-*.png` (atau awalan lain lewat `SHOT_PREFIX=...`) dan
  memeriksa target sentuh ≥ 44px + tanpa scroll ke samping (`e2e/checks.ts`). `labels.spec.ts`
  menyimpan `3.1-*.png` (halaman label, tampilan cetak A4, riwayat tag). `scan.spec.ts` memakai
  kamera palsu (`e2e/fake-camera.ts`: video Y4M berisi QR `IB-SCAN2`) dan menyimpan `3.2-*.png`. Di luar sandbox: `pnpm --filter @ib/web exec playwright install chromium`.
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
- Data web (`apps/web/src/data/`): komponen membaca HANYA lewat hook (`useAnimals`,
  `useAnimalTimeline`, `useReminders`, `useSyncStatus`, ...) yang membaca Dexie, dan
  menulis HANYA lewat `useRepo()`. Repo memvalidasi dengan Zod + `validateNextEvent`,
  lalu menulis baris + entri `outbox` dalam satu transaksi. Tidak ada `fetch` di komponen.
- Status, jadwal, pengingat dihitung di klien dengan fungsi `@ib/shared` yang sama
  dengan server (`listReminders` dipakai bersama `/api/reminders`).
- Sinkron sederhana (`data/sync/engine.ts`): push outbox FIFO lewat endpoint REST;
  2xx/`409 ALREADY_EXISTS` = selesai, 4xx lain = ditolak (disimpan, antrean lanjut),
  401 = berhenti (perlu masuk), jaringan/5xx = berhenti + backoff. Pull
  `GET /api/sync/changes?since=` tidak menimpa baris yang masih pending. Konflik penuh: Fase 4.
- Data lokal milik satu akun (`meta.owner`); akun lain yang masuk menghapusnya, dan
  ditolak bila masih ada perubahan belum terkirim.
- Desain: lihat `docs/DESIGN.md`. Warna hanya lewat token di `apps/web/src/index.css`
  (ditulis `#rrggbb`); `design/contrast.test.ts` memeriksa WCAG AA untuk mode terang dan
  kontras tinggi (`<html data-contrast="high">`). Tepi pakai `border-(length:--bw)`.
  Huruf Atkinson Hyperlegible Next dari `@fontsource-variable` (lokal, bukan CDN).
- Status reproduksi di UI selalu lewat `StatusBadge` (ikon + teks), lintasan siklus `CycleTrack`.
  Fungsi non-komponen ditaruh di file `.ts` terpisah (`describe-*.ts`, `cycle.ts`) agar
  Fast Refresh tidak memberi peringatan.
- Rute: TanStack Router berbasis kode di `apps/web/src/router.tsx` (tanpa plugin Vite).
  Kerangka `layout/app-shell.tsx`: navigasi bawah di HP, sidebar di ≥ 1024px.
- Layar (langkah 2.2): `layout/auth-gate.tsx` (belum masuk → Masuk; PIN → layar PIN),
  rute di `router.tsx` dengan `staticData` (`title`, `focus` = tanpa navigasi bawah + tombol
  kembali, `backTo`). Halaman di `pages/`; fungsi murni layar di file `.ts` (mis.
  `animal-filter.ts`, `reminder-groups.ts`, `components/event-form-model.ts`).
- PIN hanya di HP (hash PBKDF2 di `meta.pin`, `data/pin.ts`), 5× salah → masuk dengan password.
  Status terkunci di memori (`data/lock.ts`). Foto ternak hanya lokal (`animalPhotos`, Dexie v2);
  unggah ke server di Fase 4.
- Form IB harus muat satu layar 360×740 (dicek `pnpm e2e`); isian bawaan dari IB terakhir
  pengguna dan stok strawnya (`loadEventDefaults`).
- Admin (langkah 2.3): navigasi menurut peran (`layout/nav-items.ts`: `navItemsFor`); halaman
  di `pages/admin/`. Tabel di ≥ 1024px, kartu di HP. Verifikasi/tugaskan, tolak, ganti petugas
  lewat outbox (`repo.assign/reassign/rejectServiceRequest`); server menjawab kiriman ulang
  dengan 200. Log aktivitas = data permintaan + penugasan + event hasil + `audit_logs`
  (disinkronkan ke admin saja). Manajemen pengguna ONLINE-ONLY (`data/users-api.ts`,
  `/api/users`); data pengguna tanpa hash password ikut sinkron (Dexie v3: `users`, `auditLogs`).
- WhatsApp: hanya tautan `wa.me` dengan pesan terisi (`lib/whatsapp.ts`); tidak ada pengiriman
  otomatis dan tidak ada API WhatsApp.
- Tema 2.4: gradasi `--sky-wash` → `--lime-wash`, aksen `--straw` #e2f05c, kelas `.surface`
  (kartu) dan `.display` (judul serif Instrument Serif, hanya ≥ 25px), komponen `Panel`, tombol pil.
  Ikon ternak = `Cow` (`components/icons/cow.tsx`), bukan Paw.
- Animasi: library Motion (`motion/react`), dibungkus `<MotionConfig reducedMotion="user">` di
  `main.tsx`. Skeleton di `components/skeletons.tsx`, ilustrasi `components/illustrations/meadow.tsx`
  (`aria-hidden`). Halaman tidak boleh `return null` saat memuat: pakai skeleton.
- Error rute: `RouteError`/`RootError` (`layout/route-error.tsx`). Halaman admin dan `/dev/*`
  dimuat lazy (`lazyRouteComponent`).
- Form: `fieldA11y(id, error)` (`lib/a11y.ts`) + pesan error `role="alert"`. Pindah halaman:
  fokus ke h1 + live region (`useRouteAnnouncement` di `app-shell.tsx`).
- Tindakan pengingat per peran: `reminderAction` (`lib/reminder-actions.ts`), misalnya peternak
  "Minta PKB", petugas "Catat PKB".
- Kode QR (langkah 3.1): `IB-` + 5 simbol dari `QR_ALPHABET` (32 simbol tanpa O/0/I/1), dibuat
  di perangkat (`generateUniqueQrCodes`, `parseQrCode`, `qrPayload` di `@ib/shared`). Keunikan:
  HP mengecek semua kode yang ia ketahui (label + tag), server menjaga indeks unik `qr_codes.code`.
  Setiap label tercetak (juga label kosong) = baris `qr_codes` lewat outbox (`repo.reserveQrCodes`);
  server menolak kode ganda (409 CONFLICT) dan label itu tampil "jangan dipakai". Tag QR yang
  dipasang selalu terdaftar di `qr_codes` (`registerQrCode`). Sinkron: hanya kode milik pengguna.
  Kode tidak pernah dipakai ulang, termasuk setelah tag dicabut. Cabut tag aman dikirim ulang.
- QR hanya berisi kode (atau URL `VITE_QR_BASE_URL/t/IB-XXXXX`), tanpa nama/data pribadi.
  Gambar QR dengan `uqr` (`lib/qr-path.ts`, `components/qr-code.tsx`), ECC M.
- Cetak label (`pages/labels/`): CSS print (`.print-root` lewat portal ke `<body>`, `@page` A4
  tanpa margin); tata letak di `sheet-layout.ts` (24 = 3×8 70×37 mm, 40 = 4×10 52,5×29,7 mm).
  Riwayat tag di profil: `components/tag-history.tsx` (`repo.attachTag/attachNewQrCode/removeTag`).
- Scan (langkah 3.2, `pages/scan/`): `useQrScanner` = kamera belakang (`lib/scan/camera.ts`) +
  pembaca (`lib/scan/detector.ts`: `BarcodeDetector` bila mendukung `qr_code`, selain itu
  `@zxing/browser` yang dimuat dinamis). Kamera menyala otomatis bila izin sudah diberikan, mati saat
  halaman disembunyikan. Hasil dicari di Dexie (`data/scan-lookup.ts`: `lookupScan`,
  `classifyScanText`; QR dari format/URL, selain itu nomor eartag dengan pencocokan longgar).
  Ditemukan → profil `?scan=1` dengan tombol cepat sesuai peran; belum terpakai → `/ternak/baru`
  (`createAnimal` menerima `qrCode` atau `eartag`, satu transaksi). Scan beruntun: daftar di memori
  (`lib/scan/batch-store.ts`), pilihan mode diingat di localStorage. Getar + bip Web Audio
  (`lib/scan/feedback.ts`). Pesan kamera ditolak/tidak ada/https di `CAMERA_PROBLEM_TEXT`.
- Tes web memakai `fake-indexeddb` (di `src/test/setup.ts`) dan fixture
  `src/test/data-fixtures.ts` (DB baru per tes, fetch tiruan).
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
