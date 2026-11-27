# Uji coba lapangan (UAT) IB Ternak

Panduan untuk uji coba bersama **1–2 inseminator dan 5–10 peternak**, dipandu admin kelompok/dinas.
Skenario diturunkan dari alur bisnis versi skripsi yang dianalisis di
[`docs/legacy/DOMAIN.md`](legacy/DOMAIN.md) (state machine §2, aturan bisnis §4, masalah §5).
Kolom **Rujukan** menunjuk bagian DOMAIN.md. Kolom **Masalah lama** menunjuk masalah S*/B*/I* yang
seharusnya tidak muncul lagi. Tabel uji black box dari naskah skripsi belum ada di repo; bila
tersedia, cocokkan nomornya di kolom Catatan.

Bahan pendukung:

- Panduan satu halaman untuk dicetak: [`docs/panduan/peternak.html`](panduan/peternak.html) dan
  [`docs/panduan/inseminator.html`](panduan/inseminator.html) (cara cetak di
  [`docs/panduan/README.md`](panduan/README.md)).
- Pemasangan server pos: [`docs/INSTALL.md`](INSTALL.md), bagian "Server latihan (mode demo)".
- Uji di HP sungguhan (kamera, HTTPS): [`docs/UJI-HP.md`](UJI-HP.md).

## 1. Persiapan (H-3 sampai H-1)

| Langkah | Siapa | Selesai |
| --- | --- | --- |
| Pasang server latihan dengan `DEMO_MODE=1` (lihat INSTALL.md). Data contoh fiktif terisi otomatis. | Admin | ☐ |
| Buka `https://<alamat-pos>` dari HP admin: pita kuning "Mode latihan" tampil. | Admin | ☐ |
| Siapkan akun peserta. Akun contoh bisa dipakai langsung (password `contoh123`), atau buat akun baru di menu Pengguna. | Admin | ☐ |
| Cetak 1 lembar label QR kosong (24 label) di menu Lainnya → Cetak label QR. | Admin | ☐ |
| Cetak panduan peternak (10 lembar) dan inseminator (2 lembar). | Admin | ☐ |
| Pasang sertifikat di setiap HP peserta (INSTALL.md, "Memasang sertifikat di HP Android"). | Admin | ☐ |
| Siapkan formulir hasil (§5) dan kuesioner (§6), satu per peserta. | Admin | ☐ |

Akun contoh (data fiktif):

| Peran | Login | Catatan |
| --- | --- | --- |
| Admin dinas | `admin.dinas@contoh.test` | Bisa reset data latihan, ekspor, cadangan |
| Admin kelompok | `admin.ktt01@contoh.test` | KTT Sumber Rejeki |
| Inseminator | `081200000201`, `081200000202` | |
| Peternak | `081200000100`, `081200000103` | KTT-01 |

## 2. Jadwal satu sesi (± 2,5 jam)

| Waktu | Kegiatan |
| --- | --- |
| 15 menit | Pembukaan: tujuan uji coba, bahwa yang diuji aplikasinya (bukan pesertanya), data latihan boleh dicoba sesukanya |
| 20 menit | Pasang aplikasi di HP: buka alamat pos, masuk, pasang PIN, "Tambahkan ke layar utama" |
| 75 menit | Skenario §3 dan §4 berpasangan (peternak + inseminator), admin mengamati dan mengisi §5 |
| 15 menit | Peserta mengisi masukan di aplikasi (Lainnya → Beri masukan) |
| 15 menit | Kuesioner §6 dan diskusi singkat |
| 10 menit | Admin mengunduh catatan pemakaian dari setiap HP (Lainnya → Catatan pemakaian → Unduh CSV), lalu reset data latihan (Pos IB → Reset data demo) bila ada sesi berikutnya |

Cara mengamati: biarkan peserta mencoba sendiri dengan panduan cetak. Bantu hanya bila peserta
diam lebih dari 1 menit. Catat di mana mereka ragu atau salah pencet. Bila dibantu, tandai
**Dibantu**.

## 3. Skenario utama (alur skripsi)

Urutan mengikuti siklus satu sapi: ajukan → verifikasi → IB → PKB → lahir.

