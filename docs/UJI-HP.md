# Menguji aplikasi di HP lewat Wi-Fi

Kamera (halaman **Scan**) hanya bisa dipakai lewat alamat aman `https://`, kecuali di
`localhost`. Karena itu, untuk mencoba Scan di HP Android, jalankan server pengembangan dengan
HTTPS dan buka dari HP yang terhubung ke Wi-Fi yang sama.

## 1. Jalankan dengan HTTPS

Di laptop, dari folder repo:

```bash
pnpm db:migrate
```

```bash
pnpm dev:hp
```

Perintah ini sama dengan `pnpm dev`, tetapi Vite memakai sertifikat buatan sendiri
(`@vitejs/plugin-basic-ssl`) dan menerima koneksi dari jaringan. Di terminal muncul alamat
seperti:

```text
➜  Local:   https://localhost:5173/
➜  Network: https://192.168.1.23:5173/
```

Alamat **Network** itulah yang dibuka di HP. Server API tetap di port 3000 dan diakses lewat
proxy `/api` Vite, jadi HP hanya perlu port 5173.

## 2. Buka di HP

1. Sambungkan HP ke Wi-Fi yang sama dengan laptop.
2. Buka Chrome di HP, ketik alamat Network tadi (lengkap dengan `https://` dan `:5173`).
3. Chrome menampilkan **"Koneksi Anda tidak pribadi"**, karena sertifikatnya buatan sendiri.
   Pilih **Lanjutan** → **Lanjutkan ke 192.168.x.x (tidak aman)**. Ini hanya perlu sekali.
4. Masuk dengan akun contoh, misalnya petugas `081200000202`, password `contoh123`.
5. Tekan tombol **Scan** di tengah navigasi bawah, lalu izinkan kamera.

Untuk mencoba scan, cetak label dari **Lainnya → Cetak label QR**. Bisa juga dengan menampilkan
halaman label di layar laptop lalu memindainya dari HP.

## 3. Bila HP tidak bisa membuka alamatnya

- **Firewall laptop**: izinkan Node.js di jaringan privat (Windows akan bertanya saat pertama
  kali; pilih "Private networks").
- **Wi-Fi tamu/kantor** sering memblokir koneksi antarperangkat. Pakai hotspot HP sebagai
  gantinya: sambungkan laptop ke hotspot HP, lalu buka alamat Network baru yang muncul.
- **WSL2 (Windows)**: alamat Network yang muncul adalah alamat internal WSL dan tidak bisa dibuka
  dari HP. Pilih salah satu:
  - Windows 11: aktifkan mode jaringan *mirrored*. Isi `%UserProfile%\.wslconfig`:
    ```ini
    [wsl2]
    networkingMode=mirrored
    ```
    lalu jalankan `wsl --shutdown` di PowerShell dan buka lagi WSL. Alamat Network kini sama
    dengan alamat Wi-Fi laptop.
  - Atau teruskan port dari Windows ke WSL. Jalankan di PowerShell sebagai Administrator, dan
    ganti `<IP-WSL>` dengan hasil `hostname -I` di WSL:
    ```powershell
    netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=<IP-WSL>
    ```
    Buka dari HP lewat alamat Wi-Fi Windows (`ipconfig`), misalnya `https://192.168.1.23:5173`.
    Untuk build PWA (`preview:hp`), buat aturan yang sama untuk port 4173.
    Setelah selesai, hapus aturannya dengan
    `netsh interface portproxy delete v4tov4 listenport=5173 listenaddress=0.0.0.0`.

## 4. Pasang ke layar utama dan uji tanpa sinyal (PWA)

Service worker hanya ada di build produksi, tidak di `pnpm dev:hp`. Untuk mencoba pemasangan
dan mode pesawat:

```bash
pnpm --filter @ib/web build
```

```bash
pnpm --filter @ib/server dev & pnpm --filter @ib/web preview:hp
```

Perintah pertama membangun aplikasi. Perintah kedua menjalankan server API di latar dan
membuka build HTTPS di Wi-Fi pada port **4173** (port bawaan `vite preview`, bukan 5173).

1. Buka `https://<alamat-laptop>:4173` di Chrome HP, lalu lanjutkan melewati peringatan
   sertifikat.
2. Masuk, lalu tunggu pesan **"Siap dipakai tanpa sinyal"**.
3. Pasang aplikasinya: menu Chrome (⋮) › **Instal aplikasi** / **Tambahkan ke layar utama**.
   Ikon sapi hijau **IB Ternak** akan muncul di layar utama.
4. Nyalakan **mode pesawat**, lalu buka IB Ternak dari layar utama. Aplikasi tetap terbuka.
   Coba catat kejadian: indikator di kanan atas menunjukkan jumlah catatan yang belum terkirim.
5. Matikan mode pesawat. Catatan terkirim sendiri dalam beberapa detik dan indikator kembali
   menjadi "Semua data terkirim".
6. Versi baru: setelah `pnpm build` ulang dan aplikasi dibuka lagi, muncul kartu
   **"Versi baru tersedia"** dengan tombol **Perbarui sekarang**.

Catatan: Chrome hanya menawarkan "Instal aplikasi" di alamat HTTPS yang sertifikatnya dipercaya.
Dengan sertifikat buatan sendiri, pilih **Tambahkan ke layar utama**; aplikasi tetap berjalan
offline. Pemasangan penuh akan diuji di server dengan HTTPS sungguhan (langkah 4.3).

## 5. Yang perlu dicoba di HP sungguhan

Kamera tidak bisa diuji dengan benar di laptop. Coba hal berikut di HP:

| Hal | Yang diharapkan |
| --- | --- |
| Scan label milik sapi terdaftar | Getar + bunyi bip, langsung ke profil dengan tombol **Catat IB / Catat PKB / Catat lahir** |
| Scan label kosong | Kartu **Belum terdaftar** + tombol **Daftarkan sapi baru dengan kode ini** |
| Scan beruntun | Kamera terus membaca; daftar bertambah; scan ulang label yang sama tidak menambah baris |
| Mode pesawat lalu scan | Tetap bekerja (data dicari di HP); catatan baru terkirim saat online lagi |
| Tolak izin kamera | Pesan **Izin kamera ditolak** beserta cara mengizinkannya; ketik kode tetap bisa |
| Kandang gelap | Tombol senter muncul bila kamera HP mendukung |
| Label kotor, miring, jarak 15–40 cm | Masih terbaca. Bila tidak, catat jenis HP-nya |
| Target fase ini | Scan → IB tercatat dalam ≤ 30 detik |
| Mode pesawat (PWA terpasang) | Aplikasi terbuka, catatan tersimpan, lalu terkirim saat sinyal kembali |

Chrome Android memakai pembaca bawaan (`BarcodeDetector`). Browser tanpa pembaca bawaan, seperti
iPhone dan Firefox, otomatis memakai cadangan ZXing.
