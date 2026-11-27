// Penulis ZIP dipindah ke @ib/shared (langkah 6.2) agar dipakai juga di HP untuk file .xlsx.
import { zipFiles as zipBytes, type ZipEntry } from '@ib/shared';

export { crc32 } from '@ib/shared';

export function zipFiles(files: readonly ZipEntry[], date = new Date()): Buffer {
  const bytes = zipBytes(files, date);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
