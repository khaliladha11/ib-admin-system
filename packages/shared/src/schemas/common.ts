import { z } from 'zod';

/** UUID yang dibuat perangkat (dipakai UUIDv7, tetapi versi lain tetap diterima). */
export const idSchema = z.uuid();

/** Cap waktu dalam milidetik sejak epoch (UTC). */
export const timestampSchema = z.int().nonnegative();

/** Tanggal tanpa jam, format YYYY-MM-DD. */
export const dateSchema = z.iso.date();

/** Teks wajib yang sudah dipangkas. */
export const requiredText = (max = 200) => z.string().trim().min(1).max(max);

/** Teks opsional; string kosong dianggap tidak diisi. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? undefined : s))
    .optional();

/** Kolom yang ada di setiap tabel. */
export const baseRowSchema = z.object({
  id: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
  deviceId: requiredText(100),
});

export type BaseRow = z.infer<typeof baseRowSchema>;
