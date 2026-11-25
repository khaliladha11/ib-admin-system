# Sistem desain "kartu lapangan"

Pengguna utama: inseminator dan peternak dengan HP Android 5,5 inci, sering di kandang atau
di atas motor, di bawah sinar matahari. Karena itu: kontras tinggi, huruf besar, target sentuh
besar, dan status yang terbaca tanpa membedakan warna.

Review semua komponen di **`/dev/komponen`** (`pnpm dev`, lalu buka
http://localhost:5173/dev/komponen). Screenshot ada di [`screenshots/`](screenshots/).

## Warna

Token ada di `apps/web/src/index.css`. Setiap pasangan teks/latar diperiksa oleh
`apps/web/src/design/contrast.test.ts` (teks ≥ 4,5:1, garis input/ikon/tepi ≥ 3:1) untuk
mode terang **dan** kontras tinggi. Hasilnya juga dicocokkan dengan pemeriksa kontras
Made Good Designs. Tulis warna sebagai `#rrggbb` agar terbaca tes.

| Token | Hex | Kelas Tailwind | Dipakai untuk |
| --- | --- | --- | --- |
| Tinta `ink` | #14261A | `text-foreground`, `bg-ink` | Teks utama (15,9:1 di putih) |
| Daun `leaf` | #2E6B34 | `bg-primary`, `text-primary` | Tombol utama, tab aktif, tautan |
| Jerami `straw` | #F2C230 | `bg-accent`, `bg-straw` | Tombol Scan, sorotan. Selalu dengan teks tinta |
| Tanah `soil` | #6E4524 | `text-soil` | Peringatan ringan, offline |
| Langit `sky` | #1D5A86 | `text-info` | Info, sedang mengirim, cincin fokus |
| Bahaya `alarm` | #B3261E | `text-alarm`, `bg-destructive` | Error, terlambat |
| Ladang `field` | #EEF3EA | `bg-background` | Latar halaman |
| Kertas `paper` | #FFFFFF | `bg-card` | Latar kartu dan isian |
| Garis `line` / `line-strong` | #D3DDCF / #6F7F73 | `border-border` / `border-input` | Tepi kartu (hiasan) / tepi isian (≥ 3:1) |

**Kontras tinggi** (`<html data-contrast="high">`, diatur dari menu Lainnya, disimpan per HP):
teks hitam pada putih, latar halaman putih, semua garis hitam dan tebalnya 2px (`--bw`),
primer #0F3D16, fokus = garis hitam 3px + lingkaran jerami.

Untuk tepi, pakai `border-(length:--bw)` (bukan `border`), supaya tebalnya ikut mode kontras tinggi.

## Status reproduksi

Selalu tampil sebagai **ikon + teks + garis**, tidak pernah warna saja (`StatusBadge`).

| Status | Teks | Ikon (lucide) | Warna |
| --- | --- | --- | --- |
| `kosong` | Kosong | `Circle` | abu |
| `birahi` | Birahi | `Flame` | magenta tua |
| `sudah_IB_menunggu_PKB` | Sudah IB, menunggu PKB (IB ke-n) | `Syringe` | biru langit |
| `bunting` | Bunting, n bulan | `HeartPulse` | hijau daun |
| `keguguran` | Keguguran | `TriangleAlert` | coklat-oranye |
| `sudah_lahir` | Sudah lahir | `Sprout` | teal |
| `keluar` | Keluar | `LogOut` | abu gelap |

**Lintasan siklus** (`CycleTrack`) adalah ciri khas tampilan. Bentuknya lima ruas: Birahi → IB → PKB →
Bunting → Lahir. Ruas yang sudah lewat bergaris, ruas sekarang terisi warna status, dan ruas
berikutnya hanya garis tepi. Keguguran ditandai ruas Bunting yang terputus-putus. Pembaca layar
mendapat kalimat lengkap, misalnya "Siklus: tahap Bunting (4 dari 5)".

## Huruf

Huruf yang dipakai **Atkinson Hyperlegible Next**, dirancang untuk keterbacaan: I, l, 1, O, dan 0
jelas berbeda, sehingga cocok untuk kode QR `IB-XXXXX` dan kode straw. Huruf dipasang lokal
(`@fontsource-variable/...`), jadi tetap tampil saat offline.

| Kelas | Ukuran | Pakai untuk |
| --- | --- | --- |
| `text-2xl` | 31px | Judul halaman besar |
| `text-xl` | 25px | Judul bagian |
| `text-lg` | 20px | Nama ternak, judul bilah atas |
| `text-base` | 16px | Isi, isian form (ukuran dasar; Android tidak zoom) |
| `text-sm` | 14px | Keterangan saja; paling kecil |

Angka memakai `tabular-nums`. Hindari huruf kapital semua untuk label.

## Ukuran dan sentuhan

- Tombol minimal 44px (`h-11`), tombol besar 48px; isian form 48px.
- Navigasi bawah 64px; tombol Scan bundar 64px, menonjol di tengah.
- Kotak centang dan pilihan berada di baris setinggi ≥ 44px, dan labelnya ikut bisa disentuh.
- Fokus keyboard selalu terlihat (garis 3px).

## Layout

- **HP (< 1024px)**: bilah atas berisi judul halaman dan status sinkron, lalu konten, lalu
  navigasi bawah berisi Beranda, Ternak, **Scan**, Tugas, Lainnya.
- **PC (≥ 1024px)**: sidebar kiri 248px. Tombol "Scan ternak" ada di atas, lalu menu lain.
  Lebar konten maksimal 960px.
- Rata kiri di semua tempat. Kartu memakai tepi tipis tanpa bayangan; bayangan hanya untuk
  navigasi bawah.

## Komponen (`apps/web/src/components/`)

| Komponen | Isi |
| --- | --- |
| `StatusBadge`, `CycleTrack` | Status reproduksi (lihat di atas) |
| `AnimalCard` | Nama, kode QR, jenis kelamin/rumpun/peternak, status, lintasan siklus, jadwal berikutnya, tanda "Belum terkirim" |
| `EventForm` | Catat Birahi, IB, PKB, Berat. Isian wajib dicek dengan pesan sederhana. Peringatan dari aturan domain menampilkan tombol "Tetap simpan" |
| `SyncIndicator` | Online/offline, jumlah belum terkirim, data ditolak, perlu masuk lagi. Sentuh untuk sinkron |
| `EmptyState` | Ikon, judul, dan langkah berikutnya |
| `ErrorMessage` | Menjelaskan apa yang terjadi dan apa yang bisa dilakukan, tanpa pesan teknis |
| `ui/*` | shadcn/ui yang disesuaikan: `Button`, `Card`, `Input`, `Textarea`, `NativeSelect`, `Label` |

## Menulis teks

- Bahasa Indonesia sederhana, kalimat aktif. Tombol menyebut tindakannya, misalnya "Simpan IB" dan
  "Scan ternak", bukan "Kirim".
- Pesan error menyebut apa yang terjadi dan apa yang harus dilakukan, tanpa minta maaf.
- Tampilan kosong mengajak pengguna ke langkah berikutnya.
