// Daftar scan beruntun: tersimpan di memori selama aplikasi terbuka, sehingga tetap ada saat
// pengguna mendaftarkan sapi lalu kembali ke Scan. Hanya teks scan; hasilnya dicari ulang
// (live) agar status "belum terdaftar" berubah setelah sapi didaftarkan.
import { useSyncExternalStore } from 'react';

export interface BatchItem {
  /** Kode yang sudah dinormalkan (mis. IB-7K2QM atau nomor eartag). */
  key: string;
  text: string;
  at: number;
  /** Berapa kali kode ini discan (scan ulang tidak menambah baris). */
  count: number;
}

let items: BatchItem[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  listeners.forEach((l) => {
    l();
  });
};

export const batchStore = {
  get: () => items,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Tambah hasil scan. true bila kode baru di daftar ini. */
  add(key: string, text: string, at: number): boolean {
    const existing = items.find((i) => i.key === key);
    if (existing) {
      items = items.map((i) => (i.key === key ? { ...i, count: i.count + 1, at } : i));
      emit();
      return false;
    }
    items = [{ key, text, at, count: 1 }, ...items];
    emit();
    return true;
  },
  remove(key: string) {
    items = items.filter((i) => i.key !== key);
    emit();
  },
  clear() {
    items = [];
    emit();
  },
};

export function useBatchItems() {
  return useSyncExternalStore(batchStore.subscribe, batchStore.get, batchStore.get);
}
