# Prompt Claude Code — Rebuild IB Admin System

Urutan prompt siap-salin untuk vibe coding dengan Claude Code, mengikuti roadmap di [`docs/PLAN.md`](PLAN.md). Jalankan berurutan; satu prompt = satu sesi kerja = satu commit atau lebih.

## Cara kerja

Kunci vibe coding yang tidak berantakan: **CLAUDE.md sebagai ingatan proyek, satu prompt per sesi, dan selalu minta rencana dulu untuk pekerjaan besar.**

1. Taruh `CLAUDE.md` (bagian berikutnya) di root repo sebelum prompt pertama. Claude Code membacanya otomatis di setiap sesi.
2. Untuk prompt bertanda **\[Rencana dulu\]**, aktifkan plan mode atau biarkan kalimat "tunggu persetujuan saya" di prompt. Baca rencananya, koreksi, baru setujui.
3. Satu prompt per sesi. Setelah selesai dan sudah di-commit, mulai sesi baru (`/clear`) supaya konteks tetap bersih.
4. Setelah setiap prompt: jalankan aplikasinya sendiri, coba di browser, lalu commit. Jangan menumpuk banyak prompt tanpa commit.
5. Jika hasilnya melenceng, jangan tambal dengan prompt beruntun. Kembalikan dengan `git restore`/`git reset`, perjelas prompt, ulangi.
6. Centang prompt di dokumen ini saat selesai, supaya tahu posisi terakhir.

Semua prompt ditulis dalam Bahasa Indonesia; Claude Code memahaminya. Bagian dalam kurung siku `[...]` diisi sendiri.

## CLAUDE.md

Salin isi ini ke file `CLAUDE.md` di root repo (filenya juga saya kirim di chat). Perbarui bagian "Stack" dan "Perintah" jika ada yang berubah selama pengembangan.

```markdown
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
```

## Langkah 0 — Mengabadikan versi skripsi

Sebelum membangun yang baru, versi skripsi dibekukan dengan rapi: tetap bisa dibuka, dijalankan, dan dikenang. Langkah manual dulu: unduh tab utama dokumen ini sebagai Markdown, simpan sebagai `docs/PLAN.md`, dan taruh `CLAUDE.md` di root repo.

- [x] **0.1 Arsipkan versi skripsi**

  > Selesai. Catatan: tag `v3.1-skripsi` dibuat di commit `be16724` tetapi belum ada di GitHub (sesi Claude Code tidak diizinkan push tag); buat manual lewat Releases.

```text
Ini repo skripsi saya. Sebelum rebuild, saya ingin mengabadikan versi skripsi dengan rapi.

Lakukan:
1. Buat tag git `v3.1-skripsi` pada commit saat ini.
2. Pindahkan `ib-backend/` dan `ib-frontend/` ke `legacy/backend/` dan `legacy/frontend/` memakai `git mv` supaya riwayat tetap ada.
3. Buat `legacy/README.md` berisi: judul skripsi, nama saya (Muhammad Khalil Adha, Ilmu Komputer IPB, lulus November 2025), pembimbing (Lailan Sahrina Hasibuan), ringkasan singkat fitur versi ini, teknologi (React + Vite, Express, PostgreSQL), dan cara menjalankannya secara lokal.
4. Buat `docs/skripsi/README.md` berisi abstrak (saya tempel di bawah) dan tempat untuk tautan PDF skripsi.
5. Jangan mengubah isi kode di dalam `legacy/` selain memindahkan folder.

Abstrak:
[tempel abstrak skripsi di sini]

Tunjukkan daftar perubahan sebelum commit, lalu commit dengan pesan `chore: archive thesis version to legacy/`.
```

- [x] **0.2 Ekstrak pengetahuan domain dari kode lama** \[Rencana dulu\]

  > Selesai: [`docs/legacy/DOMAIN.md`](legacy/DOMAIN.md) dan [`docs/legacy/schema.sql`](legacy/schema.sql). Masih perlu dibaca dan dikoreksi sendiri.

