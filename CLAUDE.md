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
- Fase 4: 4.1 PWA selesai (nama **IB Ternak**, manifest + ikon, service worker precache semua
  aset, "Perbarui sekarang", bundel awal 735 KB / 228 KB gzip, `docs/BUNDLE.md`).
  4.2 sinkron tahan konflik selesai (`docs/SYNC.md`: push/pull berbatch, konflik profil per kolom,
  event "perlu dicek", halaman Data belum terkirim, tes dua HP). 4.3 mode pos selesai (Docker +
  Caddy HTTPS lokal, skrip instal, halaman Pos IB, cadangan harian, ekspor/impor, `docs/INSTALL.md`);
  image Docker, Caddy, dan skrip instal BELUM diuji di perangkat sungguhan (sandbox tidak bisa).
  Fase 4 selesai setelah uji itu; tag `v0.4.0` manual.
- Fase 5: 5.1 persiapan UAT selesai (`docs/UAT.md`, panduan cetak `docs/panduan/`, mode demo
  `DEMO_MODE=1` + reset, form masukan, catatan pemakaian lokal). 5.2 dilewati dulu (belum ada pilot).
- Fase 6: 6.1 rilis v1.0.0 selesai di repo (lisensi AGPL-3.0, README, CONTRIBUTING, CODE_OF_CONDUCT,
  SECURITY, template issue/PR, CHANGELOG, versi 1.0.0, catatan rilis `docs/rilis/v1.0.0.md`, header
  keamanan, batas percobaan masuk). Tag `v1.0.0` dan GitHub Release dibuat manual oleh pemilik repo.
  6.2 Laporan selesai (S/C, CR IB pertama, tren permintaan, waktu respons; Excel + cetak A4).
  Langkah berikutnya: 6.3 ekspor iSIKHNAS.

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
- `pnpm --filter @ib/web build` lalu `pnpm --filter @ib/web preview:hp` — build produksi dengan
  service worker (PWA), HTTPS di Wi-Fi port 4173. SW tidak ada di `pnpm dev`.
- Ukuran bundel: `pnpm --filter @ib/web exec tsx scripts/bundle-size.ts` setelah build;
  `ANALYZE=1 pnpm build` menampilkan isi bundel awal per paket.
- `pnpm test` / `pnpm typecheck` / `pnpm lint` (ESLint + Prettier check) / `pnpm format`
- `pnpm build` — build produksi web
- `pnpm e2e` — Playwright 360×740 (`apps/web/e2e/`): menyalakan server port 3100 dengan
  `data/e2e.sqlite` yang diisi ulang + Vite port 5174, lalu menyimpan screenshot ke
  `docs/screenshots/2.2-*.png` dan `2.3-*.png` (admin di 1280×800 + cek HP 360).
  `review.spec.ts` menyimpan `2.4-sesudah-*.png` (atau awalan lain lewat `SHOT_PREFIX=...`) dan
  memeriksa target sentuh ≥ 44px + tanpa scroll ke samping (`e2e/checks.ts`). `labels.spec.ts`
  menyimpan `3.1-*.png` (halaman label, tampilan cetak A4, riwayat tag). `scan.spec.ts` memakai
  kamera palsu (`e2e/fake-camera.ts`: video Y4M berisi QR `IB-SCAN2`) dan menyimpan `3.2-*.png`.
  Project `pwa` (`pwa.spec.ts`) memakai build produksi + `vite preview` port 5175: manifest, buka
  ulang offline dari cache SW, catat event offline, online → terkirim ke server (`4.1-*.png`), dan
  `two-devices.spec.ts` (dua HP offline mengubah data yang sama → `4.2-*.png`). `pos.spec.ts`:
  halaman Pos IB (cadangan, ekspor lalu impor) → `4.3-*.png`. Di luar sandbox: `pnpm --filter @ib/web exec playwright install chromium`.
- `uat.spec.ts`: masukan offline → terkirim → terlihat admin, catatan pemakaian + unduh CSV, mode demo
  (jawaban login/info ditandai demoMode di peramban) → `5.1-*.png`. `guide.spec.ts` membuat gambar
  `docs/panduan/img/*.jpg` dan PDF A4 satu halaman `docs/panduan/*.pdf`.
