# Rencana Rebuild IB Admin System

Dokumen ini adalah rencana kerja rebuild. Prinsip, stack, dan aturan kerja yang
mengikat ada di [`CLAUDE.md`](../CLAUDE.md); dokumen ini menjabarkan *apa* yang
dibangun dan *urutannya*. Status: **draf**, akan diperbarui per milestone.

## 1. Latar belakang

Versi skripsi (V3.1, folder [`legacy/`](../legacy/README.md), tag `v3.1-skripsi`)
berpusat pada **permintaan layanan**: satu baris `requests` menyimpan status teks
bebas (`Menunggu Verifikasi`, `Diproses`, `Berhasil`, `Gagal`, `Selesai`, ...),
laporan sebagai teks, dan flag pengingat yang dihitung ulang lewat endpoint
`POST /api/requests/update-flags`. Hanya ada dua peran (admin dinas, petugas),
harus online, tampilan desktop, dan pemasangan butuh PostgreSQL + skema manual.

Pelajaran dari versi skripsi yang menjadi dasar desain baru:

| Masalah di legacy | Dampak | Arah rebuild |
| --- | --- | --- |
| Status disimpan sebagai teks di `requests.status` | Status bisa tidak konsisten dengan riwayat | Status **dihitung** dari urutan event |
| Data berpusat pada permintaan, bukan ternak | Riwayat reproduksi satu sapi tersebar | **Ternak** sebagai pusat data |
| Flag pengingat disimpan & diperbarui manual (`update-flags`) | Flag basi; ada bug prioritas `OR`/`AND` di kueri pematian flag kelahiran | Pengingat **dihitung** murni dari event + tanggal |
| Tenggat ditulis langsung di SQL (`INTERVAL '3 months'`, `'30 minutes'`, `'24 hours'`) | Sulit diubah, tersebar | Konstanta tunggal di `packages/shared` |
| Kredensial DB & URL API ditulis di kode | Tidak aman, sulit dipasang | Semua lewat `.env` + `.env.example` |
| Tidak ada skema/migrasi di repo | Tidak bisa dipasang ulang | Drizzle migration + seed fiktif |
| Tidak ada tes otomatis (hanya black box manual) | Regresi tidak terdeteksi | Vitest untuk domain, Playwright untuk alur utama |
| Wajib online | Tidak bisa dipakai di kandang/lapangan | Offline-first (Dexie + sinkron) |

## 2. Tujuan & non-tujuan

**Tujuan**
- Mencatat siklus reproduksi sapi (BH, IB, PKB, KGG, LH, BB) tanpa internet.
- Peternak, petugas, dan admin melihat status & pengingat yang sama karena
  dihitung dari data yang sama.
- Pasang dengan satu perintah (SQLite), nyaman di HP Android 5,5 inci.
- Kode event selaras iSIKHNAS agar data mudah dipetakan/ekspor.

**Non-tujuan (untuk sekarang)**
- Integrasi API langsung ke iSIKHNAS (cukup ekspor yang kodenya selaras).
- Aplikasi native; cukup PWA yang bisa dipasang.
- Fitur pembayaran, stok straw/semen, atau penjadwalan rute petugas.
- Migrasi otomatis data dari database PostgreSQL versi skripsi.

## 3. Pengguna & peran

| Peran | Kebutuhan utama |
| --- | --- |
| **Peternak** (owner) | Daftar ternak miliknya, lapor birahi, minta layanan IB, lihat status & pengingat |
| **Petugas / inseminator** | Daftar tugas, catat IB/PKB/kelahiran di lapangan meski offline |
| **Admin kelompok** | Kelola anggota peternak & ternak kelompok, pantau pengingat, rekap kelompok |
| **Admin dinas** | Verifikasi/tugaskan permintaan, kelola petugas & kelompok, rekap wilayah |

Hak akses diatur per peran dan per cakupan (ternak milik sendiri, kelompok,
wilayah dinas). Petugas melihat ternak yang terkait tugasnya.

## 4. Arsitektur

```
apps/web        React + Vite PWA, TanStack Router & Query, Tailwind + shadcn/ui,
                Dexie (IndexedDB) sebagai sumber data lokal, antrean sinkron
apps/server     Hono (Node) REST API, Zod, Drizzle ORM, SQLite (better-sqlite3);
                PostgreSQL opsional lewat env
packages/shared Tipe domain, skema Zod, konstanta, state machine, pengingat,
                statistik — dipakai web DAN server, ditulis sekali
```

