// Hook baca untuk komponen. Semuanya membaca Dexie (useLiveQuery), BUKAN API, sehingga
// tampilan langsung berubah setelah penulisan lokal dan tetap jalan saat offline.
// Nilai `undefined` berarti data lokal masih dimuat.
import { useLiveQuery } from 'dexie-react-hooks';
import { use, useEffect, useMemo } from 'react';

import { DataContext, type DataLayer } from './context';
import {
  loadAnimal,
  loadAnimals,
  loadFarmers,
  loadReminders,
  loadAnimalPhoto,
  loadEventDefaults,
  loadServiceRequestViews,
  loadServiceRequests,
  loadSyncStatus,
  loadTimeline,
  type AnimalFilter,
  type ServiceRequestFilter,
} from './queries';

export function useDataLayer(): DataLayer {
  const layer = use(DataContext);
  if (!layer) throw new Error('useDataLayer harus dipakai di dalam <DataProvider>.');
  return layer;
}

/** Fungsi tulis (simpan lokal + outbox). */
export const useRepo = () => useDataLayer().repo;

export function useSession() {
  const { db } = useDataLayer();
  return useLiveQuery(async () => (await db.getMeta('session')) ?? null, [db]);
}

export function useAnimals(filter: AnimalFilter = {}) {
  const { db, now } = useDataLayer();
  const { farmerId, includeExited } = filter;
  return useLiveQuery(
    () => loadAnimals(db, { farmerId, includeExited }, now()),
    [db, now, farmerId, includeExited],
  );
}

export function useAnimal(id: string) {
  const { db, now } = useDataLayer();
  return useLiveQuery(() => loadAnimal(db, id, now()), [db, now, id]);
}

export function useAnimalTimeline(id: string) {
  const { db, now } = useDataLayer();
  return useLiveQuery(() => loadTimeline(db, id, now()), [db, now, id]);
}

export function useFarmers() {
  const { db } = useDataLayer();
  return useLiveQuery(() => loadFarmers(db), [db]);
}

export function useServiceRequests(filter: ServiceRequestFilter = {}) {
  const { db } = useDataLayer();
  const { status, animalId } = filter;
  return useLiveQuery(() => loadServiceRequests(db, { status, animalId }), [db, status, animalId]);
}

export function useReminders(withinDays = 7) {
  const { db, now } = useDataLayer();
  return useLiveQuery(() => loadReminders(db, withinDays, now()), [db, now, withinDays]);
}

/** Jumlah perubahan yang belum terkirim, yang ditolak server, dan waktu sinkron terakhir. */
export function useSyncStatus() {
  const { db } = useDataLayer();
  return useLiveQuery(() => loadSyncStatus(db), [db]);
}

/** Permintaan layanan + nama ternak/peternak/desa + penugasan aktif. */
export function useServiceRequestViews() {
  const { db, now } = useDataLayer();
  const session = useSession();
  const userId = session?.user.id ?? null;
  return useLiveQuery(() => loadServiceRequestViews(db, userId, now()), [db, now, userId]);
}

/** Isian bawaan form event: IB terakhir, stok straw, tugas aktif untuk ternak ini. */
export function useEventDefaults(animalId: string) {
  const { db } = useDataLayer();
  const session = useSession();
  const userId = session?.user.id ?? null;
  // Tunggu sesi terbaca: tanpa itu stok straw dan IB terakhir pengguna belum diketahui.
  return useLiveQuery(
    () => (session === undefined ? undefined : loadEventDefaults(db, userId, animalId)),
    [db, session, userId, animalId],
  );
}

/** URL foto ternak (lokal), atau null. URL dilepas otomatis saat foto berganti. */
export function useAnimalPhotoUrl(animalId: string): string | null | undefined {
  const { db } = useDataLayer();
  const photo = useLiveQuery(() => loadAnimalPhoto(db, animalId), [db, animalId]);
  const url = useMemo(
    () => (photo ? URL.createObjectURL(new Blob([photo.data], { type: photo.type })) : photo),
    [photo],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/** Apakah PIN pembuka aplikasi terpasang di perangkat ini. */
export function useHasPin() {
  const { db } = useDataLayer();
  return useLiveQuery(async () => (await db.getMeta('pin')) !== undefined, [db]);
}
