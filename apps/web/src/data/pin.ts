// PIN 4–6 angka untuk membuka aplikasi di perangkat sendiri tanpa password.
// Disimpan hanya di perangkat ini sebagai hash PBKDF2-SHA256 (dengan salt acak);
// tidak pernah dikirim ke server. Setelah 5 kali salah, PIN dihapus dan pengguna
// harus masuk dengan password.
import type { IbDb, PinRecord } from './db';
import { LocalValidationError } from './errors';
import { unlockApp } from './lock';

export const PIN_PATTERN = /^\d{4,6}$/;
export const PIN_MAX_FAILURES = 5;
const ITERATIONS = 150_000;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function hasPin(db: IbDb): Promise<boolean> {
  return (await db.getMeta('pin')) !== undefined;
}

export async function setPin(db: IbDb, pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new LocalValidationError('PIN harus 4 sampai 6 angka.');
  if (!(await db.getMeta('session'))) {
    throw new LocalValidationError('Masuk dengan password dulu sebelum memasang PIN.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: PinRecord = {
    salt: toBase64(salt),
    hash: await derive(pin, salt, ITERATIONS),
    iterations: ITERATIONS,
    failures: 0,
  };
  await db.setMeta('pin', record);
  // Memasang PIN berarti pengguna sedang di dalam aplikasi: jangan langsung terkunci.
  unlockApp();
}

export async function clearPin(db: IbDb): Promise<void> {
  await db.meta.delete('pin');
}

export type PinResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }
  | { ok: false; reason: 'reset' };

/** Periksa PIN. Benar → aplikasi terbuka. Salah 5 kali → PIN dihapus, masuk lagi dengan password. */
export async function verifyPin(db: IbDb, pin: string): Promise<PinResult> {
  const record = await db.getMeta('pin');
  if (!record) return { ok: false, reason: 'reset' };
  const hash = await derive(pin, fromBase64(record.salt), record.iterations);
  if (hash === record.hash) {
    await db.setMeta('pin', { ...record, failures: 0 });
    unlockApp();
    return { ok: true };
  }
  const failures = record.failures + 1;
  if (failures >= PIN_MAX_FAILURES) {
    await db.meta.bulkDelete(['pin', 'session']);
    return { ok: false, reason: 'reset' };
  }
  await db.setMeta('pin', { ...record, failures });
  return { ok: false, reason: 'wrong', attemptsLeft: PIN_MAX_FAILURES - failures };
}