```text
Baca seluruh kode di `legacy/` (tanpa mengubahnya). Saya butuh dokumen referensi untuk rebuild.

Buat `docs/legacy/DOMAIN.md` berisi:
1. Rekonstruksi skema database (tabel `users`, `requests`, `checkups`, `activity_logs`, dan lainnya) beserta kolom yang dipakai di query, dalam bentuk SQL `CREATE TABLE` di `docs/legacy/schema.sql`.
2. Daftar semua nilai status yang muncul di kode, dan transisi antar status (siapa memicu, endpoint apa) sebagai diagram Mermaid state machine.
3. Daftar endpoint API lama: method, path, peran pengguna, fungsi.
4. Aturan bisnis: pengingat 3 bulan dan 9 bulan, flag otomatis, penugasan checkup.
5. Daftar masalah yang ditemukan (keamanan, bug, inkonsistensi) sebagai catatan, bukan untuk diperbaiki di legacy.

Tunjukkan rencana struktur dokumen dulu dan tunggu persetujuan saya.
```

- [x] **0.3 (Opsional, nostalgia) Jalankan lagi versi lama**

  > Selesai: `legacy/docker-compose.yml` + `legacy/seed/seed.sql`; perubahan kode lama dicatat di `legacy/README.md`.

```text
Saya ingin menjalankan versi skripsi di `legacy/` sekali lagi untuk dokumentasi.
Buat `legacy/docker-compose.yml` yang menjalankan PostgreSQL, memuat `docs/legacy/schema.sql` beserta data contoh fiktif (1 admin, 2 petugas, 5 permintaan IB dengan status berbeda), lalu menjalankan backend dan frontend lama.
Perubahan pada kode lama hanya boleh berupa konfigurasi lewat environment variable (koneksi database, base URL), dan catat setiap perubahan di `legacy/README.md`.
```

Cek setelah Langkah 0: tag `v3.1-skripsi` terlihat di GitHub, dan `docs/legacy/DOMAIN.md` sudah kamu baca serta koreksi sendiri. Dokumen inilah yang dipakai Claude Code sebagai acuan di Fase 1.

## Fase 1 — Inti data & logika

Fase ini membangun fondasi yang menentukan semua fase berikutnya, jadi semua prompt di sini meminta rencana dulu. Hasil akhirnya: siklus IB → PKB → lahir bisa dicatat lewat API dan dites otomatis.

- [ ] **1.1 Kerangka monorepo** \[Rencana dulu\]

```text
Baca CLAUDE.md dan docs/PLAN.md. Buat kerangka monorepo baru di root repo (jangan sentuh `legacy/`) sesuai bagian Stack di CLAUDE.md:
- pnpm workspace dengan `apps/web`, `apps/server`, `packages/shared`
- TypeScript strict, ESLint + Prettier, Vitest di semua paket
- `apps/web`: React + Vite + Tailwind + shadcn/ui, satu halaman "Halo" yang memanggil endpoint `/api/health`
- `apps/server`: Hono + endpoint `GET /api/health`
- Skrip root: `pnpm dev` (web + server bersamaan), `pnpm test`, `pnpm typecheck`, `pnpm lint`
- GitHub Actions yang menjalankan typecheck, lint, test di setiap push dan pull request
- README root baru (singkat) yang menjelaskan proyek ini rebuild dari skripsi dan menautkan `legacy/README.md`

Tunjukkan struktur folder dan daftar dependensi dulu, tunggu persetujuan saya, baru kerjakan. Di akhir jalankan semua skrip dan laporkan hasilnya.
```

- [ ] **1.2 Model data & database** \[Rencana dulu\]

```text
Baca CLAUDE.md, docs/PLAN.md bagian "Model data inti", dan docs/legacy/DOMAIN.md.
Rancang skema baru yang berpusat pada ternak memakai Drizzle ORM + SQLite di `apps/server`, dengan tipe dan skema Zod di `packages/shared`:
- users (peran: farmer, inseminator, group_admin, agency_admin), farmers, locations, animals, animal_tags (QR, eartag resmi, riwayat pasang/cabut), events (BH, IB, PKB, KGG, LH, BB, HEALTH, EXIT dengan kolom payload JSON tervalidasi Zod per jenis), service_requests, assignments, semen_stock, audit_logs
- Semua id berupa UUID yang bisa dibuat di perangkat (penting untuk offline nanti); setiap baris punya created_at, updated_at, deleted_at, dan device_id
- Migrasi + skrip `pnpm db:migrate` dan `pnpm db:seed` dengan data fiktif: 1 dinas, 2 kelompok, 3 inseminator, 10 peternak, 40 sapi dengan riwayat event yang beragam

Tunjukkan rancangan tabel (diagram Mermaid ER) dan contoh payload tiap jenis event dulu. Tunggu persetujuan saya.
```

- [ ] **1.3 Mesin status reproduksi** \[Rencana dulu\]

