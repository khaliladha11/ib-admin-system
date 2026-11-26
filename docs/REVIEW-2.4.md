# Review UI langkah 2.4

Langkah ini menutup Fase 2 dengan review menyeluruh pada `apps/web`, yang mencakup:
- konsistensi komponen;
- kontras warna;
- target sentuh;
- label form untuk pembaca layar;
- teks yang terlalu teknis bagi peternak;
- tampilan saat data kosong atau error.

Sekaligus diterapkan tema baru dari referensi pemilik proyek: gradasi langit ke lime yang lembut, kartu putih bulat, tombol pil, aksen kuning-lime, judul serif, ilustrasi padang beranimasi, dan ikon sapi.

Semua screenshot dibuat otomatis oleh `apps/web/e2e/review.spec.ts` dengan data contoh fiktif yang diisi ulang:
- `SHOT_PREFIX=2.4-sebelum` diambil sebelum ada perubahan;
- `2.4-sesudah` diambil setelahnya.

## Temuan (urut dari yang paling penting)

| # | Temuan | Dampak | Status |
| --- | --- | --- | --- |
| 1 | **Layar putih saat memuat.** 15 halaman `return null` sampai data di HP terbaca, sehingga di HP murah terlihat macet | Semua | ✅ Diperbaiki |
| 2 | **Tidak ada penangkap error.** Error saat membaca data membuat aplikasi putih total tanpa jalan keluar | Semua | ✅ Diperbaiki |
| 3 | **Istilah teknis**: "Sinkron data", "tersinkron", "ditolak server", "Server menolak data ini", dan pesan mentah seperti "Server menjawab 502" | Peternak | ✅ Diperbaiki |
| 4 | **Pengingat tanpa tindakan.** Peternak melihat "Hasil IB belum dilaporkan" padahal PKB dicatat petugas, dan tidak ada tombol untuk menindaklanjuti | Peternak, petugas | ✅ Diperbaiki |
| 5 | **Ikon tapak kaki** (anjing/kucing) dipakai untuk ternak sapi | Semua | ✅ Diperbaiki |
| 6 | **Pesan error form tidak terbaca pembaca layar**: tanpa `aria-invalid`/`aria-describedby`/`role="alert"` | Pembaca layar | ✅ Diperbaiki |
| 7 | **Tampilan kosong tidak seragam**, dan ruang putih besar di Tugas, Lainnya, Tindak lanjut, dan dashboard | Semua | ✅ Diperbaiki |
| 8 | **Kartu ternak di daftar terlalu tinggi** (±200px): hanya 2–3 sapi per layar | Peternak, petugas | ✅ Diperbaiki |
| 9 | **Komponen tidak seragam.** `Section` ditulis ulang di beberapa file, dengan sudut dan ukuran judul yang bercampur | Konsistensi | ✅ Diperbaiki |
| 10 | **Pindah halaman tidak diumumkan** ke pembaca layar, dan fokus tidak pindah ke judul | Pembaca layar | ✅ Diperbaiki |
| 11 | Chip filter `role="radio"` belum bisa digeser dengan tombol panah | Keyboard | Berikutnya |
| 12 | Format tanggal bercampur ("26 Nov", "26 November 2026", relatif) dalam satu halaman | Kecil | Berikutnya |
| 13 | Label "Scan" bahasa Inggris (dibiarkan karena kata ini lazim) | Kecil | Dicatat |

Ada dua temuan tambahan yang tertangkap oleh pemeriksaan otomatis baru di `review.spec.ts` (semua kontrol ≥ 44×44px dan tanpa scroll ke samping). Keduanya juga sudah diperbaiki:
- tombol status pengiriman yang ringkas di layar form lebarnya hanya **36px**;
- tautan nama sapi di tabel Tindak lanjut tingginya hanya **21px**.

## Cara memperbaiki
1. **Skeleton berkilau** (`components/skeletons.tsx`, Motion) untuk daftar, detail, dashboard, dan form.
2. **`RouteError`** dipasang di setiap rute dan di akar router, berisi pesan ramah, tombol **Muat ulang**, dan **Ke beranda** (`layout/route-error.tsx`).
3. **Bahasa sederhana**: "Pengiriman data", "Kirim dan perbarui sekarang", "Tidak diterima", "Tanpa sinyal", dan "Sedang ada gangguan". Kode gangguan teknis (5xx) tidak lagi ditampilkan.
4. **`reminderAction`** (`lib/reminder-actions.ts`) memberi judul dan tombol sesuai peran:
   - peternak: **Minta PKB**, atau "Sudah lewat perkiraan lahir. Sudah lahir?" dengan **Catat lahir**;
   - petugas: **Catat PKB**.

   Tombol ini dipakai di Hari ini dan di profil ternak.
