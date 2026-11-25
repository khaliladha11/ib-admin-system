// Kalimat yang ramah untuk setiap jenis error.
import {
  CloudOff,
  KeyRound,
  OctagonAlert,
  ShieldX,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  ApiRequestError,
  LocalValidationError,
  NetworkError,
  NotSignedInError,
  WarningsNeedConfirmation,
} from '@/data';

export interface FriendlyError {
  icon: LucideIcon;
  title: string;
  /** Penjelasan dan apa yang bisa dilakukan. */
  body: string;
  items: string[];
  tone: 'alarm' | 'warn';
}

/** Ubah error apa pun menjadi kalimat yang jelas untuk pengguna. */
export function describeError(error: unknown): FriendlyError {
  if (error instanceof WarningsNeedConfirmation) {
    return {
      icon: TriangleAlert,
      title: 'Periksa dulu sebelum menyimpan',
      body: 'Data ini tidak biasa. Bila sudah benar, pilih Tetap simpan.',
      items: error.warnings,
      tone: 'warn',
    };
  }
  if (error instanceof LocalValidationError) {
    return {
      icon: OctagonAlert,
      title: 'Data belum bisa disimpan',
      body: 'Perbaiki isian berikut, lalu simpan lagi.',
      items: error.issues,
      tone: 'alarm',
    };
  }
  if (error instanceof NetworkError) {
    return {
      icon: CloudOff,
      title: 'Tidak ada koneksi ke server',
      body: 'Data yang sudah dicatat tetap aman di HP ini dan dikirim otomatis saat ada sinyal.',
      items: [],
      tone: 'warn',
    };
  }
  if (
    error instanceof NotSignedInError ||
    (error instanceof ApiRequestError && error.status === 401)
  ) {
    return {
      icon: KeyRound,
      title: 'Anda perlu masuk lagi',
      body: 'Masuk dengan nomor HP atau email Anda. Data di HP ini tidak hilang.',
      items: [],
      tone: 'alarm',
    };
  }
  if (error instanceof ApiRequestError && error.status === 403) {
    return {
      icon: ShieldX,
      title: 'Anda tidak punya akses untuk ini',
      body: 'Minta admin kelompok atau dinas untuk melakukannya.',
      items: [error.message],
      tone: 'alarm',
    };
  }
  if (error instanceof ApiRequestError) {
    return {
      icon: OctagonAlert,
      title: error.status >= 500 ? 'Server sedang bermasalah' : 'Server menolak data ini',
      body:
        error.status >= 500
          ? 'Data tetap tersimpan di HP ini. Pengiriman dicoba lagi otomatis.'
          : 'Periksa pesan dari server di bawah ini.',
      items: [error.message],
      tone: 'alarm',
    };
  }
  return {
    icon: OctagonAlert,
    title: 'Terjadi kesalahan di aplikasi',
    body: 'Tutup lalu buka lagi aplikasinya. Data yang sudah tersimpan tidak hilang.',
    items: [],
    tone: 'alarm',
  };
}
