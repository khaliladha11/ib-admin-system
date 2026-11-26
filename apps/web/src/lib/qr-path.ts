// Matriks QR (uqr) menjadi satu path SVG.
import { encode } from 'uqr';

export function qrPath(value: string): { size: number; d: string } {
  // ECC M: tahan ±15% rusak/kotor (label di kandang).
  const { size, data } = encode(value, { ecc: 'M', border: 2 });
  let d = '';
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${String(x)} ${String(y)}h1v1h-1z`;
    });
  });
  return { size, d };
}
