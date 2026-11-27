# Sinkronisasi HP ↔ server (langkah 4.2)

Rancangan ini disetujui sebelum implementasi. Sinkron sederhana dari langkah 2.0 diganti
dengan push/pull berbatch dan aturan konflik di bawah. Keputusan pemilik proyek: konflik profil
per kolom, event "perlu dicek" disimpan di HP dan server, peringatan dari data HP lain tetap
disimpan (kejanggalan tampil di profil).

## 1. Prinsip
1. **HP adalah tempat kerja.** Semua penulisan masuk ke Dexie dan outbox dalam satu transaksi (sudah berjalan). Server menjadi sumber kebenaran bersama setelah sinkron.
2. **Tidak ada data yang hilang tanpa jejak.** Perubahan yang kalah atau ditolak tetap tersimpan:
   - di `audit_logs` untuk profil;
   - di `sync_changes` untuk event perlu dicek dan perubahan yang ditolak.
3. **Tidak ada data ganda.** Setiap baris punya id dari perangkat (`uuidv7`), dan setiap perubahan punya *id perubahan* (= id entri outbox). Kiriman ulang dikenali dari id itu.

## 2. Alur

```text
HP (Dexie)                                  Server
──────────                                  ──────
tulis baris + outbox (1 transaksi)
        │  push: ≤ 50 perubahan FIFO
        ├────────── POST /api/sync/push ──────────▶ untuk tiap perubahan, berurutan:
        │                                            1. id perubahan sudah ada di sync_changes?
        │                                               → kembalikan hasil lama (idempoten)
        │                                            2. jalankan lewat route REST yang sama
        │                                               (otorisasi + validasi tidak diduplikasi)
        │                                            3. simpan hasil di sync_changes
        ◀──────────── hasil per perubahan ─────────┤
tandai outbox: selesai / perlu dicek / tidak diterima
        │  pull: halaman demi halaman
        ├──── GET /api/sync/pull?cursor=&scope= ──▶ baris berubah dalam cakupan pengguna,
        ◀──── { rows, cursor, hasMore, scope } ────┤ urut (updated_at, tabel, id), ≤ 500/halaman
upsert ke Dexie, kecuali baris yang masih
punya perubahan lokal (pending / perlu dicek)
```

**Pemicu sinkron:**
- setelah setiap penulisan;
- saat sinyal kembali (event `online`, tanpa menunggu backoff);
- setiap 60 detik;
- tombol "Kirim sekarang".

Push selalu dijalankan sebelum pull.

## 3. `POST /api/sync/push`
- **Request:**
  ```text
  { changes: [{ id, kind, method, path, body, at }] }
  ```
  - Bentuknya sama dengan entri outbox sekarang.
  - Maksimal 50 perubahan.
  - `at` = waktu perubahan dibuat di HP.
- **Daftar putih `kind` → (method, pola path):** `farmer.create/update`, `animal.create/update`, `event.create`, `tag.attach/remove`, `qrCode.reserve`, dan `serviceRequest.*`. Path di luar pola ditolak, jadi push tidak bisa dipakai untuk memanggil endpoint lain (mis. `/api/users`).
- **Hasil per perubahan:**

  | Hasil | Arti | HP |
  | --- | --- | --- |
  | `applied` | Diterima (termasuk kiriman ulang) | Hapus dari outbox, simpan versi server |
  | `merged` | Profil: sebagian kolom kalah oleh versi lebih baru | Hapus dari outbox; pull membawa versi gabungan |
  | `needs_review` | Event ditolak karena urutan riwayat tidak masuk akal | Tetap disimpan, tampil "Perlu dicek" |
  | `rejected` | Ditolak karena alasan lain (izin, data tidak ada, permintaan sudah ditugaskan, kode QR bentrok) | Tampil "Tidak diterima" + alasan |