- Server latihan: `DEMO_MODE=1` di `.env`; `pnpm db:demo-reset` / `./scripts/pos.sh reset-demo`.
- Pos IB: `docker compose up -d --build` (butuh `POS_HOST` di `.env`), `scripts/install.sh` (Linux/Pi
  satu baris), `scripts/pos.sh` (mulai/berhenti/alamat/cadangkan/pulihkan/sertifikat/perbarui).
  `pnpm db:backup` (atau `db:backup daftar`) dan `pnpm db:restore <file>` (server dimatikan dulu).
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
- Sinkron (langkah 4.2, `docs/SYNC.md`, `data/sync/engine.ts`): push `POST /api/sync/push` ≤ 50 entri
  outbox (id entri = id perubahan, idempoten lewat tabel `sync_changes`); server menjalankan tiap
  perubahan lewat route REST yang sama (daftar putih kind→path, header `x-ib-sync`/`x-ib-change-at`).
  Hasil: applied/merged → selesai; needs_review (event 422 INVALID_EVENT) → outbox `needs_review`,
  event lokal di-soft-delete (tidak dihitung status), isi tersimpan di server; rejected → "Tidak
  diterima"; tanpa hasil (5xx) → backoff. Pull `GET /api/sync/pull?cursor=&scope=` berhalaman urut
  (updated_at, tabel, id), jam server monoton; sidik jari cakupan berubah → `reset`, HP menghapus baris
  yang tidak terlihat lagi. Pull tidak menimpa baris pending/needs_review. `/api/sync/changes` dihapus.
- Konflik profil per kolom: `updateProfile` (server) + tabel `field_versions`; kolom kalah →
  `audit_logs` `conflict`. Repo web hanya mengirim kolom yang berubah (`changedOnly`).
- Peringatan event dari sinkron diterima otomatis (kejanggalan tampil di profil). Event perlu dicek:
  `repo.retryReview` (id perubahan baru, cek lokal dulu), `repo.discardReview`; admin melihat
  `syncReviews` di Tindak lanjut dan bisa `discardServerReview`. Halaman `/data-belum-terkirim`;
  `SyncIndicator` menautkan ke halaman itu.
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
- PWA (langkah 4.1): `vite-plugin-pwa` `generateSW`, `registerType: 'prompt'`, `injectRegister: false`;
  `UpdatePrompt` (`components/update-prompt.tsx`, `useRegisterSW`) di `root-layout.tsx`: "Perbarui
  sekarang"/"Nanti" + pesan "Siap dipakai tanpa sinyal"; cek versi tiap jam. Precache semua
  js/css/html/svg/png/woff2 (termasuk chunk lazy) agar semua layar terbuka offline. `/api` TIDAK
  di-cache SW (denylist navigasi): data offline hanya Dexie + outbox. Manifest di `vite.config.ts`,
  ikon dari `public/icons/*.svg` lewat `scripts/render-icons.ts`. Dev server tanpa SW.
- Sinkron: event `online` dan tombol "Kirim sekarang" memanggil `syncNow({ force: true })` yang
  menghapus jeda backoff (`clearBackoff`), agar catatan langsung terkirim saat sinyal kembali.
- Bundel: Motion lewat `LazyMotion` (`lib/motion-features.ts`, dimuat terpisah) dan komponen
  `m` dari `motion/react-m` (jangan impor `motion` dari `motion/react` di komponen). Halaman form
  catat, minta IB/PKB, Lainnya, Scan, label, admin dimuat lazy. Ukuran: `docs/BUNDLE.md`.
- Pos (langkah 4.3): server menyajikan build web dari origin yang sama bila `WEB_DIST` diisi
  (`http/web-app.ts`, SPA fallback, `/assets` immutable, `sw.js` no-cache). Database kosong →
  `db/bootstrap.ts` membuat wilayah + admin dinas dari `ADMIN_EMAIL`/`ADMIN_PASSWORD` (atau data
  contoh bila `DEMO_DATA=1`). Cadangan harian `ops/backup.ts` (API backup SQLite, simpan
  `BACKUP_KEEP`, nama file UTC). Ekspor `ops/export.ts`: JSON lengkap (termasuk hash password) dan
  CSV ZIP (`ops/zip.ts`, tanpa hash); impor = gabung `onConflictDoNothing`, baris baru `updatedAt`
  = sekarang, cadangan dulu. Rute `/api/system/*` (info: admin; cadangan/ekspor/impor: admin dinas).
  Halaman web `/pos` (`pages/admin/pos.tsx`, `data/system-api.ts`, online-only).
