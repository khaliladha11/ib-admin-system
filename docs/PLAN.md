# Rencana Rebuild IB Admin System

Dokumen ini adalah roadmap rebuild: *apa* yang dibangun dan *urutannya*.
Prinsip, stack, dan aturan kerja yang mengikat ada di [`CLAUDE.md`](../CLAUDE.md).
Prompt siap-salin untuk tiap langkah ada di [`docs/PROMPTS.md`](PROMPTS.md);
nomor langkah di dokumen ini sama dengan nomor prompt di sana.
Status: **draf**, diperbarui setiap fase selesai.

## 1. Latar belakang

Versi skripsi (V3.1, folder [`legacy/`](../legacy/README.md), tag `v3.1-skripsi`)
berpusat pada **permintaan layanan**: satu baris `requests` menyimpan status teks
yang mencampur alur kerja dan hasil biologis, laporan sebagai teks bebas, dan flag
pengingat yang dihitung ulang hanya saat dasbor admin dibuka. Hanya ada dua peran
yang punya UI (admin dinas, petugas), harus online, tampilan desktop, dan
pemasangan butuh PostgreSQL + skema manual.

Analisis lengkap kode lama: [`docs/legacy/DOMAIN.md`](legacy/DOMAIN.md). Pelajaran
utama yang menjadi dasar desain baru:

| Masalah di legacy (ID di DOMAIN.md) | Arah rebuild |
| --- | --- |
| Status disimpan sebagai teks, `Gagal` berarti tiga hal (I1) | Status reproduksi **dihitung** dari urutan event |
| Satu permintaan untuk banyak ekor, tanpa entitas ternak (I3) | **Ternak** sebagai pusat data |
| Flag pengingat disimpan; pengingat 9 bulan tidak pernah aktif (B1, B2) | Pengingat **dihitung** murni dari event + tanggal, dengan unit test |
| Ambang 3 bulan / 30 menit / 24 jam ditulis di SQL dan JSX | Satu file konstanta di `packages/shared` |
| Tidak ada login yang dijaga, siapa pun bisa daftar sebagai admin (S1–S5) | Sesi di server, otorisasi per peran dan cakupan di setiap route |
| Laporan saling menimpa, tanpa transaksi (B4, B7, B8, B10) | Event tambah-saja; koreksi lewat event baru, bukan menimpa |
| Kredensial & URL di kode, tidak ada skema/migrasi/tes (S6, I5, I12) | `.env`, migrasi Drizzle, seed fiktif, Vitest + Playwright |
| Wajib online | Offline-first sejak layar pertama (Dexie + outbox) |

## 2. Tujuan & non-tujuan

**Tujuan**
- Mencatat siklus reproduksi sapi (BH, IB, PKB, KGG, LH, BB) tanpa internet.
- Dari scan label QR sampai event IB tercatat dalam ≤ 30 detik, tanpa internet.
- Peternak, inseminator, dan admin melihat status & pengingat yang sama karena
  dihitung dari data yang sama.
- Bisa dijalankan sebagai server lokal di pos IB (laptop/mini PC) dengan satu perintah.
- Kode event selaras iSIKHNAS, dengan ekspor format teks SMS iSIKHNAS.
- Rilis v1.0 open-source yang mudah dicoba orang lain.

**Non-tujuan (untuk sekarang)**
- Integrasi API langsung ke iSIKHNAS (cukup teks siap kirim).
- Aplikasi native; cukup PWA yang bisa dipasang.
- Pengiriman notifikasi lewat server (WhatsApp cukup link `wa.me` berisi pesan).
- Pembayaran dan penjadwalan rute petugas.
- Migrasi otomatis data dari database PostgreSQL versi skripsi.

## 3. Pengguna & peran

| Peran (`users.role`) | Kebutuhan utama |
| --- | --- |
| `farmer`: peternak | Ternak miliknya, lapor birahi, ajukan IB/PKB, lihat status & pengingat |
| `inseminator`: petugas | Daftar tugas, catat IB/PKB/kelahiran di lapangan meski offline, scan QR |
| `group_admin`: admin kelompok | Kelola peternak & ternak kelompok, pantau pengingat, rekap kelompok |
| `agency_admin`: admin dinas | Verifikasi/tugaskan permintaan, kelola petugas & kelompok, rekap wilayah |

Cakupan akses: peternak hanya melihat ternaknya sendiri; inseminator melihat
tugas dan wilayahnya; admin melihat kelompok/dinasnya. Dicek di server, tidak
hanya di UI.

## 4. Arsitektur

```
apps/web        React + Vite PWA, TanStack Router & Query, Tailwind + shadcn/ui,
                Dexie (IndexedDB) sebagai sumber data UI, outbox untuk sinkron
apps/server     Hono (Node), Zod, Drizzle ORM, SQLite (better-sqlite3);
                PostgreSQL opsional lewat env; OpenAPI di /api/docs
packages/shared Tipe domain, skema Zod, konstanta, mesin status, jadwal &
                pengingat, statistik: dipakai web DAN server, ditulis sekali
```