- Gangguan server (5xx) atau perubahan yang belum diproses: tidak ada hasil untuk perubahan itu. HP mencoba lagi dengan backoff.
- `401` untuk seluruh request: berhenti, perlu masuk lagi.
- **Idempoten:** tabel `sync_changes` menyimpan `id` perubahan, pengguna, perangkat, `kind`, id baris, hasil, kode, pesan, dan (untuk `needs_review`) isi perubahannya. Perubahan dengan id yang sama tidak dijalankan dua kali.

## 4. `GET /api/sync/pull?cursor=&scope=&limit=`
- Mengembalikan baris yang berubah sejak `cursor`, dalam cakupan pengguna (aturan cakupan sama dengan sekarang). Tabel yang ditarik:
  - locations, farmers, animals, animalTags, qrCodes;
  - events, serviceRequests, assignments, semenStock;
  - users, auditLogs (khusus admin), syncReviews.
- **Paginasi:** urut `(updated_at, urutan tabel, id)`. `cursor` = posisi baris terakhir (teks buram), `limit` bawaan 500, `hasMore` menandai masih ada halaman berikutnya. HP menyimpan cursor setelah setiap halaman dalam transaksi yang sama, jadi bila terputus, pull dilanjutkan dari halaman itu.
- **Waktu server monoton:** `now()` di server tidak pernah mundur atau sama (+1 ms bila perlu). Dengan begitu cursor tanpa margin tidak melewatkan baris.
- **Cakupan berubah**, misalnya petugas mendapat penugasan di desa baru atau peternak pindah kelompok:
  - Server menghitung `scope` = hash daftar peternak, permintaan, dan pemegang straw yang terlihat.
  - Bila berbeda dari `scope` yang dikirim HP, server mengulang dari awal (`reset: true`).
  - Setelah halaman terakhir, HP menghapus baris lama yang tidak lagi terlihat, kecuali yang masih punya perubahan lokal.
- **Penghapusan** = soft delete (`deleted_at` terisi). Baris terhapus ikut dikirim agar HP ikut menghapusnya.

## 5. Aturan konflik

| Data | Aturan |
| --- | --- |
| **Event** (BH, IB, PKB, KGG, LH, BB, HEALTH, EXIT) | **Selalu ditambahkan, tidak pernah ditimpa.** Koreksi = event baru dengan `voidsEventId`. Dua HP mencatat event yang sama → dua event berbeda (id berbeda), keduanya disimpan; kiriman ulang dari HP yang sama tidak menggandakan (id sama). |
| Event **error** urutan (dari `validateNextEvent`, mis. IB pada sapi yang sudah dinyatakan bunting oleh HP lain) | **Perlu dicek.** Event tidak masuk riwayat server, tetapi disimpan utuh di `sync_changes` (`needs_review`) beserta alasannya. Muncul di HP pencatat dan di admin kelompok. Penyelesaian: **Kirim ulang** (mis. setelah event lain dikoreksi), **Ubah tanggal lalu kirim**, atau **Buang** (tercatat, tidak dihapus). |
| Event **peringatan** baru akibat data HP lain | **Disimpan.** Kejanggalan tampil di profil ternak (anomali riwayat yang sudah ada). |
| **Profil** peternak & ternak (nama, HP, alamat, rumpun, tanggal lahir, …) | **Per kolom, versi terbaru menang** berdasarkan waktu ubah di HP (`at`). Server menyimpan waktu ubah tiap kolom (`field_times`). Kolom yang diubah satu HP saja selalu dipakai. Kolom yang diubah dua HP memakai yang lebih baru. Nilai yang kalah dicatat di `audit_logs` (`action: 'conflict'`, `before` = nilai yang kalah, `after` = nilai yang dipakai). Penimpaan biasa tetap tercatat sebagai `update` beserta nilai lamanya. HP hanya mengirim kolom yang benar-benar diubah (form yang mengirim semua kolom akan membuat kolom yang tidak diubah ikut "menang"). |
| **Waktu HP salah** | `at` dari masa depan dipotong menjadi waktu server; perubahan dengan jam mundur jauh tetap diproses, hanya kalah bila bentrok. |
| **Hapus** (soft delete, admin) | Hapus menang atas ubah yang datang belakangan: ubah itu `rejected` ("tidak ditemukan") dan isi aslinya tetap tersimpan di `sync_changes`. Tidak ada pemulihan otomatis. |
| **Permintaan layanan** (terima, tugaskan, ganti petugas, tolak) | Mengikuti alur status: yang pertama sah menang, aksi kedua yang sama dianggap sudah terjadi (`applied`), dan aksi yang bertentangan `rejected` dengan alasan, mis. "Sudah ditugaskan ke Rina". |
| **Tag & kode QR** | Kode unik secara global (aturan 3.1). Tag yang bentrok `rejected`, label ditandai "jangan dipakai". |

