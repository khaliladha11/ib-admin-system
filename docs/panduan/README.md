# Panduan cetak satu halaman

Untuk uji coba lapangan (langkah 5.1, [`docs/UAT.md`](../UAT.md)).

| File | Untuk |
| --- | --- |
| [`peternak.html`](peternak.html) / [`peternak.pdf`](peternak.pdf) | Peternak: masuk, Hari ini, catat birahi/lahir, minta IB/PKB, beri masukan |
| [`inseminator.html`](inseminator.html) / [`inseminator.pdf`](inseminator.pdf) | Inseminator: tugas, scan QR, catat IB/PKB, pastikan terkirim |

## Mencetak

- Paling mudah: cetak file **PDF** (A4, skala 100%, tanpa "Sesuaikan dengan halaman").
- Dari HTML: buka di Chrome → Ctrl+P → Kertas **A4**, Margin **Default**, centang
  **Grafik latar belakang** → Cetak atau Simpan sebagai PDF. Hasilnya satu halaman.
- Sebelum dicetak, tulis alamat aplikasi pos (mis. `https://192.168.1.10`) dan nomor HP yang bisa
  dihubungi di kotak yang disediakan, atau isi dengan pulpen setelah dicetak.

## Memperbarui gambar dan PDF

Gambar di `img/` dan kedua PDF dibuat otomatis dari aplikasi berisi data contoh fiktif:

```bash
pnpm --filter @ib/web exec playwright test e2e/guide.spec.ts --project hp
```

Tes itu juga memastikan setiap panduan tetap muat **satu** halaman A4. Teks panduan diubah di file
HTML; gaya bersama di `panduan.css`.