| ID | Peran | Langkah | Hasil yang diharapkan | Rujukan | Masalah lama |
| --- | --- | --- | --- | --- | --- |
| U-01 | Semua | Masuk dengan nomor HP/email dan password, lalu pasang PIN 4–6 angka. Keluar, lalu buka lagi dengan PIN. | Masuk berhasil; menu sesuai peran. Password salah memberi satu pesan yang sama untuk akun tidak ada maupun password keliru. | §3.1 | S1, S3, S5, S8 |
| U-02 | Peternak | Tugas → "Minta petugas IB atau PKB" → IB, pilih sapi yang birahi, isi pesan → Ajukan. | Permintaan tampil "Menunggu verifikasi". Bisa dilakukan tanpa sinyal. | §2.2 `POST /` | I3, I4 |
| U-03 | Admin | Permintaan → buka permintaan U-02 → pilih petugas → Tugaskan. | Status "Ditugaskan"; petugas melihatnya di Tugas. | §2.2 `verify` | S4 |
| U-04 | Admin | Buka permintaan lain → Tolak, isi alasan. | Status "Ditolak" beserta alasannya, terlihat juga oleh peternak. | §2.2 `reject` | B10 |
| U-05 | Inseminator | Tugas → buka tugas U-03 → Terima tugas. | Tugas "Sedang dikerjakan"; peternak melihat petugasnya. | §2.3 | B4 |
| U-06 | Inseminator | Dari tugas: "Kerjakan tugas IB" → straw dari stok → Simpan IB. | IB tersimpan di riwayat sapi; permintaan selesai; stok straw berkurang. Form muat satu layar. | §4.7 laporan IB | B7 |
| U-07 | Admin | Pada permintaan yang sudah ditugaskan: Ganti petugas → pilih petugas lain. | Petugas lama tidak melihat tugas itu lagi; log mencatat pergantian beserta pelakunya. | §2.2 `ganti-petugas`, §4.4 | B10 |
| U-08 | Admin | Tindak lanjut → "Hasil IB, 3 bulan" → pilih sapi → "Kirim pengingat" WhatsApp. | Sapi dengan IB > 90 hari tanpa PKB terdaftar, dihitung dari **tanggal IB**, bukan tanggal laporan. Pesan WhatsApp sudah terisi dan tidak terkirim otomatis. | §4.1, §4.3 | B4, B14 |
| U-09 | Peternak + Inseminator | Peternak: dari pengingat "Minta PKB". Inseminator: "Catat PKB" → Bunting, umur janin 2 bulan. | Status sapi "Bunting" dengan perkiraan lahir. Tidak ada pemeriksaan ganda. | §4.5, §4.7 | B5, B6 |
| U-10 | Inseminator | Catat PKB "Tidak bunting" pada sapi lain. | Status kembali "Kosong" (bukan "Gagal"); sapi bisa di-IB lagi saat birahi berikutnya. | §4.8 arti `Gagal` | I1 |
| U-11 | Admin | Tindak lanjut → "Kelahiran, 9 bulan". | Sapi bunting yang lewat perkiraan lahir dan belum dilapori lahir/keguguran muncul di daftar. | §4.2 | B1 |
| U-12 | Peternak | Sapi bunting → Catat kejadian → Lahir → anak hidup, jenis kelamin → Simpan. | Status induk "Sudah lahir"; anak sapi terdaftar dan terhubung ke induknya; pengingat 9 bulan hilang. | §4.5 kelahiran | B8 |
| U-13 | Peternak | Sapi bunting lain → Catat kejadian → Keguguran, trimester. | Status "Keguguran"; pengingat 9 bulan hilang. | §2.2 `keguguran` | I1 |
| U-14 | Peternak | Sapi bunting lain → Catat kejadian → Lahir → anak lahir mati. | Induk "Sudah lahir" (bukan "Gagal"); tidak ada anak hidup yang didaftarkan. | §4.7 kematian anak, §4.8 | I1 |
| U-15 | Admin | Permintaan → buka permintaan U-02 → Log aktivitas. | Urutan ajukan → tugaskan → terima → IB lengkap dengan waktu dan **siapa** pelakunya. | §4.6 | B10 |
| U-16 | Admin | Ternak → cari sapi data contoh yang riwayatnya pernah dikoreksi → lihat Riwayat. | Catatan lama tetap tampil dicoret dengan tulisan "Dibatalkan oleh koreksi" di samping catatan penggantinya. Tidak ada yang ditimpa. | §4.8 koreksi | B7, B8 |
| U-17 | Peternak | Coba buka alamat profil sapi milik peternak lain (minta admin mengirim tautannya). | "Ternak tidak ditemukan". | §5.1 | S4, S10 |
| U-18 | Inseminator / Peternak | (a) Catat IB pada sapi bunting. (b) Catat birahi pada sapi bunting. | (a) Ditolak dengan alasannya. (b) Muncul peringatan "periksa kebuntingan"; tersimpan setelah "Tetap simpan". | §2.2 catatan, §4.8 transisi | S9 |