## 6. Di HP
- **Outbox** mendapat status ketiga `needs_review`, di samping `pending` dan `rejected`. Event yang perlu dicek tidak dihitung dalam status reproduksi dan jadwal, tetapi tampil di riwayat dengan tanda "Perlu dicek".
- **Indikator sinkron**:
  - "Semua data terkirim";
  - "Mengirim N catatan";
  - "Tanpa sinyal, N belum terkirim";
  - "N perlu dicek" (warna peringatan);
  - "N tidak diterima";
  - "Masuk lagi".

  Ketuk indikator → halaman **Data belum terkirim**.
- **Halaman "Data belum terkirim"** (`/data-belum-terkirim`, juga dari Lainnya) punya tiga bagian:
  - **Menunggu dikirim**, beserta tombol **Coba kirim sekarang**;
  - **Perlu dicek**: alasan dalam bahasa sederhana, ringkasan event, tombol **Ubah tanggal**, **Kirim ulang**, **Buang**, dan tautan ke sapinya;
  - **Tidak diterima**: alasan + **Tutup**.

  Saat kosong: "Semua catatan sudah terkirim".
- **Admin** melihat "Catatan perlu dicek" dari petugas di wilayahnya di halaman Tindak lanjut (dari tabel `syncReviews` hasil pull), dan bisa **Buang** dengan alasan.

## 7. Yang belum dicakup
- Penggabungan tiga arah untuk teks panjang: aturannya hanya per kolom.
- Pemulihan data yang terhapus.
- Sinkron antar-server (mode pos/kelompok, langkah 4.3).
- Foto ternak: tetap lokal (rencana Fase 4 berikutnya).

## 8. Implementasi (langkah 4.2)

| Bagian | Berkas |
| --- | --- |
| Fungsi murni: penggabungan per kolom, cursor, sidik jari cakupan, skema push/pull | `packages/shared/src/sync/` |
| Push, pull, buang catatan perlu dicek | `apps/server/src/routes/sync.ts`, cakupan di `apps/server/src/sync/visibility.ts` |
| Konflik profil per kolom | `updateProfile` di `apps/server/src/routes/helpers.ts`, tabel `field_versions` |
| Jejak perubahan + event perlu dicek | tabel `sync_changes` (migrasi `0003`) |
| Jam server monoton | `monotonicClock` di `apps/server/src/app.ts` |
| Engine HP (batch push, pull berhalaman, reset cakupan) | `apps/web/src/data/sync/engine.ts` |
| Kirim ulang / buang | `repo.retryReview`, `repo.discardReview`, `repo.discardServerReview` |
| Halaman | `apps/web/src/pages/sync-queue.tsx` (`/data-belum-terkirim`), bagian di Tindak lanjut |

Tes:
- `packages/shared/src/sync/sync.test.ts`
- `apps/server/src/test/sync-push.test.ts`
- `apps/server/src/test/sync.test.ts`
- `apps/web/src/data/sync/engine.test.ts`
- `apps/web/src/data/sync-queue.test.ts`
- `apps/web/e2e/two-devices.spec.ts`: dua HP offline, lalu online bergantian. Hasilnya diperiksa di server dan di IndexedDB kedua HP.