Aturan ketergantungan: `apps/*` boleh mengimpor `packages/shared`; `shared`
tidak mengimpor `apps/*` dan bebas I/O (fungsi murni), sehingga aturan yang sama
berlaku di HP saat offline dan di server.

## 5. Model data inti

Semua `id` berupa **UUID yang dibuat di perangkat**. Setiap baris punya
`created_at`, `updated_at`, `deleted_at` (soft delete), dan `device_id`.

| Tabel | Isi |
| --- | --- |
| `users` | Akun login (email/no. HP + hash password), `role`, keterkaitan ke kelompok/dinas |
| `farmers` | Data peternak; ID pemilik iSIKHNAS opsional |
| `locations` | Hierarki wilayah: dinas → kelompok → desa |
| `animals` | Ternak: nama panggilan, jenis kelamin, bangsa, tanggal lahir, `farmer_id`, induk (opsional), ID hewan iSIKHNAS opsional |
| `animal_tags` | Identitas fisik: kode QR `IB-XXXXX`, eartag resmi, riwayat pasang/ganti/cabut |
| `events` | Log **tambah-saja** per ternak: `type`, `occurred_at`, `recorded_by`, `payload` JSON tervalidasi Zod per jenis |
| `service_requests` | Permintaan layanan IB/PKB dari peternak |
| `assignments` | Penugasan permintaan ke inseminator, termasuk ganti petugas |
| `semen_stock` | Stok straw/semen per inseminator (kode straw, pejantan, batch) |
| `audit_logs` | Siapa mengubah apa; versi lama saat konflik sinkron |

Jenis event dan payload:

| Kode | Arti | Payload |
| --- | --- | --- |
| `BH` | Birahi | catatan opsional |
| `IB` | Inseminasi buatan | `strawCode`, `bullId`, `batch` |
| `PKB` | Pemeriksaan kebuntingan | `result` (bunting/tidak), `fetalAgeMonths` |
| `KGG` | Keguguran | `trimester` (1–3) |
| `LH` | Lahir | `calfSex` (J/B), `calfAnimalId` (membuat ternak baru) |
| `BB` | Berat badan | `weightKg` |
| `HEALTH` | Catatan kesehatan | diagnosis/tindakan (rinci di langkah 1.2) |
| `EXIT` | Ternak keluar | alasan: mati, dijual, dipotong. Kematian anak sapi (di legacy: laporan kematian) dicatat sebagai `EXIT` pada ternak anak |

Rancangan rinci (diagram ER, contoh payload) dibuat di langkah 1.2 dan
disetujui sebelum implementasi.

## 6. Logika domain (`packages/shared/src/domain/`)

### 6.1 Status reproduksi (dihitung)

`deriveReproStatus(events)` → `kosong`, `birahi`, `sudah_IB_menunggu_PKB`,
`bunting` (dengan umur kebuntingan), `keguguran`, `sudah_lahir`, beserta event
terakhir yang relevan.

```
          BH          IB                      PKB bunting           LH
 kosong ──────► birahi ───► sudah_IB_menunggu_PKB ─────────► bunting ─────► sudah_lahir
   ▲                               │ PKB tidak bunting            │ KGG
   └───────────────────────────────┘                              ▼
                                                              keguguran
```

`BB` dan `HEALTH` tidak mengubah status reproduksi; `EXIT` mengakhiri catatan ternak.

### 6.2 Validasi urutan

`validateNextEvent(events, newEvent)` menolak urutan yang tidak masuk akal
(mis. `LH` tanpa PKB bunting, `IB` pada sapi bunting) dengan pesan Bahasa
Indonesia. Dipakai di server **dan** di HP. Event yang datang lewat sinkron dan
ternyata tidak valid tidak dibuang, tetapi ditandai **"perlu dicek"**.

### 6.3 Jadwal & pengingat

`computeSchedule(events, today)` menghasilkan:
- perkiraan birahi berikutnya (`BH`/`IB` terakhir + 21 hari bila belum bunting);
- jadwal PKB setelah IB;
- perkiraan lahir (9–10 bulan setelah IB yang dikonfirmasi bunting);
- pengingat terlambat dari skripsi: **hasil IB belum dilaporkan > 3 bulan**, dan
  **kelahiran/keguguran belum dilaporkan > 9 bulan setelah dinyatakan bunting**.

Semua angka hari/bulan diambil dari satu file konstanta (mis. `ESTRUS_CYCLE_DAYS = 21`,
`IB_RESULT_REPORT_DUE_MONTHS = 3`, `BIRTH_REPORT_DUE_MONTHS = 9`,
`GESTATION_MONTHS_MIN/MAX = 9/10`). Patokan waktu adalah tanggal event sebenarnya,
bukan waktu laporan diketik (legacy memakai waktu laporan, lihat DOMAIN.md §4.1).

### 6.4 Statistik (Fase 6)

*Service per conception* (S/C), *conception rate* (CR) per inseminator, desa, dan
periode; tren permintaan; rata-rata waktu respons petugas. Rumus ditampilkan di
halaman dan dites dengan data contoh yang dihitung manual.

