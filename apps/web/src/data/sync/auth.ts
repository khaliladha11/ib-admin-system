// Masuk/keluar. Sesi (peran, id peternak) disimpan di meta agar aplikasi tetap tahu
// siapa penggunanya saat offline. Cookie sesi httpOnly tetap dikelola browser.
import type { UserRole } from '@ib/shared';

import { INITIAL_SYNC_STATE, MIRROR_TABLES, type IbDb, type Session } from '../db';
import { LocalValidationError } from '../errors';
import { lockApp, unlockApp } from '../lock';
import type { ApiClient } from './api';

interface MeResponse {
  user: { id: string; name: string; role: UserRole; locationId: string | null };
  farmerId: string | null;
  /** Penanda isi database server; berganti saat data demo direset (langkah 5.1). */
  generation?: string | null;
  demoMode?: boolean;
}

/**
 * Hapus semua data lokal (tabel cermin, outbox, sesi, cursor). Catatan pemakaian ikut dihapus,
 * kecuali `keepUsage` (reset data demo: perangkat dan pemakainya sama).
 */
export async function clearLocalData(
  db: IbDb,
  { keepUsage = false }: { keepUsage?: boolean } = {},
): Promise<void> {
  await db.transaction(
    'rw',
    [...MIRROR_TABLES.map((t) => db.mirror(t)), db.outbox, db.meta, db.animalPhotos, db.usage],
    async () => {
      await Promise.all(MIRROR_TABLES.map((t) => db.mirror(t).clear()));
      await db.animalPhotos.clear();
      if (!keepUsage) await db.usage.clear();
      await db.outbox.clear();
      await db.meta.where('key').anyOf(['session', 'sync', 'owner', 'pin']).delete();
    },
  );
}

export interface SignInOptions {
  /**
   * Perangkat ini masih menyimpan data akun lain. Default: tolak bila masih ada perubahan
   * yang belum terkirim; true: buang data itu.
   */
  discardOtherAccountData?: boolean;
}

export async function signIn(
  db: IbDb,
  api: ApiClient,
  identifier: string,
  password: string,
  { discardOtherAccountData = false }: SignInOptions = {},
): Promise<Session> {
  const me = await api.request<MeResponse>('POST', '/api/auth/login', { identifier, password });
  const previous = await db.getMeta('owner');
  const generation = me.generation ?? null;
  if (previous && (previous.generation ?? null) !== generation) {
    // Data server diganti (reset data demo): data lokal dan perubahan yang belum terkirim milik
    // isi database lama, jadi dibuang tanpa bertanya. Catatan pemakaian sesi latihan tetap ada.
    await clearLocalData(db, { keepUsage: true });
  } else if (previous && previous.id !== me.user.id) {
    const unsent = await db.outbox.count();
    if (unsent > 0 && !discardOtherAccountData) {
      throw new LocalValidationError(
        `Masih ada ${String(unsent)} perubahan dari akun ${previous.name} yang belum terkirim. Masuk dengan akun itu dulu agar datanya terkirim.`,
      );
    }
    // Data akun lain tidak boleh terlihat oleh akun ini.
    await clearLocalData(db);
  }
  const session: Session = {
    user: {
      id: me.user.id,
      name: me.user.name,
      role: me.user.role,
      locationId: me.user.locationId,
    },
    farmerId: me.farmerId,
    demoMode: me.demoMode ?? false,
  };
  await db.setMeta('session', session);
  await db.setMeta('owner', { id: session.user.id, name: session.user.name, generation });
  unlockApp();
  const sync = (await db.getMeta('sync')) ?? INITIAL_SYNC_STATE;
  await db.setMeta('sync', { ...sync, needsLogin: false, lastError: null });
  return session;
}

/** Keluar dari server. Data lokal tetap ada sampai akun lain masuk (lihat signIn). */
export async function signOut(db: IbDb, api: ApiClient): Promise<void> {
  try {
    await api.request('POST', '/api/auth/logout');
  } catch {
    // Offline: cookie tetap kedaluwarsa sendiri; sesi lokal tetap dihapus.
  }
  // PIN milik akun ini; data lokal tetap ada sampai akun lain masuk (lihat signIn).
  await db.meta.bulkDelete(['session', 'pin']);
  lockApp();
}