```text
Di `packages/shared/src/domain/`, buat logika murni (tanpa database, tanpa UI) untuk menghitung status reproduksi seekor sapi dari daftar event-nya.
- Fungsi `deriveReproStatus(events)` mengembalikan status seperti: kosong, birahi, sudah_IB_menunggu_PKB, bunting (dengan umur kebuntingan), keguguran, sudah_lahir, beserta event terakhir yang relevan
- Fungsi `validateNextEvent(events, newEvent)` menolak urutan yang tidak masuk akal (misalnya LH tanpa PKB bunting, IB pada sapi yang sedang bunting) dengan pesan Bahasa Indonesia
- Fungsi `computeSchedule(events, today)`: perkiraan birahi berikutnya, jadwal PKB, perkiraan lahir, dan pengingat terlambat (aturan 3 dan 9 bulan dari skripsi). Semua angka hari diambil dari satu file konstanta
- Sesuaikan dengan aturan dan transisi di docs/legacy/DOMAIN.md; jika ada yang berbeda, jelaskan alasannya

Tulis tes dulu (TDD) yang mencakup alur normal dan alur gagal, lalu implementasinya. Tunjukkan daftar kasus uji sebelum menulis kode.
```

- [ ] **1.4 API, login, dan peran**

```text
Bangun API di `apps/server` memakai skema dan logika dari `packages/shared`:
- Login dengan email/no. HP + password (hash argon2 atau bcrypt), sesi cookie httpOnly; endpoint logout dan `me`
- Middleware otorisasi per peran; peternak hanya melihat ternaknya sendiri, inseminator melihat tugas dan wilayahnya, admin melihat kelompok/dinasnya
- CRUD peternak, ternak, tag; tambah event (wajib lolos `validateNextEvent`); permintaan layanan + penugasan petugas + ganti petugas
- Endpoint `GET /api/animals/:id/timeline` dan `GET /api/reminders` yang memakai `computeSchedule`
- Semua input divalidasi Zod, error dalam format JSON yang konsisten, dokumentasi OpenAPI otomatis di `/api/docs`
- Tes integrasi untuk alur lengkap: permintaan IB → verifikasi → penugasan → laporan IB → PKB bunting → lahir

Jalankan semua tes di akhir dan laporkan hasilnya.
```

## Fase 2 — UI baru & dashboard responsif

Prompt 2.0 sengaja ditaruh sebelum layar apa pun: web membaca dan menulis ke database lokal di HP sejak awal, supaya offline di Fase 4 tinggal menyempurnakan sinkronisasi, bukan membongkar ulang.

- [ ] **2.0 Lapisan data lokal di web** \[Rencana dulu\]

```text
Di `apps/web`, buat lapisan data local-first memakai Dexie (IndexedDB):
- Tabel lokal yang mencerminkan tabel server yang dibutuhkan web, plus tabel `outbox` untuk perubahan yang belum terkirim
- Semua komponen membaca data lewat hook (misalnya `useAnimals`, `useAnimalTimeline`) yang membaca dari Dexie, BUKAN langsung dari API
- Semua penulisan: simpan ke Dexie + masukkan ke `outbox`, lalu coba kirim ke server di latar belakang
- Validasi memakai skema Zod dan `validateNextEvent` dari `packages/shared`, sehingga aturan yang sama berlaku offline
- Sinkronisasi sederhana dulu: push outbox dan pull perubahan sejak waktu terakhir; versi lengkap dikerjakan di Fase 4
- Unit test untuk hook dan outbox memakai fake-indexeddb

Jelaskan arsitekturnya dengan diagram singkat dulu dan tunggu persetujuan saya.
```

- [ ] **2.1 Sistem desain & kerangka layout**

```text
Buat sistem desain kecil untuk `apps/web` dengan Tailwind + shadcn/ui:
- Palet warna bernuansa pertanian yang tetap kontras di bawah sinar matahari (cek rasio kontras WCAG AA), mode terang dan mode kontras tinggi
- Tipografi mudah dibaca (ukuran dasar 16px), tombol dan target sentuh minimal 44px
- Kerangka layout responsif: di HP navigasi bawah (Beranda, Ternak, Scan, Tugas, Lainnya); di layar 1024px ke atas sidebar kiri
- Komponen dasar: kartu ternak, badge status reproduksi (warna + ikon + teks, tidak hanya warna), form event, indikator status sinkron (online/offline, jumlah data belum terkirim), tampilan kosong, dan pesan error yang ramah
- Halaman `/dev/komponen` yang menampilkan semua komponen untuk saya review

Gunakan Bahasa Indonesia sederhana untuk semua teks.
```

