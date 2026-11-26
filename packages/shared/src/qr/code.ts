// Kode QR ternak: `IB-` + 5 karakter acak dari 32 simbol yang tidak mirip satu sama lain
// (tanpa O/0 dan I/1). 32^5 ≈ 33,5 juta kemungkinan. Fungsi di sini murni: sumber acak
// diberikan pemanggil (crypto.getRandomValues di web), sehingga bisa dites.
import { QR_CODE_PATTERN } from '../schemas/entities';

/** 32 simbol: 2–9 dan A–Z tanpa I dan O. Sama dengan pola `QR_CODE_PATTERN`. */
export const QR_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const QR_PREFIX = 'IB-';
export const QR_CODE_LENGTH = 5;

/** Mengisi array dengan byte acak (mis. `crypto.getRandomValues`). */
export type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

/** Satu kode acak. 256 habis dibagi 32, jadi `byte & 31` tidak berat sebelah. */
export function generateQrCode(fill: RandomFill): string {
  const bytes = fill(new Uint8Array(QR_CODE_LENGTH));
  let body = '';
  for (const b of bytes) body += QR_ALPHABET.charAt(b & 31);
  return QR_PREFIX + body;
}

export class QrCodeExhaustedError extends Error {
  constructor() {
    super('Tidak bisa membuat kode QR baru yang unik. Coba lagi.');
  }
}

/**
 * `count` kode baru yang berbeda satu sama lain dan tidak ada di `isTaken`
 * (semua kode yang diketahui perangkat: label tercetak dan tag terpasang).
 * Keunikan antarperangkat dijaga server (indeks unik di `qr_codes`).
 */
export function generateUniqueQrCodes(
  count: number,
  isTaken: (code: string) => boolean,
  fill: RandomFill,
  maxAttempts = count * 20 + 100,
): string[] {
  const out = new Set<string>();
  let attempts = 0;
  while (out.size < count) {
    if (attempts++ >= maxAttempts) throw new QrCodeExhaustedError();
    const code = generateQrCode(fill);
    if (!out.has(code) && !isTaken(code)) out.add(code);
  }
  return [...out];
}

/** Isi QR: kodenya saja, atau URL `https://domain/t/IB-XXXXX` bila base URL diatur. */
export function qrPayload(code: string, baseUrl?: string | null): string {
  const base = baseUrl?.trim().replace(/\/+$/, '');
  return base ? `${base}/t/${code}` : code;
}

/**
 * Ambil kode dari hasil scan atau ketikan: kode langsung (huruf kecil boleh) atau URL
 * berakhiran `/t/IB-XXXXX`. Hasilnya null bila bukan kode ternak yang sah.
 */
export function parseQrCode(text: string): string | null {
  const raw = text.trim();
  const fromUrl = /\/t\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(raw);
  const candidate = (fromUrl?.[1] ?? raw).toUpperCase().replace(/\s+/g, '');
  const withPrefix = candidate.startsWith(QR_PREFIX)
    ? candidate
    : candidate.length === QR_CODE_LENGTH
      ? QR_PREFIX + candidate
      : candidate;
  return QR_CODE_PATTERN.test(withPrefix) ? withPrefix : null;
}
