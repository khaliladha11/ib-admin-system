// Catatan pemakaian anonim (langkah 5.1): HANYA di perangkat ini.
// - Tidak masuk outbox, tidak ikut sinkron, tidak ada fetch di modul ini.
// - Tidak menyimpan id pengguna, id ternak, atau isi form; hanya jenis kegiatan dan lamanya.
// - Dibatasi MAX_USAGE_ROWS baris (yang tertua dibuang).
import type { IbDb, UsageRow } from './db';

export const MAX_USAGE_ROWS = 5000;
/** Form yang terbuka lebih lama dari ini dianggap ditinggal: lamanya tidak dicatat. */
export const MAX_FORM_MS = 30 * 60_000;
/** Form yang ditutup sebelum ini (mis. salah pencet) tidak dicatat sebagai batal. */
export const MIN_CANCEL_MS = 2000;

const localDay = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export type UsageInput = Pick<UsageRow, 'kind' | 'name'> &
  Partial<Pick<UsageRow, 'eventType' | 'durationMs'>>;

export async function recordUsage(db: IbDb, input: UsageInput, at: number): Promise<void> {
  const durationMs =
    input.durationMs === undefined || input.durationMs === null
      ? null
      : input.durationMs > MAX_FORM_MS
        ? null
        : Math.max(0, Math.round(input.durationMs));
  try {
    await db.transaction('rw', db.usage, async () => {
      await db.usage.add({
        kind: input.kind,
        name: input.name,
        eventType: input.eventType ?? null,
        durationMs,
        at,
        day: localDay(at),
      });
      const extra = (await db.usage.count()) - MAX_USAGE_ROWS;
      if (extra > 0) {
        const oldest = await db.usage.orderBy('seq').limit(extra).primaryKeys();
        await db.usage.bulkDelete(oldest);
      }
    });
  } catch {
    // Catatan pemakaian tidak boleh mengganggu pencatatan.
  }
}

export async function loadUsage(db: IbDb): Promise<UsageRow[]> {
  return db.usage.orderBy('seq').toArray();
}

export async function clearUsage(db: IbDb): Promise<void> {
  await db.usage.clear();
}
