// Status kunci aplikasi (PIN) di memori. Saat aplikasi dibuka dan PIN terpasang, aplikasi
// terkunci sampai PIN benar. Tidak disimpan: menutup aplikasi = terkunci lagi.
import { useSyncExternalStore } from 'react';

let unlocked = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function unlockApp() {
  unlocked = true;
  emit();
}

export function lockApp() {
  unlocked = false;
  emit();
}

export function isUnlocked() {
  return unlocked;
}

export function useUnlocked(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => unlocked,
    () => unlocked,
  );
}
