// Cursor pull berhalaman (docs/SYNC.md §4): posisi baris terakhir dalam urutan
// (updated_at, urutan tabel, id). Ditulis sebagai teks; klien menyimpannya apa adanya.

export interface SyncCursor {
  /** updated_at baris terakhir. */
  t: number;
  /** Urutan tabel baris terakhir. */
  tb: number;
  /** id baris terakhir. */
  id: string;
}

export function encodeCursor(c: SyncCursor): string {
  return `${String(c.t)}.${String(c.tb)}.${c.id}`;
}

/** null untuk cursor kosong (tarik dari awal); lempar error untuk teks rusak. */
export function decodeCursor(text: string | null | undefined): SyncCursor | null {
  if (!text) return null;
  const match = /^(\d+)\.(\d+)\.([0-9a-f-]{1,64})$/.exec(text);
  if (!match) throw new Error('Cursor sinkron tidak valid.');
  return { t: Number(match[1]), tb: Number(match[2]), id: match[3] ?? '' };
}

/** Apakah baris (t, tb, id) berada SETELAH cursor. */
export function isAfterCursor(row: SyncCursor, cursor: SyncCursor | null): boolean {
  if (!cursor) return true;
  if (row.t !== cursor.t) return row.t > cursor.t;
  if (row.tb !== cursor.tb) return row.tb > cursor.tb;
  return row.id > cursor.id;
}

export function compareCursor(a: SyncCursor, b: SyncCursor): number {
  return a.t - b.t || a.tb - b.tb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Sidik jari cakupan data pengguna (peternak, permintaan, pemegang straw yang terlihat).
 * Bila berubah, pull diulang dari awal. FNV-1a 2×32 bit atas id yang diurutkan.
 */
export function scopeKey(ids: Iterable<string>): string {
  const sorted = [...new Set(ids)].sort();
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ sorted.length;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      const c = id.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
    h1 = Math.imul(h1 ^ 0x2c, 0x01000193) >>> 0; // pemisah antar-id
  }
  return `${sorted.length.toString(36)}-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
