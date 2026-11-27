// Server latihan (langkah 5.1): reset data contoh untuk sesi pelatihan/UAT.
// Hanya berjalan bila DEMO_MODE=1. Semua data diganti data contoh baru dengan tanggal dihitung
// dari hari ini; semua sesi login ikut terhapus. `data_generation` berganti agar HP yang masuk
// lagi membuang data lokal lama (termasuk perubahan yang belum terkirim) tanpa bertanya.
import { uuidv7 } from '@ib/shared';
import { eq } from 'drizzle-orm';

import { hashPassword } from '../auth/password';
import type { Db } from '../db/client';
import { systemMeta } from '../db/schema';
import { buildSeedData, clearAllData, insertSeedData, SEED_PASSWORD } from '../db/seed';
import { users } from '../db/schema';

const GENERATION_KEY = 'data_generation';

/** Penanda isi database; null bila belum pernah direset (server biasa). */
export function dataGeneration(db: Db): string | null {
  return (
    db
      .select({ value: systemMeta.value })
      .from(systemMeta)
      .where(eq(systemMeta.key, GENERATION_KEY))
      .get()?.value ?? null
  );
}

export class DemoModeOffError extends Error {
  constructor() {
    super('Reset data demo hanya bisa di server latihan (DEMO_MODE=1).');
  }
}

/** Ganti seluruh isi database dengan data contoh baru. Kembalikan penanda generasi baru. */
export async function resetDemoData(db: Db, now: number, demoMode: boolean): Promise<string> {
  if (!demoMode) throw new DemoModeOffError();
  const data = buildSeedData(now);
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const generation = uuidv7(now);
  // Satu transaksi: bila gagal di tengah, data lama tetap utuh.
  db.$client.transaction(() => {
    clearAllData(db);
    insertSeedData(db, data);
    db.update(users).set({ passwordHash }).run();
    db.insert(systemMeta)
      .values({ key: GENERATION_KEY, value: generation, updatedAt: now })
      .onConflictDoUpdate({ target: systemMeta.key, set: { value: generation, updatedAt: now } })
      .run();
  })();
  return generation;
}
