# Keamanan

## Versi yang didukung

| Versi | Didukung |
| --- | --- |
| 1.x | ✅ |
| < 1.0 (pra-rilis) | ❌ |
| `v3.1-legacy` (skripsi) | ❌ arsip, punya celah yang diketahui (lihat `docs/legacy/DOMAIN.md` §5.1) |

## Melaporkan celah

Jangan membuka issue publik untuk celah keamanan. Gunakan
[**Report a vulnerability**](https://github.com/khaliladha11/ib-admin-system/security/advisories/new)
(GitHub private vulnerability reporting). Sertakan langkah untuk mengulang, dampak, dan versi.
Laporan ditanggapi dalam 7 hari.

## Yang sudah diterapkan

- Semua route API (kecuali login dan health) butuh sesi. Peran dan cakupan wilayah diperiksa di
  server, dan data di luar cakupan dijawab 404.
- Password di-hash dengan argon2id. Sesi disimpan sebagai hash SHA-256 di database, dengan cookie
  `httpOnly` dan `SameSite=Lax`.
- Batas percobaan masuk: 5 gagal per akun (30 per alamat IP) mengunci 15 menit
  (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`).
- Header keamanan:
  - CSP ketat untuk aplikasi (tanpa skrip inline);
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`;
  - `Permissions-Policy` hanya mengizinkan kamera.
  HSTS sengaja tidak dipasang karena pos IB dibuka lewat alamat IP dengan sertifikat lokal.
- Validasi input dengan Zod di server.
- Tidak ada rahasia di repo; konfigurasi lewat `.env`.
- Cadangan otomatis harian.
- `pnpm audit` saat rilis 1.0.0: dependensi produksi tanpa kerentanan yang diketahui. Ada 3
  kerentanan tingkat sedang di alat build (`drizzle-kit` → esbuild, `vite-plugin-pwa` → glob/minimatch),
  dan tidak ada yang tinggi.

## Catatan untuk pemasang pos IB

- Ganti password admin awal setelah masuk pertama kali.
- Jangan pakai `DEMO_MODE=1` untuk data sungguhan.
- File ekspor JSON berisi hash password: simpan di tempat aman.
- Server pos dirancang untuk jaringan lokal (Wi-Fi pos). Bila dibuka ke internet, pasang di balik
  domain dengan sertifikat resmi dan aktifkan HSTS di proxy.
