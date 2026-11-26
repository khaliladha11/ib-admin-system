# Ukuran bundle web (langkah 4.1)

Yang dihitung di sini adalah semua yang **diunduh saat aplikasi pertama dibuka**: entry JS, chunk
`modulepreload`, dan CSS dari `dist/index.html`. Huruf tidak dihitung karena dimuat saat dipakai.

Cara mengukur:
- `pnpm build`, lalu `pnpm --filter @ib/web exec tsx scripts/bundle-size.ts`.
- Untuk melihat isi per paket: `ANALYZE=1 pnpm build`.

> Koreksi: laporan langkah 2.4 menyebut bundel awal 323 KB. Angka itu hanya chunk `index-*.js`.
> Total yang benar-benar dimuat saat dibuka, termasuk chunk modulepreload, adalah 849 KB pada akhir
> langkah 3.2.

## Sebelum dan sesudah

| | Mentah | gzip |
| --- | --- | --- |
| Akhir langkah 3.2 | 849,3 KB | 261,3 KB |
| Motion lewat `LazyMotion` + `m` (fitur animasi dimuat setelah tampil) | 751,9 KB | 230,8 KB |
| Form catat kejadian, Minta IB/PKB, dan Lainnya dimuat saat dibuka | 731,9 KB | 227,1 KB |
| **Akhir 4.1** (ditambah `workbox-window` dan pemberitahuan versi baru) | **735,5 KB** | **228,1 KB** |

Hasilnya, bundel awal berkurang **114 KB (−13%), atau 33 KB gzip**.

Saat aplikasi pertama kali dibuka, service worker juga menyimpan semua berkas ke cache:
- 56 berkas, total **1,45 MB**;
- termasuk ZXing (402 KB, hanya untuk HP tanpa pembaca QR bawaan), halaman admin, label, dan huruf;
- proses ini berjalan di latar belakang dan tidak menunda tampilan pertama.

Setelah itu, membuka aplikasi tidak mengunduh apa pun selain data.

## Isi bundel awal (sebelum minify)

| Paket | Ukuran | Catatan |
| --- | --- | --- |
| react-dom | 524 KB | Wajib |
| dexie | 198 KB | Data lokal (inti offline) |
| zod | 168 KB | Validasi bersama dengan server (`@ib/shared`) |
| @tanstack/router-core + react-router | 149 KB | Rute |
| tailwind-merge | 58 KB | Dipakai `cn()` |
| kode aplikasi (`components`, `data`, `pages`, `layout`) | ±150 KB | |
| lucide-react | 38 KB | Hanya ikon yang dipakai |
| framer-motion (bagian `m`) | 22 KB | Fitur animasi (48 KB) dimuat terpisah |

## Saran pengurangan berikutnya (belum dikerjakan)

| Saran | Perkiraan hemat (gzip) | Risiko / biaya |
| --- | --- | --- |
| **Zod Mini** (`zod/mini`) untuk skema di web, atau validasi bersama dipisah agar web hanya memuat skema yang dipakai form | 25–35 KB | Sedang: skema `@ib/shared` perlu ditulis ulang ke gaya fungsional; server tetap bisa memakai Zod biasa |
| **Pecah chunk `utils` (269 KB)**: halaman admin, label, dan scan memakai `manualChunks` yang lebih rapi, sehingga kode admin tidak ikut ke bundel peternak | 10–20 KB | Rendah: hanya pengaturan build; perlu diukur ulang |
| **Ganti `tailwind-merge`** dengan `cn()` sederhana (gabung kelas tanpa menimpa) di komponen yang tidak butuh penggabungan cerdas | ±15 KB | Sedang: bentrok kelas harus dicek manual di komponen `ui/*` |
| **Profil ternak lazy**: profil termasuk `EventTimeline` dan `TagHistory` | 8–12 KB | Rendah, tetapi profil sering dibuka; skeleton sudah ada |
| **Dexie: muat hook admin terpisah** (`loadFollowUps`, `loadAdminSummary`, …) hanya untuk admin | 3–5 KB | Rendah |
| **Huruf**: hanya subset latin (tanpa latin-ext) untuk Atkinson | 19 KB (tidak dihitung di atas) | Rendah: huruf berdiakritik jarang dipakai di nama Indonesia |

Batas wajar untuk HP 3G di desa adalah bundel awal **≤ 250 KB gzip**, dan saat ini sudah tercapai
(228 KB). Karena service worker menyimpan semua berkas, pembukaan kedua dan seterusnya tidak
bergantung pada sinyal.