## 4. Skenario tambahan (fitur rebuild)

| ID | Peran | Langkah | Hasil yang diharapkan |
| --- | --- | --- | --- |
| R-01 | Inseminator | Nyalakan mode pesawat → catat IB atau berat → matikan mode pesawat. | Tersimpan dengan tanda "belum terkirim", lalu "Semua data terkirim" tanpa tombol apa pun. |
| R-02 | Semua | Mode pesawat, tutup aplikasi, buka lagi dari ikon layar utama. | Aplikasi terbuka dan semua halaman bisa dibuka tanpa sinyal. |
| R-03 | Inseminator | Scan → arahkan kamera ke label QR sapi. | Profil sapi terbuka dengan tombol cepat Catat IB / PKB / Lahir. |
| R-04 | Inseminator | Scan label QR kosong → "Daftarkan sapi baru dengan kode ini". | Sapi baru terdaftar dengan label itu; scan berikutnya membuka profilnya. |
| R-05 | Inseminator | Scan → ketik nomor eartag (tanpa kamera). | Sapi dengan eartag itu ditemukan. |
| R-06 | Admin | Lainnya → Cetak label QR → 24 label → cetak (atau simpan PDF). | Lembar A4 rapi; setiap kode unik. |
| R-07 | 2 HP | Dua HP mode pesawat mengubah nama/ras sapi yang sama secara berbeda, lalu online. | Perubahan pada kolom berbeda digabung; pada kolom yang sama, yang terakhir diubah menang. Tidak ada data yang hilang tanpa jejak. |
| R-08 | Inseminator | Dua HP: satu mencatat PKB bunting, satu lagi IB pada sapi yang sama saat offline, lalu online. | Catatan yang bertentangan masuk "Perlu dicek" di Lainnya → Data belum terkirim; bisa diperbaiki atau dibuang. |
| R-09 | Semua | Lainnya → Beri masukan → pilih wajah, bagian, tulis → Kirim (boleh tanpa sinyal). | "Masukan tersimpan"; admin melihatnya di Tindak lanjut → Masukan peserta. |
| R-10 | Admin | Di HP peserta: Lainnya → Catatan pemakaian → Unduh CSV. | File berisi jenis kegiatan dan lamanya saja, tanpa nama atau nomor HP. |
| R-11 | Admin dinas | Pos IB → Cadangkan sekarang; Unduh CSV (ZIP). | Cadangan baru tampil di daftar; ZIP berisi satu CSV per tabel. |
| R-12 | Admin dinas | Pos IB → Reset data demo → Ya. | Semua HP kembali ke layar Masuk; setelah masuk lagi, data contoh kembali seperti semula. |

### Belum ada di aplikasi (catat bila peserta mencarinya)

- Mencatat ternak keluar (mati, dijual, dipotong) dan catatan kesehatan dari layar. Event `EXIT`
  dan `HEALTH` sudah ada di data, tetapi belum ada formnya.
- Mengoreksi catatan dari layar. Koreksi sudah didukung di data (`voidsEventId`) dan tampil di
  riwayat, tetapi belum ada tombolnya.

## 5. Formulir hasil (satu per peserta)

Peserta: ________________ Peran: ☐ Peternak ☐ Inseminator ☐ Admin
HP (merek/tipe, versi Android): ________________ Tanggal: ________

