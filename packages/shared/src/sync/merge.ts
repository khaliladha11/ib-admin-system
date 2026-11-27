// Penggabungan profil per kolom (docs/SYNC.md §5): setiap kolom punya waktu ubahnya sendiri.
// Kolom yang diubah satu HP saja selalu dipakai; kolom yang diubah dua HP memakai yang lebih
// baru (waktu sama: yang tiba belakangan). Nilai yang kalah dikembalikan agar dicatat di audit.

/** Waktu ubah per kolom (ms UTC, waktu di HP saat kolom diubah). */
export type FieldTimes = Record<string, number>;

export interface FieldMergeResult {
  /** Kolom yang dipakai beserta nilai barunya. */
  apply: Record<string, unknown>;
  /** Nilai sebelum ditimpa, untuk kolom di `apply` (audit `update`). */
  previous: Record<string, unknown>;
  /** Nilai kiriman yang kalah oleh versi lebih baru (audit `conflict`, `before`). */
  lost: Record<string, unknown>;
  /** Nilai yang tetap dipakai untuk kolom yang kalah (audit `conflict`, `after`). */
  kept: Record<string, unknown>;
  /** Waktu ubah per kolom setelah penggabungan. */
  times: FieldTimes;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param current baris saat ini di server
 * @param times waktu ubah per kolom yang tersimpan
 * @param patch kolom yang diubah oleh kiriman
 * @param at waktu ubah kiriman (sudah dipotong agar tidak di masa depan)
 * @param fallback waktu untuk kolom yang belum punya catatan waktu (baris lama: updated_at)
 */
export function mergeFieldVersions(
  current: Record<string, unknown>,
  times: FieldTimes,
  patch: Record<string, unknown>,
  at: number,
  fallback: number,
): FieldMergeResult {
  const result: FieldMergeResult = {
    apply: {},
    previous: {},
    lost: {},
    kept: {},
    times: { ...times },
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const fieldTime = times[key] ?? fallback;
    if (at >= fieldTime) {
      result.times[key] = at;
      if (!same(current[key], value)) {
        result.apply[key] = value;
        result.previous[key] = current[key] ?? null;
      }
    } else if (!same(current[key], value)) {
      result.lost[key] = value;
      result.kept[key] = current[key] ?? null;
    }
  }
  return result;
}

/** Waktu ubah dari HP tidak boleh di masa depan menurut jam server. */
export function clampChangeTime(at: number | undefined, serverNow: number): number {
  if (at === undefined || !Number.isFinite(at) || at <= 0) return serverNow;
  return Math.min(at, serverNow);
}