- [ ] **2.2 Layar HP untuk peternak & inseminator**

```text
Bangun layar mobile-first berikut memakai hook data lokal dari prompt 2.0:
1. Login (email/no. HP + password, opsi PIN untuk perangkat sendiri)
2. Beranda "Hari ini": pengingat dari `computeSchedule` (birahi diperkirakan, PKB jatuh tempo, perkiraan lahir, laporan terlambat), dikelompokkan per desa
3. Daftar ternak: cari nama/kode/eartag, filter status reproduksi
4. Profil ternak: identitas, foto, status saat ini, linimasa riwayat event
5. Form catat event cepat: pilih jenis (BH/IB/PKB/KGG/LH/BB) dengan tombol besar, isian default dari data terakhir, maksimal satu layar tanpa scroll untuk IB
6. Permintaan layanan: peternak mengajukan IB/PKB, inseminator melihat dan menerima tugas

Uji di viewport 360x740 dengan Playwright, ambil screenshot setiap layar ke `docs/screenshots/`, dan tunjukkan ke saya.
```

- [ ] **2.3 Dashboard PC untuk admin**

```text
Bangun tampilan admin (kelompok/dinas) untuk layar 1024px ke atas:
- Ringkasan: jumlah permintaan per status, IB bulan ini, sapi bunting, laporan terlambat
- Tabel permintaan dengan filter, verifikasi/tolak, tugaskan dan ganti petugas (alur dari skripsi)
- Daftar pengingat "perlu ditindaklanjuti" (aturan 3 dan 9 bulan) dengan tombol kirim pengingat lewat WhatsApp (link wa.me dengan pesan terisi otomatis)
- Manajemen pengguna dan peternak
- Log aktivitas per permintaan

Pastikan tetap bisa dipakai (walau lebih sederhana) di layar HP. Ambil screenshot 1280x800 ke `docs/screenshots/`.
```

- [ ] **2.4 Review UI**

```text
Lakukan review UI menyeluruh pada `apps/web`: konsistensi komponen, kontras warna, ukuran target sentuh, label form untuk pembaca layar, teks yang membingungkan atau terlalu teknis untuk peternak, dan tampilan saat data kosong atau error. Buat daftar temuan berurutan dari yang paling penting, perbaiki 10 teratas, lalu tunjukkan screenshot sebelum dan sesudah.
```

## Fase 3 — Identitas QR/tag

Target fase ini: dari scan label sampai event IB tercatat dalam waktu 30 detik atau kurang, tanpa internet. Setelah prompt 3.2, uji pemindai di HP sungguhan; kamera tidak bisa dites dengan benar di laptop.

- [ ] **3.1 Kode QR & cetak label**

```text
Tambahkan identitas QR untuk ternak:
- Kode pendek acak yang mudah dibaca manusia, format `IB-XXXXX` (tanpa huruf yang mirip: O/0, I/1), dibuat di perangkat dan dijamin unik
- QR hanya berisi kode tersebut (boleh dalam bentuk URL `https://[domain]/t/IB-XXXXX` yang bisa diatur lewat env), TIDAK berisi nama atau data pribadi
- Halaman cetak label: pilih ternak (atau buat N kode kosong untuk sapi yang belum terdaftar), tata letak kertas stiker A4 (pilihan 24 atau 40 label per lembar), setiap label berisi QR + kode teks + nama panggilan sapi opsional; memakai CSS print, tanpa server
- Riwayat tag di profil ternak: pasang, ganti (hilang/rusak), cabut
- Tes untuk pembuatan kode dan keunikan
```

- [ ] **3.2 Pemindai QR di aplikasi**

```text
Buat halaman Scan (tombol tengah di navigasi bawah):
- Kamera belakang memakai `BarcodeDetector` bila tersedia, cadangan pustaka ZXing bila tidak
- Hasil scan dicari di database lokal (bekerja offline): jika ditemukan, buka profil ternak dengan tombol cepat "Catat IB", "Catat PKB", "Catat lahir"; jika kode belum terpakai, tawarkan "Daftarkan sapi baru dengan kode ini"
- Alternatif input manual: ketik kode QR atau nomor eartag resmi
- Getar dan bunyi singkat saat berhasil, pesan jelas saat kamera ditolak izinnya
- Mode scan beruntun untuk mendata banyak sapi sekaligus

