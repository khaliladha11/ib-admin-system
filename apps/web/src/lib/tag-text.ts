// Teks tag untuk peternak dan petugas (bukan istilah teknis).
import type { TagRemovalReason, TagType } from '@ib/shared';

export const TAG_TYPE_TEXT: Record<TagType, string> = { qr: 'Label QR', eartag: 'Eartag' };

export const REMOVAL_REASON_TEXT: Record<TagRemovalReason, string> = {
  lost: 'Hilang',
  damaged: 'Rusak',
  replaced: 'Diganti',
  other: 'Alasan lain',
};

/** Alasan yang bisa dipilih pengguna (replaced dipakai otomatis oleh sistem). */
export const CHOOSABLE_REASONS: readonly TagRemovalReason[] = ['lost', 'damaged', 'other'];