Aturan ketergantungan: `apps/*` boleh mengimpor `packages/shared`; `shared`
tidak mengimpor apa pun dari `apps/*` dan bebas dari I/O (fungsi murni), agar
logika domain bisa diuji tanpa database dan berjalan sama di HP maupun server.

## 5. Model data

Entitas inti (nama tabel Bahasa Inggris):

- `owners` — peternak (nama, desa/kelompok, kontak opsional)
- `groups` — kelompok ternak; `regions` — wilayah dinas
- `users` — akun login dengan `role` (`owner`, `inseminator`, `group_admin`, `agency_admin`)
- `animals` — ternak: ID/eartag, nama, jenis kelamin, bangsa, tanggal lahir, `owner_id`, `dam_id` (induk, opsional)
- `events` — **log tambah-saja** (append-only) per ternak:
  - kolom umum: `id` (UUID dari klien), `animal_id`, `type`, `occurred_at`,
    `recorded_by`, `recorded_at`, `payload` (JSON tervalidasi Zod per tipe),
    `voided_by` (koreksi = event pembatal, bukan edit/hapus)
- `service_requests` — permintaan layanan IB/PKB/kelahiran: ternak, peminta,
  petugas yang ditugaskan, status alur kerja (lihat §6.2), event hasil yang terkait

Payload per tipe event:

| Kode | Arti | Payload |
| --- | --- | --- |
| `BH` | Birahi | catatan opsional |
| `IB` | Inseminasi buatan | `strawCode`, `sireId`, `batch`, ke-berapa (dihitung) |
| `PKB` | Pemeriksaan kebuntingan | `result` (bunting/tidak), `fetalAgeMonths` |
| `KGG` | Keguguran | `trimester` (1–3) |
| `LH` | Lahir | `calfSex`, `calfAnimalId` (membuat ternak baru) |
| `BB` | Berat badan | `weightKg` |

## 6. Logika domain (`packages/shared`)

### 6.1 Status reproduksi ternak (dihitung)

Fungsi murni `deriveReproStatus(events, now) → status` dari urutan event yang
tidak dibatalkan, diurutkan `occurred_at`:

```
           BH            IB             PKB+ (bunting)        LH
 Kosong ───────► Birahi ────► Di-IB ─────────────► Bunting ─────► Kosong (nifas)
   ▲                            │ PKB− (tidak bunting)  │ KGG
   └────────────────────────────┴───────────────────────┘
```

- Event yang tidak valid untuk status saat ini (mis. `LH` tanpa bunting)
  **tetap disimpan** tetapi ditandai sebagai anomali untuk ditinjau, karena
  data lapangan offline bisa datang tidak berurutan.
- `BB` tidak mengubah status reproduksi.

### 6.2 Status permintaan layanan

Dari legacy (`Menunggu Verifikasi → Menunggu Penugasan → Diproses → Berhasil/Gagal → Selesai`,
plus `Ditolak`), disederhanakan menjadi alur kerja yang jelas:
`submitted → assigned → in_progress → done | rejected | cancelled`.
Hasil biologis (bunting/tidak) **bukan** status permintaan; itu ada di event PKB.

### 6.3 Konstanta (satu file, bisa diubah)

```ts
ESTRUS_CYCLE_DAYS = 21
GESTATION_MONTHS_MIN = 9, GESTATION_MONTHS_MAX = 10
IB_RESULT_REPORT_DUE_MONTHS = 3      // dari skripsi
BIRTH_REPORT_DUE_MONTHS = 9          // dari skripsi, sejak dinyatakan bunting
```

Tenggat operasional legacy (petugas belum memproses > 30 menit, laporan IB awal
> 24 jam) dievaluasi ulang bersama pengguna sebelum dipakai (§11).

### 6.4 Pengingat (dihitung, tidak disimpan)

`deriveReminders(animal, events, now) → Reminder[]`:
- **Hasil IB belum dilaporkan**: ada `IB` dan belum ada `PKB` setelahnya > 3 bulan.
- **Kelahiran/keguguran belum dilaporkan**: `PKB` bunting dan belum ada `LH`/`KGG`
  > 9 bulan setelahnya.
