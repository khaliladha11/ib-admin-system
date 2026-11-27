// Batas percobaan masuk (langkah 6.1). Disimpan di memori server (cukup untuk satu server pos):
// - per akun (email/no. HP yang diketik): LOGIN_MAX_ATTEMPTS gagal → dikunci LOGIN_LOCK_MINUTES;
// - per alamat IP: 6× batas itu, agar satu perangkat tidak bisa mencoba banyak akun.
// Dicek SEBELUM password diperiksa (argon2 sengaja lambat). Masuk berhasil mengosongkan hitungan akun.

export interface LoginLimitOptions {
  maxAttempts: number;
  lockMs: number;
}

interface Bucket {
  failures: number;
  /** Awal jendela hitungan; hitungan kedaluwarsa setelah lockMs. */
  since: number;
  lockedUntil: number | null;
}

export const IP_FACTOR = 6;

export function createLoginLimiter({ maxAttempts, lockMs }: LoginLimitOptions) {
  const buckets = new Map<string, Bucket>();

  function bucket(key: string, now: number): Bucket {
    const b = buckets.get(key);
    if (
      !b ||
      (b.lockedUntil === null && now - b.since > lockMs) ||
      (b.lockedUntil !== null && now >= b.lockedUntil)
    ) {
      const fresh = { failures: 0, since: now, lockedUntil: null };
      buckets.set(key, fresh);
      return fresh;
    }
    return b;
  }

  const keys = (identifier: string, ip: string) => [
    { key: `id:${identifier.trim().toLowerCase().replace(/[\s-]/g, '')}`, max: maxAttempts },
    { key: `ip:${ip}`, max: maxAttempts * IP_FACTOR },
  ];

  return {
    /** Detik sampai boleh mencoba lagi, atau null bila boleh sekarang. */
    retryAfter(identifier: string, ip: string, now: number): number | null {
      let wait = 0;
      for (const { key } of keys(identifier, ip)) {
        const b = bucket(key, now);
        if (b.lockedUntil !== null) wait = Math.max(wait, b.lockedUntil - now);
      }
      return wait > 0 ? Math.ceil(wait / 1000) : null;
    },
    failed(identifier: string, ip: string, now: number) {
      for (const { key, max } of keys(identifier, ip)) {
        const b = bucket(key, now);
        b.failures += 1;
        if (b.failures >= max) b.lockedUntil = now + lockMs;
      }
      // Bersihkan sesekali agar Map tidak tumbuh tanpa batas.
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) {
          if ((b.lockedUntil ?? b.since + lockMs) < now) buckets.delete(k);
        }
      }
    },
    succeeded(identifier: string, ip: string) {
      buckets.delete(keys(identifier, ip)[0]?.key ?? '');
    },
  };
}

export type LoginLimiter = ReturnType<typeof createLoginLimiter>;
