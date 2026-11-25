/**
 * UUID versi 7 (RFC 9562): 48 bit waktu (ms) + 74 bit acak.
 * Bisa dibuat di HP saat offline dan terurut menurut waktu pembuatan.
 * Waktu dan sumber acak bisa disuntikkan agar mudah dites.
 */
// Web Crypto tersedia di browser dan Node 22; diakses lewat globalThis agar
// paket ini tidak bergantung pada lib DOM atau @types/node.
interface WebCrypto {
  getRandomValues(array: Uint8Array): Uint8Array;
}
const webCrypto = (globalThis as unknown as { crypto: WebCrypto }).crypto;

export function uuidv7(
  now: number = Date.now(),
  randomBytes: (n: number) => Uint8Array = (n) => webCrypto.getRandomValues(new Uint8Array(n)),
): string {
  if (!Number.isInteger(now) || now < 0 || now > 0xffff_ffff_ffff) {
    throw new RangeError('Waktu untuk UUIDv7 harus bilangan bulat 48 bit');
  }
  const bytes = new Uint8Array(16);
  bytes.set(randomBytes(10), 6);
  let ms = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // versi 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // varian RFC
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Waktu pembuatan (ms) yang tersimpan di UUIDv7. */
export function uuidv7Timestamp(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