- **Perkiraan birahi berikutnya**: `BH`/`IB` terakhir + 21 hari bila belum bunting.
- **Perkiraan lahir**: rentang 9–10 bulan dari `IB` yang dikonfirmasi bunting.

### 6.5 Statistik

Fungsi murni untuk rekap: jumlah IB, *service per conception* (S/C),
*conception rate*, jarak beranak (*calving interval*), per periode & per
kelompok/wilayah. Definisi rumus ditulis di dokumen terpisah saat milestone M5.

## 7. Offline-first & sinkronisasi

- Web menulis ke **Dexie lebih dulu**, UI membaca dari Dexie; jaringan tidak
  pernah memblokir pencatatan.
- Setiap rekaman memakai UUID buatan klien → tidak ada bentrok ID.
- **Antrean keluar** (outbox) dikirim saat online; server idempoten berdasarkan ID.
- **Tarik perubahan** pakai kursor `updated_since` per cakupan pengguna.
- Konflik: event bersifat tambah-saja sehingga hampir tidak ada konflik; untuk
  data master (ternak, peternak) pakai *last-write-wins* per field + log audit.
- UI menampilkan status sinkron yang jelas ("Tersimpan di HP", "Terkirim").

## 8. UI/UX

- Target HP Android 5,5 inci; target sentuh ≥ 44px; kontras tinggi untuk luar ruangan.
- Bahasa Indonesia sederhana; istilah sesuai §"Istilah domain" di CLAUDE.md.
- Layar inti: Beranda (pengingat hari ini), Daftar Ternak, Detail Ternak
  (status + linimasa event), Catat Event (form per kode), Permintaan, Rekap (PC).
- Formulir pendek, isian bawaan tanggal hari ini, bisa dipakai satu tangan.

## 9. Milestone

| # | Isi | Selesai bila |
| --- | --- | --- |
| **M0** | Kerangka monorepo pnpm, TS strict, lint, Vitest, Playwright, CI, `.env.example`, `pnpm dev` | `pnpm typecheck && pnpm lint && pnpm test` hijau di CI |
| **M1** | `packages/shared`: skema Zod event, konstanta, `deriveReproStatus`, `deriveReminders` + unit test lengkap | Cakupan tes logika domain ≥ 90% |
| **M2** | Server: Drizzle schema & migrasi SQLite, seed fiktif, API ternak/event/auth | `pnpm db:migrate && pnpm db:seed` jalan dari nol |
| **M3** | Web offline: Dexie, daftar & detail ternak, catat event, PWA bisa dipasang | Catat event dalam mode pesawat, tetap ada setelah reload |
| **M4** | Sinkronisasi dua arah + permintaan layanan & penugasan petugas | Tes e2e: dua perangkat offline → online → data sama |
| **M5** | Rekap & statistik untuk admin kelompok/dinas, ekspor CSV berkode iSIKHNAS | Angka rekap cocok dengan perhitungan manual pada seed |
| **M6** | Opsi PostgreSQL, dokumentasi pemasangan, rilis `v4.0.0` | Pemasangan bersih mengikuti README saja |

## 10. Pengujian

- **Unit (Vitest)**: semua fungsi `packages/shared` wajib dites, termasuk kasus
  event tidak berurutan, event dibatalkan, dan batas tenggat (tepat 3/9 bulan).
- **API**: tes handler Hono dengan SQLite in-memory.
- **E2E (Playwright)**: alur peternak lapor birahi → petugas catat IB offline →
  sinkron → pengingat hasil IB muncul setelah 3 bulan (jam dipalsukan).
- Kasus uji black box dari skripsi dijadikan daftar periksa regresi.

## 11. Pertanyaan terbuka

1. Apakah peternak login sendiri, atau dicatat oleh admin kelompok/petugas?
2. Format ID ternak: eartag nasional, nomor kelompok, atau keduanya?
3. Apakah tenggat operasional legacy (30 menit / 24 jam) masih dibutuhkan?
4. Notifikasi pengingat: cukup di dalam aplikasi, atau perlu push/WhatsApp?
5. Hosting untuk dinas: server lokal di kantor, atau satu server bersama?
6. Lisensi rebuild tetap MIT?
