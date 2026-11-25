import { z } from 'zod';

import {
  CALF_CONDITIONS,
  ESTRUS_SIGNS,
  EXIT_REASONS,
  PKB_METHODS,
  PKB_RESULTS,
  WEIGHT_METHODS,
} from '../enums';
import { baseRowSchema, idSchema, optionalText, requiredText, timestampSchema } from './common';

// ---------------------------------------------------------------------------
// Payload per jenis event. Semua strict: field tak dikenal ditolak.
// ---------------------------------------------------------------------------

const notes = optionalText(1000);
const weightKg = z.number().positive().lt(2000);

/** BH: birahi. */
export const bhPayloadSchema = z.strictObject({
  signs: z.array(z.enum(ESTRUS_SIGNS)).max(ESTRUS_SIGNS.length).optional(),
  notes,
});

/** IB: inseminasi buatan. */
export const ibPayloadSchema = z.strictObject({
  strawCode: requiredText(50),
  bullId: requiredText(50),
  bullName: optionalText(100),
  breed: optionalText(50),
  batch: requiredText(50),
  notes,
});

/** PKB: pemeriksaan kebuntingan. Umur janin wajib bila bunting. */
export const pkbPayloadSchema = z
  .strictObject({
    result: z.enum(PKB_RESULTS),
    fetalAgeMonths: z.int().min(1).max(10).optional(),
    method: z.enum(PKB_METHODS).optional(),
    notes,
  })
  .refine((p) => p.result !== 'pregnant' || p.fetalAgeMonths !== undefined, {
    error: 'Umur janin (bulan) wajib diisi bila hasilnya bunting',
    path: ['fetalAgeMonths'],
  })
  .refine((p) => p.result !== 'not_pregnant' || p.fetalAgeMonths === undefined, {
    error: 'Umur janin tidak diisi bila hasilnya tidak bunting',
    path: ['fetalAgeMonths'],
  });

/** KGG: keguguran. */
export const kggPayloadSchema = z.strictObject({
  trimester: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  notes,
});

/** Satu anak dalam event LH. Anak hidup wajib punya ID ternak baru. */
export const calfSchema = z
  .strictObject({
    sex: z.enum(['F', 'M']),
    condition: z.enum(CALF_CONDITIONS),
    calfAnimalId: idSchema.optional(),
    weightKg: weightKg.optional(),
  })
  .refine((c) => c.condition !== 'alive' || c.calfAnimalId !== undefined, {
    error: 'Anak yang lahir hidup wajib didaftarkan sebagai ternak (calfAnimalId)',
    path: ['calfAnimalId'],
  });

/** LH: lahir. Array agar kelahiran kembar bisa dicatat. */
export const lhPayloadSchema = z.strictObject({
  calves: z.array(calfSchema).min(1).max(4),
  notes,
});

/** BB: berat badan. */
export const bbPayloadSchema = z.strictObject({
  weightKg,
  method: z.enum(WEIGHT_METHODS).optional(),
  notes,
});

/** HEALTH: catatan kesehatan. */
export const healthPayloadSchema = z.strictObject({
  condition: requiredText(200),
  treatment: optionalText(500),
  medicine: optionalText(200),
  notes,
});

/** EXIT: ternak keluar (mati, dijual, dipotong). */
export const exitPayloadSchema = z.strictObject({
  reason: z.enum(EXIT_REASONS),
  notes,
});

export const eventPayloadSchemas = {
  BH: bhPayloadSchema,
  IB: ibPayloadSchema,
  PKB: pkbPayloadSchema,
  KGG: kggPayloadSchema,
  LH: lhPayloadSchema,
  BB: bbPayloadSchema,
  HEALTH: healthPayloadSchema,
  EXIT: exitPayloadSchema,
} as const;

export type BhPayload = z.infer<typeof bhPayloadSchema>;
export type IbPayload = z.infer<typeof ibPayloadSchema>;
export type PkbPayload = z.infer<typeof pkbPayloadSchema>;
export type KggPayload = z.infer<typeof kggPayloadSchema>;
export type LhPayload = z.infer<typeof lhPayloadSchema>;
export type BbPayload = z.infer<typeof bbPayloadSchema>;
export type HealthPayload = z.infer<typeof healthPayloadSchema>;
export type ExitPayload = z.infer<typeof exitPayloadSchema>;

// ---------------------------------------------------------------------------
// Event lengkap: kolom umum + pasangan (type, payload).
// ---------------------------------------------------------------------------

const eventCommonFields = {
  animalId: idSchema,
  /** Waktu kejadian sebenarnya (bukan waktu diketik). */
  occurredAt: timestampSchema,
  recordedBy: idSchema,
  serviceRequestId: idSchema.nullable(),
  /** Stok straw yang dipakai (hanya untuk IB). */
  semenStockId: idSchema.nullable(),
  /** Bila terisi, event ini membatalkan event lain (koreksi tanpa menimpa). */
  voidsEventId: idSchema.nullable(),
};

/** Pasangan type + payload, dipakai juga untuk input form. */
export const eventBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BH'), payload: bhPayloadSchema }),
  z.object({ type: z.literal('IB'), payload: ibPayloadSchema }),
  z.object({ type: z.literal('PKB'), payload: pkbPayloadSchema }),
  z.object({ type: z.literal('KGG'), payload: kggPayloadSchema }),
  z.object({ type: z.literal('LH'), payload: lhPayloadSchema }),
  z.object({ type: z.literal('BB'), payload: bbPayloadSchema }),
  z.object({ type: z.literal('HEALTH'), payload: healthPayloadSchema }),
  z.object({ type: z.literal('EXIT'), payload: exitPayloadSchema }),
]);

export type EventBody = z.infer<typeof eventBodySchema>;
export type EventPayload = EventBody['payload'];

export const eventSchema = z
  .intersection(baseRowSchema.extend(eventCommonFields), eventBodySchema)
  .refine((e) => e.semenStockId === null || e.type === 'IB', {
    error: 'Stok straw hanya bisa ditautkan ke event IB',
    path: ['semenStockId'],
  })
  .refine((e) => e.voidsEventId !== e.id, {
    error: 'Event tidak bisa membatalkan dirinya sendiri',
    path: ['voidsEventId'],
  });

export type AnimalEvent = z.infer<typeof eventSchema>;
