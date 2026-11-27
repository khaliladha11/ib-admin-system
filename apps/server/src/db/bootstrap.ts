// Pemasangan baru (langkah 4.3): database kosong → buat wilayah + akun admin dinas pertama dari
// env ADMIN_EMAIL/ADMIN_PASSWORD (diisi skrip instal), atau data contoh bila DEMO_DATA=1.
import { SERVER_DEVICE_ID, uuidv7 } from '@ib/shared';

import { hashPassword } from '../auth/password';
import { nonEmpty } from '../config';
import { countRows, type Db } from './client';
import { locations, users } from './schema';
import { buildSeedData, insertSeedData, setSeedPasswords } from './seed';

export async function bootstrapDatabase(
  db: Db,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): Promise<'demo' | 'admin' | 'skip'> {
  if (countRows(db, users) > 0) return 'skip';
  if (env.DEMO_DATA === '1') {
    insertSeedData(db, buildSeedData(now));
    await setSeedPasswords(db);
    return 'demo';
  }
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? '';
  if (!email || password.length < 8) return 'skip';
  const base = { createdAt: now, updatedAt: now, deletedAt: null, deviceId: SERVER_DEVICE_ID };
  const locationId = uuidv7(now);
  const passwordHash = await hashPassword(password);
  db.transaction((tx) => {
    tx.insert(locations)
      .values({
        ...base,
        id: locationId,
        parentId: null,
        level: 'agency',
        name: nonEmpty(env.REGION_NAME) ?? 'Wilayah pos IB',
        code: null,
      })
      .run();
    tx.insert(users)
      .values({
        ...base,
        id: uuidv7(now),
        name: nonEmpty(env.ADMIN_NAME) ?? 'Admin pos IB',
        email,
        phone: null,
        passwordHash,
        role: 'agency_admin',
        locationId,
        isActive: true,
      })
      .run();
  });
  return 'admin';
}
