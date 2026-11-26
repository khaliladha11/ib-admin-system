// Pesan service worker untuk pengguna: versi baru siap dipasang, atau aplikasi siap dipakai
// tanpa sinyal (pertama kali semua berkas selesai disimpan di HP).

export interface SwState {
  needRefresh: boolean;
  offlineReady: boolean;
}

export type SwMessage =
  { kind: 'update'; title: string; body: string } | { kind: 'ready'; title: string; body: string };

/** Cek versi baru setiap jam selama aplikasi terbuka dan ada sinyal. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Pesan "siap tanpa sinyal" hilang sendiri setelah beberapa detik. */
export const READY_MESSAGE_MS = 6000;

export function swMessage(state: SwState): SwMessage | null {
  if (state.needRefresh) {
    return {
      kind: 'update',
      title: 'Versi baru tersedia',
      body: 'Catatan Anda aman. Perbarui sekarang untuk memakai versi terbaru.',
    };
  }
  if (state.offlineReady) {
    return {
      kind: 'ready',
      title: 'Siap dipakai tanpa sinyal',
      body: 'Aplikasi sudah tersimpan di HP ini dan tetap terbuka dalam mode pesawat.',
    };
  }
  return null;
}
