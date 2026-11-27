# Memasang IB Ternak di pos IB

Panduan ini untuk petugas atau admin yang **bukan programmer**. Hasil akhirnya:

- satu komputer di pos IB (laptop, mini PC, atau Raspberry Pi) menjadi **server**;
- HP petugas dan peternak membuka aplikasi lewat **Wi-Fi pos**, tanpa internet;
- data dicadangkan otomatis setiap hari.

Internet hanya dibutuhkan **sekali** saat memasang (mengunduh aplikasi) dan saat memperbarui.

## Isi

1. [Yang dibutuhkan](#1-yang-dibutuhkan)
2. [Pasang di Linux atau Raspberry Pi](#2-pasang-di-linux-atau-raspberry-pi)
3. [Pasang di Windows](#3-pasang-di-windows)
4. [Memasang sertifikat di HP Android](#4-memasang-sertifikat-di-hp-android)
5. [Membuka aplikasi dari HP](#5-membuka-aplikasi-dari-hp)
6. [Cadangan dan pemulihan](#6-cadangan-dan-pemulihan)
7. [Ekspor dan impor data](#7-ekspor-dan-impor-data)
8. [Perawatan sehari-hari](#8-perawatan-sehari-hari)
9. [Masalah umum](#9-masalah-umum)

---

## 1. Yang dibutuhkan

| Barang | Keterangan |
| --- | --- |
| Komputer server | Laptop/mini PC 64-bit (RAM ≥ 2 GB, ruang kosong ≥ 5 GB), **atau** Raspberry Pi 4/5 (RAM ≥ 2 GB, Raspberry Pi OS **64-bit**, kartu SD ≥ 32 GB) |
| Router Wi-Fi | Router biasa atau hotspot. Tidak perlu tersambung internet |
| HP | Android 8 ke atas dengan Chrome |
| Internet | Hanya saat memasang/memperbarui (± 1–2 GB unduhan pertama kali) |

Tips:

- Sambungkan server ke router dengan **kabel LAN** bila bisa, agar lebih stabil.
- Minta router memberi **alamat IP tetap** untuk server (menu *DHCP reservation* / *Static lease* di router). Dengan begitu alamat aplikasi tidak berubah-ubah.

## 2. Pasang di Linux atau Raspberry Pi

1. Sambungkan komputer ke internet dan ke Wi-Fi/LAN pos.
2. Buka **Terminal**, lalu tempel perintah ini dan tekan Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/khaliladha11/ib-admin-system/main/scripts/install.sh | bash
   ```

3. Jawab beberapa pertanyaan (tekan Enter untuk memakai jawaban bawaan):
   - **Alamat IP komputer ini untuk HP**: biasanya sudah benar, misalnya `192.168.1.10`.
   - **Nama wilayah/pos**: misalnya `Pos IB Kecamatan Sukamaju`.
   - **Email akun admin**: misalnya `admin@pos-ib.lokal` (tidak perlu email sungguhan).
4. Tunggu. Pertama kali bisa **5–20 menit**, dan lebih lama di Raspberry Pi. Jangan matikan komputer.
5. Setelah selesai, layar menampilkan:
   - alamat aplikasi, misalnya `https://192.168.1.10`;
   - alamat sertifikat, misalnya `http://192.168.1.10/sertifikat`;
   - letak **password admin awal**, yaitu file `~/ib-ternak/.env` di baris `ADMIN_PASSWORD`. Catat password itu, lalu ganti setelah masuk.

Ingin mencoba dengan data contoh fiktif dulu? Jalankan dengan `IB_DEMO=1`:

```bash
curl -fsSL https://raw.githubusercontent.com/khaliladha11/ib-admin-system/main/scripts/install.sh | IB_DEMO=1 bash
```

Akun contohnya: `admin.dinas@contoh.test`, password `contoh123`.

## 3. Pasang di Windows

1. **Pasang Docker Desktop** dari <https://www.docker.com/products/docker-desktop/>. Saat ditanya, pilih *Use WSL 2*. Restart komputer bila diminta, lalu buka Docker Desktop sampai tulisannya "Engine running".
2. **Unduh aplikasi**: buka <https://github.com/khaliladha11/ib-admin-system>, klik **Code** lalu **Download ZIP**. Ekstrak ke `C:\ib-ternak`.
3. **Cari alamat IP komputer**: buka *Command Prompt*, ketik `ipconfig`, lalu catat **IPv4 Address** dari Wi-Fi/Ethernet yang dipakai, misalnya `192.168.1.10`.
4. **Buat file pengaturan**: buka *Notepad*, isi seperti ini (ganti IP dan password), lalu simpan sebagai `C:\ib-ternak\.env`. Pada pilihan *Save as type*, pilih *All files* agar namanya tidak menjadi `.env.txt`.

   ```ini
   POS_HOST=192.168.1.10
   REGION_NAME=Pos IB Kecamatan Sukamaju
   ADMIN_NAME=Admin Pos IB
   ADMIN_EMAIL=admin@pos-ib.lokal
   ADMIN_PASSWORD=GantiDenganPasswordPanjang
   TZ=Asia/Jakarta
   ```

5. **Nyalakan**: buka *PowerShell*, lalu jalankan dua perintah ini:

   ```powershell
   cd C:\ib-ternak
   ```

   ```powershell
   docker compose up -d --build
   ```

   Tunggu sampai selesai (pertama kali 5–15 menit).

6. **Izinkan HP mengakses**: buka *PowerShell sebagai Administrator*, lalu jalankan:

   ```powershell
   New-NetFirewallRule -DisplayName "IB Ternak" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
   ```

7. Docker Desktop menyalakan aplikasi otomatis setiap Windows dinyalakan, selama pilihan *Start Docker Desktop when you sign in* aktif.

Perintah harian di Windows dijalankan dari `C:\ib-ternak` di PowerShell:

| Keperluan | Perintah |
| --- | --- |
| Melihat status | `docker compose ps` |
| Mencadangkan sekarang | `docker compose exec app node_modules/.bin/tsx src/ops/backup-cli.ts cadangkan` |
| Melihat cadangan | buka folder `C:\ib-ternak\backups` |
| Mengambil sertifikat | `docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .\ib-ternak-ca.crt` |
| Memulihkan cadangan | `docker compose stop app`, lalu `docker compose run --rm --no-deps app node_modules/.bin/tsx src/ops/backup-cli.ts pulihkan <nama-file>`, lalu `docker compose start app` |

## 4. Memasang sertifikat di HP Android

Kamera (Scan) dan "pasang ke layar utama" hanya bisa dipakai lewat alamat aman `https://`. Server pos membuat **sertifikatnya sendiri**. Agar HP mempercayainya, setiap HP memasang **sertifikat root** pos **sekali saja**.

> Sertifikat ini hanya berlaku untuk server pos Anda. Jangan pasang sertifikat dari sumber yang tidak Anda kenal.

### Langkah (Android 11 ke atas)

1. Sambungkan HP ke **Wi-Fi pos**.
2. Buka **Chrome**, lalu ketik alamat sertifikat (lihat layar pemasangan atau halaman **Pos IB**), misalnya:
   `http://192.168.1.10/sertifikat`
   Perhatikan: awalannya `http://`, **bukan** `https://`.
3. File **ib-ternak-ca.crt** terunduh. Bila Chrome bertanya, pilih **Unduh**.
4. Buka **Setelan** (Settings) HP.
5. Cari menu sertifikat. Nama dan letaknya berbeda per merek HP; cara termudah adalah mengetik **"sertifikat"** atau **"certificate"** di kotak pencarian Setelan. Contoh letaknya:
   - **Android umum/Pixel**: Keamanan & privasi → Setelan keamanan lainnya → **Enkripsi & kredensial** → **Instal sertifikat** → **Sertifikat CA**.
   - **Samsung**: Biometrik dan keamanan → Pengaturan keamanan lainnya → **Instal dari penyimpanan perangkat** → **Sertifikat CA**.
   - **Xiaomi/Redmi/POCO**: Kata sandi & keamanan → Privasi → Enkripsi & kredensial → **Instal sertifikat** → **Sertifikat CA**.
   - **Oppo/Realme/Vivo**: Kata sandi & keamanan → Keamanan sistem → Enkripsi & kredensial → **Instal sertifikat** → **Sertifikat CA**.
6. HP menampilkan peringatan bahwa sertifikat CA bisa melihat lalu lintas data. Pilih **Tetap instal**. Peringatan ini wajar untuk server lokal.
7. Bila diminta, masukkan PIN/pola layar HP.
8. Pilih file **ib-ternak-ca.crt** dari folder **Download**.
9. Muncul tulisan "Sertifikat CA terinstal". Selesai.

### Memeriksa

Buka `https://192.168.1.10` (sesuaikan alamatnya) di Chrome. Bila **tidak ada** peringatan "Koneksi tidak pribadi" dan aplikasi **IB Ternak** muncul, sertifikat sudah benar.

### Bila tidak bisa mengunduh dari HP

Salin sertifikat dari komputer pos ke HP (kabel USB, Bluetooth, atau kirim lewat WhatsApp ke diri sendiri), lalu mulai dari langkah 4.

- Di Linux: `./scripts/pos.sh sertifikat`, lalu berkasnya ada di `~/ib-ternak/ib-ternak-ca.crt`.
- Di Windows: lihat tabel perintah di bagian 3.

## 5. Membuka aplikasi dari HP

1. Di komputer pos atau HP admin, buka **Pos IB** dari menu admin. Halaman ini menampilkan **alamat** dan **kode QR**.
2. Di HP, pindai QR itu dengan kamera, atau ketik alamatnya di Chrome, misalnya `https://192.168.1.10`.
3. Masuk dengan akun masing-masing. Admin membuat akun petugas dan peternak di menu **Pengguna**.
4. Pasang ke layar utama: di Chrome, ketuk menu **⋮**, lalu **Instal aplikasi** atau **Tambahkan ke layar utama**. Ikon sapi hijau **IB Ternak** akan muncul.
5. Sejak itu aplikasi tetap bisa dibuka dan dipakai **tanpa sinyal**. Catatan terkirim ke server pos begitu HP kembali tersambung ke Wi-Fi pos.

## 6. Cadangan dan pemulihan

- Server membuat **cadangan otomatis setiap hari** di folder `backups/`, misalnya `~/ib-ternak/backups` atau `C:\ib-ternak\backups`. **14 cadangan terakhir** disimpan, yang lebih lama dihapus.
- Admin dinas bisa menekan **Cadangkan sekarang** di halaman **Pos IB**.
- Salin isi folder `backups/` ke flashdisk **seminggu sekali**, agar data aman bila komputer rusak.

Perintah di Linux/Raspberry Pi (dari folder `~/ib-ternak`):

| Keperluan | Perintah |
| --- | --- |
| Cadangkan sekarang | `./scripts/pos.sh cadangkan` |
| Lihat daftar cadangan | `./scripts/pos.sh daftar-cadangan` |
| Pulihkan dari cadangan | `./scripts/pos.sh pulihkan ib-ternak-2026-11-27-020000.sqlite` |

Saat memulihkan:

- Server berhenti sebentar, data dikembalikan seperti saat cadangan itu dibuat, lalu server menyala lagi.
- Data sebelum pemulihan tidak hilang; disimpan di samping database sebagai berkas `…sebelum-pulih-…`.
- HP yang masih menyimpan catatan belum terkirim akan mengirimnya lagi setelah pemulihan.

Waktu pada nama file cadangan memakai **UTC** (WIB dikurangi 7 jam). Waktu yang tampil di halaman Pos IB sudah dalam waktu setempat.

## 7. Ekspor dan impor data

Di halaman **Pos IB** (hanya admin dinas):

- **Unduh JSON lengkap**: seluruh data, termasuk akun. Dipakai untuk pindah ke server baru atau menggabungkan data dua pos. **Simpan baik-baik**, karena berisi data akun.
- **Unduh CSV (ZIP)**: satu tabel per file, untuk dibuka di Excel/LibreOffice. Tanpa password. Tidak bisa diimpor kembali.
- **Impor file JSON**: data **digabung**. Yang belum ada ditambahkan; yang sudah ada **tidak diubah**. Cadangan dibuat otomatis sebelum impor, lalu muncul tabel berisi jumlah yang ditambahkan dan yang sudah ada.

Pindah ke komputer baru:

1. Pasang IB Ternak di komputer baru (bagian 2 atau 3).
2. Unduh JSON lengkap dari server lama.
3. Impor file itu di server baru.

## 8. Perawatan sehari-hari

Perintah di Linux/Raspberry Pi (dari folder `~/ib-ternak`):

| Keperluan | Perintah |
| --- | --- |
| Status | `./scripts/pos.sh status` |
| Melihat catatan kerja server | `./scripts/pos.sh log` (keluar: Ctrl+C) |
| Mematikan | `./scripts/pos.sh berhenti` |
| Menyalakan | `./scripts/pos.sh mulai` |
| **IP komputer berganti** (mis. pindah router) | `./scripts/pos.sh alamat`, lalu cetak/bagikan alamat baru dari halaman Pos IB. Sertifikat di HP **tidak** perlu dipasang ulang |
| Memperbarui aplikasi (butuh internet) | `./scripts/pos.sh perbarui` |

Server menyala otomatis setiap komputer dinyalakan.

## 9. Masalah umum

| Masalah | Penyebab dan solusi |
| --- | --- |
| HP tidak bisa membuka alamat | HP belum tersambung ke Wi-Fi pos, alamat IP berubah (jalankan `./scripts/pos.sh alamat`), atau firewall Windows belum diizinkan (bagian 3, langkah 6). Coba buka dari komputer pos sendiri: `https://localhost` |
| "Koneksi tidak pribadi" di HP | Sertifikat belum terpasang di HP itu (bagian 4), atau Anda membuka alamat lain dari yang tertulis di halaman Pos IB |
| `/sertifikat` tidak terunduh | Pastikan memakai `http://` (bukan `https://`). Atau salin sertifikat lewat kabel/WhatsApp (bagian 4) |
| Kamera tidak menyala di Scan | Aplikasi harus dibuka lewat `https://`. Izinkan kamera: ikon gembok di samping alamat → Izin → Kamera |
| Pemasangan lama di Raspberry Pi | Wajar untuk pertama kali (10–20 menit). Pastikan memakai Raspberry Pi OS **64-bit** |
| Lupa password admin | Admin dinas lain bisa mengatur ulang di menu **Pengguna**. Bila tidak ada admin lain, hubungi pengelola teknis |
| Komputer pos rusak | Pasang di komputer baru, lalu pulihkan cadangan terakhir dari flashdisk (salin ke folder `backups/`, lalu `./scripts/pos.sh pulihkan <nama-file>`) atau impor JSON terakhir |

---

**Catatan teknis untuk pengelola:**

- Server dan aplikasi web berjalan dalam satu image Docker yang dibangun di perangkat itu sendiri.
- Caddy melayani HTTPS dengan CA lokal (`tls internal`) untuk alamat IP di `POS_HOST`.
- Database SQLite berada di volume Docker `ib-data`; cadangan di `./backups`.
- Lihat juga `docker-compose.yml`, `deploy/Caddyfile`, `scripts/install.sh`, dan `scripts/pos.sh`.