| ID | Lulus | Gagal | Dibantu | Lama (menit) | Catatan (di mana ragu / salah pencet) |
| --- | --- | --- | --- | --- | --- |
| U-01 | ☐ | ☐ | ☐ | | |
| U-02 | ☐ | ☐ | ☐ | | |
| U-03 | ☐ | ☐ | ☐ | | |
| U-04 | ☐ | ☐ | ☐ | | |
| U-05 | ☐ | ☐ | ☐ | | |
| U-06 | ☐ | ☐ | ☐ | | |
| U-07 | ☐ | ☐ | ☐ | | |
| U-08 | ☐ | ☐ | ☐ | | |
| U-09 | ☐ | ☐ | ☐ | | |
| U-10 | ☐ | ☐ | ☐ | | |
| U-11 | ☐ | ☐ | ☐ | | |
| U-12 | ☐ | ☐ | ☐ | | |
| U-13 | ☐ | ☐ | ☐ | | |
| U-14 | ☐ | ☐ | ☐ | | |
| U-15 | ☐ | ☐ | ☐ | | |
| U-16 | ☐ | ☐ | ☐ | | |
| U-17 | ☐ | ☐ | ☐ | | |
| U-18 | ☐ | ☐ | ☐ | | |
| R-01 … R-12 | | | | | Tulis ID-nya |

Kriteria lulus uji coba (usulan, bisa diubah):

- Semua skenario U-* lulus tanpa kesalahan data. "Dibantu" boleh, tetapi dicatat.
- Peternak bisa menyelesaikan U-02 dan U-12 sendiri dengan panduan cetak.
- Median lama mengisi form "Catat kejadian" di catatan pemakaian kurang dari 1 menit untuk inseminator.
- Skor SUS rata-rata ≥ 68 (rata-rata umum aplikasi).

## 6. Kuesioner singkat (SUS, 10 butir)

Lingkari angka: 1 = sangat tidak setuju, 5 = sangat setuju. Bacakan untuk peserta yang lebih
nyaman mendengar.

| No | Pernyataan | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Saya mau memakai aplikasi ini sering-sering. | ○ | ○ | ○ | ○ | ○ |
| 2 | Aplikasi ini terlalu ribet. | ○ | ○ | ○ | ○ | ○ |
| 3 | Aplikasi ini mudah dipakai. | ○ | ○ | ○ | ○ | ○ |
| 4 | Saya perlu dibantu orang lain untuk memakai aplikasi ini. | ○ | ○ | ○ | ○ | ○ |
| 5 | Bagian-bagian aplikasi ini cocok satu sama lain. | ○ | ○ | ○ | ○ | ○ |
| 6 | Banyak hal di aplikasi ini yang membingungkan atau tidak cocok. | ○ | ○ | ○ | ○ | ○ |
| 7 | Saya kira kebanyakan orang cepat bisa memakai aplikasi ini. | ○ | ○ | ○ | ○ | ○ |
| 8 | Aplikasi ini merepotkan. | ○ | ○ | ○ | ○ | ○ |
| 9 | Saya merasa yakin saat memakai aplikasi ini. | ○ | ○ | ○ | ○ | ○ |
| 10 | Saya harus belajar banyak dulu sebelum bisa memakai aplikasi ini. | ○ | ○ | ○ | ○ | ○ |

Cara menghitung: butir ganjil → (nilai − 1); butir genap → (5 − nilai). Jumlahkan, lalu kali 2,5
(hasil 0–100).

Pertanyaan terbuka:

1. Bagian mana yang paling membantu? ________________________________
2. Bagian mana yang paling sulit? ________________________________
3. Apa yang selama ini dicatat di buku tapi belum ada di aplikasi? ________________________________

## 7. Rekap setelah uji coba

| Data | Sumber |
| --- | --- |
| Lulus/gagal per skenario | Formulir §5 dari semua peserta |
| Masukan di aplikasi | Tindak lanjut → Masukan peserta (juga ikut ekspor JSON/CSV di Pos IB, tabel `feedback`) |
| Jumlah event dan lama mengisi form | File CSV/JSON catatan pemakaian dari setiap HP (gabungkan di spreadsheet) |
| Skor SUS | Kuesioner §6 |
| Masalah teknis (kamera, sertifikat, sinyal) | Catatan pengamat; cocokkan dengan `docs/UJI-HP.md` |

Temuan dicatat sebagai issue GitHub (satu temuan satu issue) dengan ID skenario di judulnya,
lalu dipilah untuk langkah 5.2.
