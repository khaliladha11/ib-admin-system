# Berkontribusi ke IB Ternak

Terima kasih sudah tertarik! Kontribusi apa pun diterima: laporan bug dari lapangan, perbaikan teks,
terjemahan istilah peternakan, tes, dokumentasi, maupun fitur.

## Sebelum mulai

- Baca [`CLAUDE.md`](CLAUDE.md) (prinsip dan aturan kerja proyek) dan [`docs/PLAN.md`](docs/PLAN.md)
  (model data dan roadmap).
- Untuk perubahan besar (fitur baru, mengganti bagian stack, mengubah skema database), buka issue
  dulu untuk berdiskusi.
- Cari issue berlabel [`good first issue`](https://github.com/khaliladha11/ib-admin-system/labels/good%20first%20issue)
  bila baru pertama kali.

## Menyiapkan lingkungan

Node.js 22 (`.nvmrc`) dan pnpm 10.

```bash
pnpm install
```

```bash
pnpm db:migrate && pnpm db:seed
```

```bash
pnpm dev
```

Akun contoh ada di [`README.md`](README.md#mencoba). Semua data contoh fiktif.

## Aturan singkat

1. **Offline dulu.** Pencatatan harus jalan tanpa internet. Komponen membaca data lewat hook
   (`apps/web/src/data/hooks.ts`) dan menulis lewat `useRepo()`, tidak pernah `fetch` langsung.
2. **Status dihitung, bukan disimpan.** Status reproduksi dan pengingat dihitung dari urutan event
   di `packages/shared/src/domain/`. Event tidak pernah diubah; koreksi = event baru.
3. **Satu sumber aturan.** Skema Zod dan logika domain hanya di `packages/shared` (fungsi murni,
   tanpa I/O). Angka hari ada di `domain/constants.ts`.
4. **Otorisasi di server.** Setiap route memeriksa peran dan cakupan wilayah; data di luar cakupan
   dijawab 404.
5. **Teks UI Bahasa Indonesia sederhana**; nama kode, variabel, dan tabel dalam Bahasa Inggris.
6. **Nyaman di lapangan.** Target sentuh minimal 44px, warna hanya lewat token di
   `apps/web/src/index.css` (dicek kontrasnya oleh tes).
7. **Logika domain wajib punya unit test.**
8. **Tanpa rahasia di kode**; konfigurasi lewat `.env` dan contohnya di `.env.example`.
9. Tanya dulu sebelum menambah dependensi besar.
10. Jangan mengubah `legacy/`: folder itu arsip versi skripsi.

## Sebelum membuka pull request

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Bila mengubah layar, jalankan juga `pnpm e2e` (Playwright, butuh Chromium:
`pnpm --filter @ib/web exec playwright install chromium`). Tes ini menyimpan ulang screenshot di
`docs/screenshots/`; ikutkan hanya screenshot yang memang berubah karena perubahan Anda.

- Commit memakai [Conventional Commits](https://www.conventionalcommits.org/id/v1.0.0/):
  `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Perubahan kecil dan terfokus; satu pull request untuk satu hal.
- Isi template pull request, termasuk cara menguji.
- Perubahan yang terlihat pengguna dicatat di [`CHANGELOG.md`](CHANGELOG.md) bagian
  "Belum dirilis".

## Ide untuk kontributor baru

- Form catat **ternak keluar** (mati/dijual/dipotong, event `EXIT`) dan **catatan kesehatan**
  (`HEALTH`). Datanya sudah didukung, tetapi belum ada form di layar.
- Tombol **koreksi catatan** di riwayat sapi (event baru dengan `voidsEventId`).
- Tanggal di form memakai format Indonesia (`27/11/2026`) di semua peramban.
- Terjemahan istilah ke bahasa daerah (Jawa, Sunda, Bali, …) sebagai bahan diskusi.

## Lisensi kontribusi

Dengan mengirim kontribusi, Anda setuju kontribusi itu dilisensikan di bawah
[AGPL-3.0](LICENSE), sama dengan proyek ini.