5. **Ikon sapi** buatan sendiri (`components/icons/cow.tsx`), bergaya garis seperti lucide.
6. **`fieldA11y`** (`lib/a11y.ts`) dipakai di layar Masuk, form permintaan, dan grup pilihan di form catat kejadian. Semua pesan error memakai `role="alert"`.
7. **Ilustrasi padang beranimasi** (`components/illustrations/meadow.tsx`) dengan awan bergeser, matahari berdenyut, pohon bergoyang, dan sapi merumput. Ilustrasi ini dipakai di:
   - layar Masuk dan PIN;
   - tampilan kosong;
   - panel dashboard yang sepi;
   - bagian bawah sidebar PC.
8. **`AnimalCard variant="compact"`** untuk daftar: satu baris nama + status, dan lintasan siklus tipis yang labelnya tetap dibacakan pembaca layar.
9. **`Panel`** dan kelas `.surface` (kartu putih, sudut 2xl, bayangan halus) dipakai di semua halaman.
10. **Pengumuman pindah halaman** (live region "Halaman Tugas"), dan fokus pindah ke judul `<h1>`.

## Sebelum dan sesudah

### HP 360×740

| Layar | Sebelum | Sesudah |
| --- | --- | --- |
| Masuk | ![](screenshots/2.4-sebelum-hp-01-masuk.png) | ![](screenshots/2.4-sesudah-hp-01-masuk.png) |
| Hari ini (petugas) | ![](screenshots/2.4-sebelum-hp-02-hari-ini.png) | ![](screenshots/2.4-sesudah-hp-02-hari-ini.png) |
| Daftar ternak | ![](screenshots/2.4-sebelum-hp-03-ternak.png) | ![](screenshots/2.4-sesudah-hp-03-ternak.png) |
| Pencarian kosong | ![](screenshots/2.4-sebelum-hp-04-cari-kosong.png) | ![](screenshots/2.4-sesudah-hp-04-cari-kosong.png) |
| Profil ternak | ![](screenshots/2.4-sebelum-hp-05-profil.png) | ![](screenshots/2.4-sesudah-hp-05-profil.png) |
| Catat IB (satu layar) | ![](screenshots/2.4-sebelum-hp-06-catat-ib.png) | ![](screenshots/2.4-sesudah-hp-06-catat-ib.png) |
| Tugas (petugas) | ![](screenshots/2.4-sebelum-hp-07-tugas.png) | ![](screenshots/2.4-sesudah-hp-07-tugas.png) |
| Lainnya | ![](screenshots/2.4-sebelum-hp-08-lainnya.png) | ![](screenshots/2.4-sesudah-hp-08-lainnya.png) |
| Ternak tidak ditemukan | ![](screenshots/2.4-sebelum-hp-09-tidak-ditemukan.png) | ![](screenshots/2.4-sesudah-hp-09-tidak-ditemukan.png) |
| Hari ini (peternak) | ![](screenshots/2.4-sebelum-hp-10-hari-ini-peternak.png) | ![](screenshots/2.4-sesudah-hp-10-hari-ini-peternak.png) |
| Permintaan peternak | ![](screenshots/2.4-sebelum-hp-11-tugas-peternak.png) | ![](screenshots/2.4-sesudah-hp-11-tugas-peternak.png) |

### PC 1280×800 (admin)

| Layar | Sebelum | Sesudah |
| --- | --- | --- |
| Ringkasan | ![](screenshots/2.4-sebelum-pc-01-ringkasan.png) | ![](screenshots/2.4-sesudah-pc-01-ringkasan.png) |
| Permintaan | ![](screenshots/2.4-sebelum-pc-02-permintaan.png) | ![](screenshots/2.4-sesudah-pc-02-permintaan.png) |
| Tindak lanjut | ![](screenshots/2.4-sebelum-pc-03-tindak-lanjut.png) | ![](screenshots/2.4-sesudah-pc-03-tindak-lanjut.png) |

## Hasil pemeriksaan
- `pnpm typecheck`, `pnpm lint`: lulus.
- `pnpm test`: 458 tes lulus (shared 129, server 106, web 223). Tes kontras kini mencakup kedua ujung gradasi dan judul serif.
- `pnpm e2e`: 6 alur lulus. Semua 14 layar review lolos cek target sentuh ≥ 44px dan tanpa scroll ke samping.
- `pnpm build`: bundel awal turun dari 588 KB menjadi **323 KB** (100 KB gzip), karena halaman admin dan halaman pengembang kini dimuat saat dibuka.
