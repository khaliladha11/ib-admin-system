// Teks pilihan form masukan (langkah 5.1), dipakai form peserta dan daftar admin.
import type { FeedbackTopic } from '@ib/shared';

export const TOPIC_TEXT: Record<FeedbackTopic, string> = {
  general: 'Aplikasi secara umum',
  record: 'Mencatat birahi/IB/PKB/lahir',
  animals: 'Daftar dan profil sapi',
  tasks: 'Tugas dan permintaan',
  scan: 'Scan QR dan label',
  sync: 'Pengiriman data / sinyal',
  other: 'Lainnya',
};

export const RATING_TEXT: Record<number, string> = {
  1: 'Sulit',
  2: 'Biasa',
  3: 'Mudah',
};