Berikan juga cara saya menguji di HP lewat jaringan Wi-Fi yang sama (HTTPS lokal diperlukan untuk akses kamera).
```

## Fase 4 — Offline penuh & server lokal

Ini fase paling rawan bug, jadi kerjakan per prompt dan jangan lanjut sebelum tes skenario konflik di 4.2 lulus.

- [ ] **4.1 PWA yang bisa diinstal & berjalan offline**

```text
Jadikan `apps/web` PWA dengan vite-plugin-pwa:
- Manifest (nama "IB Ternak" atau usulkan nama lain, ikon, warna tema), bisa "Tambahkan ke layar utama" di Android
- Service worker menyimpan semua aset aplikasi; aplikasi terbuka dan berfungsi penuh dalam mode pesawat setelah pernah dibuka sekali
- Pemberitahuan saat ada versi baru ("Perbarui sekarang")
- Ukuran bundle awal dijaga kecil; laporkan ukurannya dan saran pengurangannya
- Tes Playwright: buka aplikasi, matikan jaringan, catat event, nyalakan jaringan, pastikan data terkirim
```

- [ ] **4.2 Sinkronisasi dua arah yang tahan konflik** \[Rencana dulu\]

```text
Sempurnakan sinkronisasi antara Dexie dan server:
- Endpoint `POST /api/sync/push` (menerima batch dari outbox, idempoten berdasarkan id perubahan) dan `GET /api/sync/pull?since=` (perubahan sejak versi terakhir, dengan paginasi)
- Aturan konflik: event selalu ditambahkan (tidak pernah ditimpa); data profil (peternak, ternak) memakai versi terbaru berdasarkan updated_at dengan versi lama dicatat di audit_logs; penghapusan berupa soft delete
- Event yang ditolak server karena urutan tidak valid tidak hilang, tetapi ditandai "perlu dicek" dan ditampilkan ke pengguna
- Indikator status sinkron dan halaman "Data belum terkirim" dengan tombol coba lagi
- Tes otomatis: dua perangkat offline mengubah data yang sama lalu sinkron; pastikan tidak ada data hilang atau ganda

Tulis dulu dokumen desain singkat `docs/SYNC.md` berisi alur dan aturan konflik, tunggu persetujuan saya, baru implementasi.
```

- [ ] **4.3 Mode Pos/Kelompok: server di jaringan lokal**

```text
Buat cara mudah menjalankan server di laptop atau mini PC untuk pos IB tanpa internet:
- `docker compose up` yang menjalankan server + menyajikan web build dari origin yang sama, database SQLite di volume
- Skrip instal satu baris untuk Linux (termasuk Raspberry Pi) dan petunjuk untuk Windows
- HTTPS di jaringan lokal (diperlukan untuk kamera dan PWA), misalnya lewat Caddy dengan sertifikat lokal; tulis panduan memasang sertifikat di HP Android langkah demi langkah
- Halaman admin menampilkan alamat IP lokal dan QR untuk membuka aplikasi dari HP
- Cadangan otomatis file SQLite harian ke folder `backups/`, simpan 14 terakhir; perintah pulihkan dari cadangan
- Ekspor/impor seluruh data ke file (JSON + CSV) dari aplikasi
- Panduan `docs/INSTALL.md` dalam Bahasa Indonesia untuk orang yang bukan programmer
```

## Fase 5–6 — Pilot, rilis & fitur lanjutan

Karena proyek ini juga untuk mengenang skripsi, Fase 5 boleh sesederhana mencoba bersama satu inseminator dan beberapa peternak yang kamu kenal. Prompt 6.1 tetap layak dikerjakan apa pun hasil pilotnya, supaya repo enak dilihat dan dicoba orang lain.

- [ ] **5.1 Persiapan pilot lapangan**

```text
Siapkan materi untuk uji coba lapangan (UAT) bersama 1-2 inseminator dan 5-10 peternak:
- Panduan bergambar 1 halaman (HTML siap cetak di `docs/panduan/`) untuk peternak dan untuk inseminator, memakai screenshot dari `docs/screenshots/`
- Mode demo dengan data contoh yang bisa direset, untuk sesi pelatihan
- Formulir umpan balik sederhana di dalam aplikasi (menu Lainnya) yang tersimpan offline dan ikut tersinkron
- Pencatatan pemakaian anonim yang tersimpan lokal (berapa event dicatat, berapa lama mengisi form), bisa diekspor admin, TANPA dikirim ke pihak luar
- Skenario UAT di `docs/UAT.md`, diturunkan dari skenario uji end-to-end skripsi
```

- [ ] **5.2 Perbaikan dari umpan balik** (ulangi tiap minggu pilot)

```text
Ini catatan umpan balik dari pilot minggu ini:
[tempel catatan: keluhan, permintaan, bug]

