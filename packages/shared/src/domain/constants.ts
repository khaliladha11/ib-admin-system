// Semua angka hari untuk logika reproduksi. Ubah di sini saja (lihat CLAUDE.md).
// Asal aturan: skripsi (docs/legacy/DOMAIN.md §4) dan keputusan rebuild (docs/PLAN.md §6).

export const DAY_MS = 86_400_000;

/** Siklus birahi sapi. */
export const ESTRUS_CYCLE_DAYS = 21;
/** Lama status "birahi" bertahan tanpa IB sebelum kembali "kosong". */
export const ESTRUS_ACTIVE_DAYS = 2;
/** IB dengan selang sedekat ini dianggap masih satu masa birahi (dihitung satu layanan). */
export const SAME_HEAT_IB_DAYS = 1;
/** IB ulang lebih cepat dari ini (di luar masa birahi yang sama) diberi peringatan. */
export const MIN_IB_INTERVAL_DAYS = 18;

/** Jadwal PKB setelah IB. */
export const PKB_AFTER_IB_DAYS = 60;
/** PKB lebih cepat dari ini setelah IB ditolak (hasilnya belum bisa dipercaya). */
export const PKB_MIN_DAYS_AFTER_IB = 30;

/** Aturan skripsi: hasil IB belum dilaporkan lebih dari 3 bulan (dihitung dari tanggal IB). */
export const IB_RESULT_REPORT_DUE_DAYS = 90;

/** Lama kebuntingan sapi: 9–10 bulan. */
export const GESTATION_DAYS_MIN = 270;
export const GESTATION_DAYS_EXPECTED = 283;
export const GESTATION_DAYS_MAX = 300;
/**
 * Aturan skripsi "kelahiran/keguguran belum dilaporkan > 9 bulan setelah bunting",
 * diterapkan sebagai: lewat perkiraan lahir paling lambat (konsepsi + hari ini).
 */
export const BIRTH_REPORT_DUE_DAYS = GESTATION_DAYS_MAX;
/** Kelahiran sebelum umur kebuntingan ini diberi peringatan prematur. */
export const PREMATURE_BIRTH_DAYS = 240;

/** Perkiraan birahi pertama setelah melahirkan. */
export const POSTPARTUM_FIRST_ESTRUS_DAYS = 45;

/** Untuk mengubah umur janin (bulan) menjadi hari. */
export const DAYS_PER_MONTH = 30.4;