## 7. Offline-first & sinkronisasi

- Web membaca dan menulis ke **Dexie sejak layar pertama** (langkah 2.0); setiap
  penulisan masuk ke `outbox` dan dikirim di latar belakang.
- `POST /api/sync/push`: batch dari outbox, idempoten berdasarkan id perubahan.
- `GET /api/sync/pull?since=`: perubahan sejak versi terakhir, dengan paginasi.
- Aturan konflik: event selalu ditambahkan, tidak pernah ditimpa; data profil
  (peternak, ternak) memakai `updated_at` terbaru dan versi lama dicatat di
  `audit_logs`; hapus = soft delete.
- UI menampilkan status sinkron (online/offline, jumlah belum terkirim) dan halaman
  "Data belum terkirim" dengan tombol coba lagi.
- Desain rinci ditulis di `docs/SYNC.md` (langkah 4.2) dan disetujui sebelum implementasi.

## 8. UI/UX

- Target HP Android 5,5 inci (uji di viewport 360×740); PC ≥ 1024px untuk admin.
- Navigasi bawah di HP: Beranda, Ternak, **Scan**, Tugas, Lainnya; sidebar kiri di PC.
- Target sentuh ≥ 44px, teks dasar 16px, kontras WCAG AA, mode kontras tinggi.
- Badge status memakai warna + ikon + teks, tidak hanya warna.
- Form IB muat dalam satu layar tanpa scroll; isian default dari data terakhir.
- Bahasa Indonesia sederhana; istilah sesuai CLAUDE.md.

## 9. Fase & langkah

Nomor langkah = nomor prompt di [`docs/PROMPTS.md`](PROMPTS.md).

| Fase | Langkah | Selesai bila |
| --- | --- | --- |
| **0. Arsip skripsi** | 0.1 arsip ke `legacy/` ✅ · 0.2 ekstrak domain ✅ · 0.3 jalankan versi lama via Docker ✅ | Tag `v3.1-skripsi` terlihat di GitHub; DOMAIN.md sudah direview |
| **1. Inti data & logika** | 1.1 kerangka monorepo + CI · 1.2 model data & DB · 1.3 mesin status (TDD) · 1.4 API, login, peran | Alur IB → PKB → lahir bisa dicatat lewat API dan lulus tes integrasi |
| **2. UI & dashboard** | 2.0 lapisan data lokal Dexie · 2.1 sistem desain · 2.2 layar HP · 2.3 dashboard admin · 2.4 review UI | Screenshot 360×740 dan 1280×800 di `docs/screenshots/` |
| **3. Identitas QR/tag** | 3.1 kode QR & cetak label · 3.2 pemindai QR | Scan → IB tercatat ≤ 30 detik, offline, diuji di HP sungguhan |
| **4. Offline penuh & server lokal** | 4.1 PWA · 4.2 sinkron tahan konflik · 4.3 mode pos/kelompok (Docker, HTTPS lokal, cadangan) | Tes dua perangkat offline lulus tanpa data hilang/ganda; `docs/INSTALL.md` bisa diikuti non-programmer |
| **5. Pilot** | 5.1 persiapan UAT · 5.2 perbaikan dari umpan balik (mingguan) | Skenario `docs/UAT.md` dijalankan bersama inseminator & peternak |
| **6. Rilis & lanjutan** | 6.1 rilis v1.0 open-source · 6.2 analitik & laporan · 6.3 ekspor iSIKHNAS | GitHub Release v1.0; S/C & CR cocok dengan hitungan manual |

Dependensi di luar stack CLAUDE.md yang direncanakan (dikonfirmasi lagi saat
langkahnya dikerjakan): ZXing (cadangan pemindai, 3.2), Docker Compose + Caddy
(0.3, 4.3), argon2 atau bcrypt (1.4), fake-indexeddb (tes 2.0).

## 10. Pengujian

- **Unit (Vitest)**: semua fungsi `packages/shared`, ditulis TDD, termasuk event
  tidak berurutan, event "perlu dicek", dan batas tenggat (tepat 3/9 bulan).
- **Integrasi API**: alur permintaan IB → verifikasi → penugasan → laporan IB →
  PKB bunting → lahir.
- **E2E (Playwright)**: catat event dalam mode offline lalu sinkron; dua perangkat
  offline mengubah data yang sama.
- Kasus uji black box dari skripsi dijadikan skenario UAT (`docs/UAT.md`).

## 11. Pertanyaan terbuka

1. Apakah peternak login sendiri, atau dicatat oleh admin kelompok/inseminator?
2. Eartag resmi: format nasional apa yang dipakai di wilayah pilot?
3. Apakah tenggat operasional legacy (petugas merespons dalam 30 menit, laporan
   dalam 24 jam) masih dibutuhkan?
4. Lisensi v1.0: MIT (seperti versi skripsi) atau AGPL-3.0?
5. Nama aplikasi PWA: "IB Ternak" atau nama lain?
