// Penulis ZIP sederhana (tanpa kompresi, "stored"), fungsi murni tanpa Buffer agar dipakai server
// (ekspor CSV, langkah 4.3) dan HP/peramban (file .xlsx, langkah 6.2). Cukup untuk Excel,
// LibreOffice, dan pengelola file HP.
import { utf8 } from './utf8';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Waktu DOS (lokal) untuk header ZIP. */
function dosTime(date: Date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function zipFiles(files: readonly ZipEntry[], date = new Date()): Uint8Array {
  const { time, day } = dosTime(date);
  const names = files.map((f) => utf8(f.name));
  const localSize = files.reduce((n, f, i) => n + 30 + (names[i]?.length ?? 0) + f.data.length, 0);
  const centralSize = names.reduce((n, name) => n + 46 + name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let pos = 0;
  let central = localSize;
  files.forEach((file, i) => {
    const name = names[i] ?? new Uint8Array();
    const crc = crc32(file.data);
    const offset = pos;
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true); // versi
    view.setUint16(pos + 6, 0x0800, true); // nama UTF-8
    view.setUint16(pos + 8, 0, true); // tanpa kompresi
    view.setUint16(pos + 10, time, true);
    view.setUint16(pos + 12, day, true);
    view.setUint32(pos + 14, crc, true);
    view.setUint32(pos + 18, file.data.length, true);
    view.setUint32(pos + 22, file.data.length, true);
    view.setUint16(pos + 26, name.length, true);
    view.setUint16(pos + 28, 0, true);
    out.set(name, pos + 30);
    out.set(file.data, pos + 30 + name.length);
    pos += 30 + name.length + file.data.length;

    view.setUint32(central, 0x02014b50, true);
    view.setUint16(central + 4, 20, true);
    view.setUint16(central + 6, 20, true);
    view.setUint16(central + 8, 0x0800, true);
    view.setUint16(central + 10, 0, true);
    view.setUint16(central + 12, time, true);
    view.setUint16(central + 14, day, true);
    view.setUint32(central + 16, crc, true);
    view.setUint32(central + 20, file.data.length, true);
    view.setUint32(central + 24, file.data.length, true);
    view.setUint16(central + 28, name.length, true);
    view.setUint32(central + 42, offset, true);
    out.set(name, central + 46);
    central += 46 + name.length;
  });
  const end = localSize + centralSize;
  view.setUint32(end, 0x06054b50, true);
  view.setUint16(end + 8, files.length, true);
  view.setUint16(end + 10, files.length, true);
  view.setUint32(end + 12, centralSize, true);
  view.setUint32(end + 16, localSize, true);
  return out;
}
