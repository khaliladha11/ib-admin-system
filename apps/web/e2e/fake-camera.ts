// Kamera palsu untuk e2e: video Y4M satu frame berisi QR, dipakai Chromium lewat
// --use-file-for-fake-video-capture. Di Chromium Linux tidak ada BarcodeDetector, jadi
// jalur cadangan ZXing yang teruji.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { encode } from 'uqr';

/** Kode yang dipakai e2e Scan; tidak ada di data contoh. */
export const FAKE_CAMERA_CODE = 'IB-SCAN2';

export function writeQrVideo(file: string, text: string, width = 640, height = 480) {
  const { size, data } = encode(text, { ecc: 'M', border: 4 });
  const scale = Math.floor((Math.min(width, height) * 0.7) / size);
  const ox = Math.floor((width - size * scale) / 2);
  const oy = Math.floor((height - size * scale) / 2);
  const y = Buffer.alloc(width * height, 0xe0); // latar abu terang
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = data[row]?.[col] ? 0x10 : 0xf0;
      for (let dy = 0; dy < scale; dy++) {
        const start = (oy + row * scale + dy) * width + ox + col * scale;
        y.fill(value, start, start + scale);
      }
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${String(width)} H${String(height)} F10:1 Ip A1:1 C420jpeg\n`),
      Buffer.from('FRAME\n'),
      y,
      chroma,
      chroma,
    ]),
  );
}
