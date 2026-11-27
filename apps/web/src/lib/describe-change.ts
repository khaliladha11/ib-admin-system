// Ringkasan satu perubahan di antrean kirim untuk halaman "Data belum terkirim".
import type { OutboxEntry } from '@/data';
import { formatDate } from '@/lib/format';

const KIND_TEXT: Record<OutboxEntry['kind'], string> = {
  'farmer.create': 'Peternak baru',
  'farmer.update': 'Ubah data peternak',
  'animal.create': 'Sapi baru',
  'animal.update': 'Ubah data sapi',
  'event.create': 'Catatan',
  'serviceRequest.create': 'Permintaan IB/PKB',
  'serviceRequest.accept': 'Terima tugas',
  'serviceRequest.assign': 'Tugaskan petugas',
  'serviceRequest.reassign': 'Ganti petugas',
  'serviceRequest.reject': 'Tolak permintaan',
  'qrCode.reserve': 'Label QR baru',
  'tag.attach': 'Pasang label/tag',
  'tag.remove': 'Cabut label/tag',
  'syncReview.discard': 'Buang catatan perlu dicek',
  'feedback.create': 'Masukan',
  'isikhnasReport.create': 'Tandai dilaporkan ke iSIKHNAS',
};

export const EVENT_TEXT: Record<string, string> = {
  BH: 'Birahi',
  IB: 'IB',
  PKB: 'Periksa bunting (PKB)',
  KGG: 'Keguguran',
  LH: 'Lahir',
  BB: 'Berat badan',
  HEALTH: 'Kesehatan',
  EXIT: 'Ternak keluar',
};

export interface ChangeSummary {
  title: string;
  /** Sapi (bila ada) dan tanggal kejadian. */
  detail: string;
}

export function describeChange(
  entry: Pick<OutboxEntry, 'kind' | 'body' | 'createdAt'>,
  animalName: string | null,
): ChangeSummary {
  const body = (entry.body ?? {}) as { type?: string; occurredAt?: number; name?: string };
  const title =
    entry.kind === 'event.create' && body.type
      ? (EVENT_TEXT[body.type] ?? body.type)
      : KIND_TEXT[entry.kind];
  const who = animalName ?? (entry.kind === 'animal.create' ? (body.name ?? null) : null);
  const when = entry.kind === 'event.create' && body.occurredAt ? body.occurredAt : entry.createdAt;
  return { title, detail: [who, formatDate(when)].filter(Boolean).join(' · ') };
}
