// Mode kontras tinggi: atribut data-contrast="high" di <html>, disimpan per perangkat.
import { useCallback, useSyncExternalStore } from 'react';

export type ContrastMode = 'normal' | 'high';
const STORAGE_KEY = 'ib-contrast';
const listeners = new Set<() => void>();

function read(): ContrastMode {
  return document.documentElement.dataset.contrast === 'high' ? 'high' : 'normal';
}

export function applyContrastMode(mode: ContrastMode) {
  if (mode === 'high') document.documentElement.dataset.contrast = 'high';
  else delete document.documentElement.dataset.contrast;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Penyimpanan diblokir: mode tetap berlaku sampai halaman ditutup.
  }
  for (const l of listeners) l();
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Pasang mode tersimpan saat aplikasi dibuka. */
export function restoreContrastMode() {
  if (readSaved() === 'high') document.documentElement.dataset.contrast = 'high';
}

export function useContrastMode() {
  const mode = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 'normal' as const,
  );
  const setMode = useCallback((next: ContrastMode) => {
    applyContrastMode(next);
  }, []);
  return [mode, setMode] as const;
}
