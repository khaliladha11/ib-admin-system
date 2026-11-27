# Catatan perubahan

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), versi mengikuti
[Semantic Versioning](https://semver.org/lang/id/). Nomor langkah merujuk ke
[`docs/PROMPTS.md`](docs/PROMPTS.md).

## [Belum dirilis]

### Ditambahkan

- Halaman **Laporan** untuk admin (6.2):
  - S/C dan CR (dari IB pertama) per petugas, desa, dan bulan;
  - tren permintaan IB per bulan dan waktu respons petugas;
  - rumus dijelaskan di halaman.
  - Dihitung di HP (juga offline) dengan fungsi `@ib/shared/analytics`.
- Ekspor laporan ke **Excel (.xlsx)** yang dibuat langsung di perangkat tanpa library tambahan.
  Untuk PDF ada tampilan **cetak A4** → Simpan sebagai PDF.
- Halaman **Lapor iSIKHNAS** (6.3):
  - pesan SMS siap kirim untuk BH, IB, PKB, KGG, LH, dan BB yang belum dilaporkan;
  - tombol salin satu-satu atau sekaligus;
  - tanda "sudah dilaporkan" yang ikut sinkron;
  - ID pemilik dan ID hewan iSIKHNAS yang kosong bisa diisi langsung di halaman itu.

## [1.0.0] - 2026-11-27

Rilis open-source pertama **IB Ternak**.

### Ditambahkan

- Lisensi AGPL-3.0, README baru, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, template
  issue dan pull request.
- Lainnya → **Tentang aplikasi**: versi, lisensi, dan tautan kode sumber (`VITE_SOURCE_URL`).
- Batas percobaan masuk: 5 gagal per akun (30 per IP) mengunci 15 menit, dengan jawaban 429 dan
  `Retry-After`.
- Header keamanan: CSP ketat, `nosniff`, larangan frame, tanpa referrer, `Permissions-Policy`
  kamera saja.

### Diubah

- Lisensi dari MIT menjadi AGPL-3.0.
- Versi semua paket menjadi 1.0.0.

## [0.5.0] - 2026-11-27 (Fase 5: persiapan uji coba)

### Ditambahkan

- Server latihan `DEMO_MODE=1`: data contoh otomatis, **Reset data demo** (admin dinas) dan
  `./scripts/pos.sh reset-demo`. HP membuang data lama setelah reset. Aplikasi menampilkan pita
  "Mode latihan".
- Form **Beri masukan** (offline, ikut sinkron); admin melihatnya di Tindak lanjut.
- **Catatan pemakaian** anonim yang hanya tersimpan di HP (lama mengisi form, event per jenis),
  bisa diunduh sebagai CSV/JSON.
- `docs/UAT.md`: skenario uji coba dari alur skripsi, formulir hasil, dan kuesioner SUS.
- Panduan cetak satu halaman untuk peternak dan inseminator (`docs/panduan/`).

## [0.4.0] - 2026-11-27 (Fase 4: offline penuh dan server lokal)

### Ditambahkan

- PWA **IB Ternak**: bisa dipasang ke layar utama, semua layar terbuka tanpa sinyal, dan ada
  tombol "Perbarui sekarang" saat versi baru tersedia.
- Sinkron tahan konflik ([`docs/SYNC.md`](docs/SYNC.md)):
  - push/pull berbatch dan idempoten;
  - profil digabung per kolom;
  - event yang bertentangan masuk "Perlu dicek";
  - halaman **Data belum terkirim**.
- Mode pos IB:
  - Docker Compose dengan Caddy (HTTPS lokal);
  - skrip instal satu baris dan `scripts/pos.sh`;
  - halaman **Pos IB** (alamat + QR untuk HP);
  - cadangan harian;
  - ekspor JSON/CSV dan impor gabung.
- [`docs/INSTALL.md`](docs/INSTALL.md) untuk non-programmer.

## [0.3.0] - 2026-11-26 (Fase 3: identitas QR)

### Ditambahkan

- Kode QR `IB-XXXXX` dibuat di HP dan dijamin unik. Label A4 bisa dicetak 24 atau 40 per lembar,
  termasuk label kosong.
- Riwayat tag di profil sapi: pasang, ganti, dan cabut.
- Halaman **Scan**:
  - `BarcodeDetector` dengan cadangan ZXing, berjalan offline;
  - tombol cepat Catat IB/PKB/lahir;
  - daftarkan sapi dari label kosong;
  - scan beruntun dan ketik eartag.

## [0.2.0] - 2026-11-26 (Fase 2: tampilan HP dan dashboard)

### Ditambahkan

- Lapisan data lokal (Dexie + outbox) sehingga semua pencatatan berjalan offline.
- Sistem desain untuk lapangan: tombol ≥ 44px, kontras tinggi, huruf Atkinson Hyperlegible.
- Layar HP: masuk + PIN, Hari ini, Ternak, profil sapi, catat kejadian, Tugas, minta IB/PKB.
- Dashboard admin:
  - Ringkasan;
  - Permintaan (verifikasi, tolak, ganti petugas, log aktivitas);
  - Tindak lanjut dengan pengingat WhatsApp;
  - Peternak dan Pengguna.
- Tema "padang pagi" dan perbaikan dari review UI.

## [0.1.0] - 2026-11-25 (Fase 1: inti data dan logika)

### Ditambahkan

- Monorepo pnpm (web, server, shared), CI, dan TypeScript strict.
- Model data SQLite (Drizzle) dengan event tambah-saja.
- Mesin status reproduksi, `validateNextEvent`, dan pengingat 3 dan 9 bulan dari tanggal kejadian.
- REST API dengan login argon2, peran dan cakupan wilayah, permintaan layanan, penugasan, dan
  OpenAPI di `/api/docs`.

## [3.1-legacy] - 2025

Versi skripsi (Express + PostgreSQL + React), diarsipkan di [`legacy/`](legacy/README.md).

[Belum dirilis]: https://github.com/khaliladha11/ib-admin-system/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/khaliladha11/ib-admin-system/releases/tag/v1.0.0
[0.5.0]: https://github.com/khaliladha11/ib-admin-system/releases/tag/v0.5.0
[0.4.0]: https://github.com/khaliladha11/ib-admin-system/releases/tag/v0.4.0
[0.3.0]: https://github.com/khaliladha11/ib-admin-system/releases/tag/v0.3.0
[0.2.0]: https://github.com/khaliladha11/ib-admin-system/releases/tag/v0.2.0
[0.1.0]: https://github.com/khaliladha11/ib-admin-system/releases/tag/v0.1.0
[3.1-legacy]: https://github.com/khaliladha11/ib-admin-system/tree/v3.1-legacy
