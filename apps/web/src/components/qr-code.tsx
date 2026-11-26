// Gambar QR sebagai SVG (library `uqr`, tanpa server). Satu <path> agar ringan saat dicetak
// 40 label sekaligus, dan tajam di printer apa pun.
import { useMemo, type CSSProperties } from 'react';

import { qrPath } from '@/lib/qr-path';
import { cn } from '@/lib/utils';

export function QrCode({
  value,
  className,
  style,
  label,
}: {
  value: string;
  className?: string;
  style?: CSSProperties;
  /** Teks untuk pembaca layar; tanpa label, QR dianggap hiasan (kode tertulis di sebelahnya). */
  label?: string;
}) {
  const { size, d } = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className={cn('block bg-(--print-paper)', className)}
      style={style}
      shapeRendering="crispEdges"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path d={d} fill="var(--print-ink)" />
    </svg>
  );
}