Kelompokkan menjadi bug, kebingungan UI, dan permintaan fitur. Usulkan perbaikan untuk setiap kelompok dengan perkiraan besarnya pekerjaan. Kerjakan bug dan kebingungan UI dulu setelah saya setujui; permintaan fitur dicatat sebagai GitHub issue.
```

- [ ] **6.1 Rilis v1.0 open-source**

```text
Siapkan rilis v1.0:
- README root yang menarik: apa ini, screenshot HP dan PC, fitur, cara mencoba (demo + docker compose), cara instal di pos IB, bagian "Asal-usul" yang menceritakan proyek ini berawal dari skripsi saya dengan tautan ke `legacy/` dan tag `v3.1-skripsi`
- File LICENSE ([MIT atau AGPL-3.0]), CONTRIBUTING.md, CODE_OF_CONDUCT.md, template issue dan pull request, label `good first issue`
- CHANGELOG.md, nomor versi, dan GitHub Release dengan catatan rilis Bahasa Indonesia
- Periksa keamanan: tidak ada rahasia di repo, dependensi tanpa kerentanan tinggi (`pnpm audit`), header keamanan di server, batas percobaan login
```

- [ ] **6.2 Analitik & laporan**

```text
Tambahkan halaman Laporan untuk admin:
- Service per conception (S/C) dan conception rate (CR) per inseminator, desa, dan periode, dengan definisi rumus ditampilkan di halaman
- Tren permintaan IB per bulan, rata-rata waktu respons petugas (dari permintaan sampai IB)
- Rekap bulanan yang bisa diekspor ke Excel dan PDF
- Semua perhitungan berada di `packages/shared` dan punya unit test dengan data contoh yang hasilnya dihitung manual
```

- [ ] **6.3 Ekspor format iSIKHNAS**

```text
Tambahkan fitur ekspor laporan dalam format teks SMS iSIKHNAS agar petugas bisa melapor ke sistem resmi:
- BH [ID hewan]; IB [ID pemilik] [ID hewan] [ID bull] [batch]; PKB [ID pemilik] [ID hewan] [bulan]; KGG [ID pemilik] [ID hewan] [trimester]; LH [ID pemilik] [ID hewan] [kelamin J/B] [ID anak]; BB [ID pemilik] [ID hewan] [bobot]
- Simpan ID pemilik dan ID hewan iSIKHNAS sebagai kolom opsional di data peternak dan ternak
- Halaman yang menampilkan daftar pesan siap kirim per event yang belum dilaporkan, tombol salin, tandai "sudah dilaporkan"
- Tes untuk setiap format pesan
```

## Prompt darurat

Simpan untuk saat sesuatu rusak atau sesi mulai kacau.

- **Bug**

```text
Ada bug: [jelaskan apa yang saya lakukan, apa yang terjadi, apa yang seharusnya terjadi, pesan error/console].
Jangan langsung memperbaiki. Cari dulu penyebab utamanya, buat tes yang gagal karena bug ini, baru perbaiki sampai tes lulus. Jelaskan penyebabnya dengan singkat.
```

- **Melanjutkan setelah jeda lama**

```text
Saya kembali ke proyek ini setelah jeda. Baca CLAUDE.md, docs/PLAN.md, `git log` 20 commit terakhir, dan status tes. Ringkas: fase mana yang sudah selesai, apa yang setengah jadi, dan usulkan 3 langkah berikutnya. Jangan mengubah kode.
```

- **Review sebelum lanjut fase**

```text
Review semua perubahan sejak tag/commit [isi] seperti reviewer senior: bug, risiko kehilangan data, keamanan, kode yang terlalu rumit, tes yang kurang. Urutkan dari yang paling serius. Jangan memperbaiki apa pun sebelum saya memilih mana yang dikerjakan.
```

- **Memperbarui CLAUDE.md**

```text
Perbarui CLAUDE.md berdasarkan kondisi repo saat ini: perintah yang benar-benar ada, keputusan arsitektur yang sudah diambil, dan kesalahan yang berulang kali terjadi di sesi sebelumnya beserta cara menghindarinya. Tetap ringkas, maksimal 120 baris.
```
