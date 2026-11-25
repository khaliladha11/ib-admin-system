import { hash, verify } from '@node-rs/argon2';

/** Hash password dengan argon2id (parameter bawaan @node-rs/argon2, rekomendasi OWASP). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

let dummyHash: Promise<string> | null = null;

/**
 * Cocokkan password. Bila pengguna tidak ada, tetap jalankan verifikasi terhadap
 * hash palsu agar waktu respons tidak membocorkan apakah akun terdaftar.
 */
export async function verifyPassword(
  storedHash: string | null,
  password: string,
): Promise<boolean> {
  if (!storedHash) {
    dummyHash ??= hash('password-palsu-untuk-penyamaan-waktu');
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return verify(storedHash, password).catch(() => false);
}
