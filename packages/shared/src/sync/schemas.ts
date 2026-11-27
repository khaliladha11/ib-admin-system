// Skema push/pull dan antrean "perlu dicek" (docs/SYNC.md §3–§6).
import { z } from 'zod';

import { baseRowSchema, idSchema, timestampSchema } from '../schemas/common';

/** Jenis perubahan dari outbox HP; server hanya menerima jenis ini (daftar putih). */
export const SYNC_CHANGE_KINDS = [
  'farmer.create',
  'farmer.update',
  'animal.create',
  'animal.update',
  'event.create',
  'serviceRequest.create',
  'serviceRequest.accept',
  'serviceRequest.assign',
  'serviceRequest.reassign',
  'serviceRequest.reject',
  'qrCode.reserve',
  'tag.attach',
  'tag.remove',
  'syncReview.discard',
  'feedback.create',
  'isikhnasReport.create',
] as const;
export type SyncChangeKind = (typeof SYNC_CHANGE_KINDS)[number];

export const SYNC_RESULTS = ['applied', 'merged', 'needs_review', 'rejected'] as const;
export type SyncOutcome = (typeof SYNC_RESULTS)[number];

export const SYNC_REVIEW_RESOLUTIONS = ['resent', 'discarded'] as const;
export type SyncReviewResolution = (typeof SYNC_REVIEW_RESOLUTIONS)[number];

export const MAX_PUSH_CHANGES = 50;

export const syncChangeSchema = z.object({
  /** id perubahan = id entri outbox (kunci idempoten). */
  id: idSchema,
  kind: z.enum(SYNC_CHANGE_KINDS),
  method: z.enum(['POST', 'PATCH']),
  path: z.string().max(200),
  body: z.unknown(),
  /** Baris utama yang diubah (dari outbox), untuk jejak dan antrean perlu dicek. */
  rowId: idSchema.nullable().optional(),
  /** Waktu perubahan dibuat di HP (ms UTC). */
  at: timestampSchema,
});
export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncPushRequestSchema = z.object({
  changes: z.array(syncChangeSchema).min(1).max(MAX_PUSH_CHANGES),
});

export const syncChangeResultSchema = z.object({
  id: idSchema,
  result: z.enum(SYNC_RESULTS),
  /** Kode error API (mis. INVALID_EVENT, CONFLICT) untuk needs_review/rejected. */
  code: z.string().nullable(),
  message: z.string().nullable(),
  /** Isi respons route (baris versi server) untuk applied/merged; null pada kiriman ulang. */
  body: z.unknown().nullable(),
});
export type SyncChangeResult = z.infer<typeof syncChangeResultSchema>;

export const syncPushResponseSchema = z.object({
  /** Hasil untuk perubahan yang selesai diproses, sesuai urutan. Sisanya dicoba lagi nanti. */
  results: z.array(syncChangeResultSchema),
});

/**
 * Event yang ditolak server karena urutan riwayat tidak masuk akal, disimpan utuh agar tidak
 * hilang (tabel `sync_changes`, hasil `needs_review`). Disinkronkan ke pencatat dan admin.
 */
export const syncReviewSchema = baseRowSchema.extend({
  userId: idSchema,
  kind: z.enum(SYNC_CHANGE_KINDS),
  rowId: idSchema.nullable(),
  animalId: idSchema.nullable(),
  code: z.string().nullable(),
  message: z.string().nullable(),
  /** Isi perubahan asli (method, path, body). */
  payload: z.record(z.string(), z.unknown()),
  resolvedAt: timestampSchema.nullable(),
  resolution: z.enum(SYNC_REVIEW_RESOLUTIONS).nullable(),
});
export type SyncReview = z.infer<typeof syncReviewSchema>;