- Docker: `Dockerfile` (build → `pnpm deploy --prod --legacy`, jalan dengan `tsx`, pengguna node,
  data di `/data`, cadangan di `/backups`), `docker-compose.yml` (app + Caddy), `deploy/Caddyfile`
  (`local_certs`, `tls internal` untuk `POS_HOST` + `default_sni`, sertifikat root di
  `http://IP/sertifikat`). `tsx` kini dependensi runtime server.
- UAT (langkah 5.1): `DEMO_MODE=1` (`config.demoMode`) = server latihan: bootstrap mengisi data
  contoh, `POST /api/system/demo/reset` (admin dinas, 404 bila mati) dan CLI `reset-demo` memakai
  `ops/demo.ts` `resetDemoData` (cadangan dulu, satu transaksi, sesi terhapus). Tabel `system_meta`
  menyimpan `data_generation` yang berganti setiap reset; `/api/auth/login|me` mengirim `generation`
  dan `demoMode`. HP menyimpan generasi di `meta.owner`; generasi berbeda saat masuk → data lokal
  dibuang tanpa bertanya (`clearLocalData(db, { keepUsage: true })`). Pita "Mode latihan" di
  `app-shell` dari `session.demoMode`.
- Masukan: tabel `feedback` (topik `FEEDBACK_TOPICS`, nilai 1–3), `POST/GET /api/feedback`, kind
  sinkron `feedback.create`, pull: pengirim melihat miliknya, admin melihat pengguna di wilayahnya
  (`vis.userIds`); ikut ekspor. Web: Dexie v6 `feedback`, `repo.sendFeedback`, halaman `/masukan`,
  daftar admin di Tindak lanjut.
- Catatan pemakaian HANYA lokal (`data/usage.ts`, Dexie v6 `usage`): tanpa id pengguna/ternak/teks,
  tidak masuk outbox, tanpa fetch, maks 5.000 baris. `useFormTiming(name)` (form ditutup < 2 detik
  bukan batal, > 30 menit durasi dibuang) dan `useScreenVisit(name)`. Ringkasan/CSV di
  `lib/usage-summary.ts`; halaman `/pemakaian` mengunduh lewat Blob (`lib/download.ts`), nama file
  tanpa id perangkat.
- Rilis (6.1): versi di `package.json` root (semua paket sama), tampil di Lainnya → Tentang aplikasi
  lewat `VITE_APP_VERSION` (define di `vite.config.ts`); tautan kode sumber `VITE_SOURCE_URL` (AGPL §13).
  Perubahan terlihat pengguna dicatat di `CHANGELOG.md` bagian "Belum dirilis".
- Keamanan (6.1): `http/security.ts` (`secureHeaders`: CSP aplikasi tanpa `unsafe-inline` untuk skrip,
  CSP Swagger terpisah, tanpa HSTS karena pos dibuka lewat IP). `auth/login-limiter.ts` di memori,
  dicek sebelum argon2; 429 `TOO_MANY_REQUESTS` + `Retry-After`; IP dari `X-Forwarded-For` (Caddy).
- Laporan (6.2): rumus di `packages/shared/src/analytics/` (`serviceRecords` → layanan IB + hasil,
  `fertilityStats`/`fertilityBy`, `requestTrend`, `responseTimes`; bulan WIB lewat `monthKey`).
  CR = IB pertama bunting ÷ IB pertama yang ada hasilnya; S/C = layanan ada hasil ÷ bunting (keputusan
  pemilik). Halaman `pages/admin/reports.tsx` + model murni `report-model.ts`; dihitung dari Dexie.
  Excel: `buildXlsx` (`packages/shared/src/files/`, ZIP + XML tanpa dependensi; `zipFiles` dipindah dari
  server ke shared, `utf8()` pengganti TextEncoder). PDF = cetak A4 (`.report-print`, dilepas saat
  `afterprint`). Grafik satu seri batang tipis + tabel (skill dataviz).
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
