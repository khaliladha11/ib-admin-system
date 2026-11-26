// Satu lembar A4 berisi label QR. Ukuran dalam mm agar cocok dengan kertas stiker saat
// dicetak; pratinjau di layar memakai lembar yang sama, diperkecil (`SheetPreview`).
import { useEffect, useRef, useState } from 'react';

import { QrCode } from '@/components/qr-code';
import { labelPayload } from '@/lib/qr-config';

import { A4, qrSizeMm, type LabelItem, type SheetLayout } from './sheet-layout';

const mm = (n: number) => `${String(n)}mm`;

export function LabelSheet({
  labels,
  layout,
  guides = false,
}: {
  labels: (LabelItem | null)[];
  layout: SheetLayout;
  /** Garis potong putus-putus (hanya pratinjau; kertas stiker sudah terpotong). */
  guides?: boolean;
}) {
  const qr = qrSizeMm(layout);
  const small = layout.perSheet === 40;
  return (
    <div
      className="label-sheet bg-(--print-paper) text-(--print-ink)"
      style={{
        width: mm(A4.width),
        height: mm(A4.height),
        padding: `${mm(layout.marginY)} ${mm(layout.marginX)}`,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: `repeat(${String(layout.columns)}, ${mm(layout.labelWidth)})`,
        gridAutoRows: mm(layout.labelHeight),
        overflow: 'hidden',
      }}
    >
      {labels.map((label, i) => (
        <div
          key={label?.code ?? `kosong-${String(i)}`}
          data-label={label?.code}
          className={guides ? 'outline-1 -outline-offset-1 outline-(--line) outline-dashed' : ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: mm(1.5),
            padding: mm(2),
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {label && (
            <>
              <QrCode
                value={labelPayload(label.code)}
                className="shrink-0"
                style={{ width: mm(qr), height: mm(qr) }}
              />
              <div style={{ minWidth: 0, lineHeight: 1.15 }}>
                <div
                  style={{
                    fontSize: mm(small ? 3.3 : 4.4),
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label.code}
                </div>
                {label.name && (
                  <div
                    style={{
                      fontSize: mm(small ? 2.8 : 3.5),
                      marginTop: mm(1),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label.name}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** 1 mm dalam px CSS (96 dpi). */
const PX_PER_MM = 96 / 25.4;

/** Lembar yang sama dengan hasil cetak, diperkecil agar muat lebar layar. */
export function SheetPreview(props: Parameters<typeof LabelSheet>[0]) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => {
      setScale(el.clientWidth / (A4.width * PX_PER_MM));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);
  return (
    <div
      ref={box}
      className="w-full overflow-hidden rounded-md border-(length:--bw) border-border shadow-card"
      style={{ height: A4.height * PX_PER_MM * scale }}
      aria-hidden="true"
    >
      <div style={{ transform: `scale(${String(scale)})`, transformOrigin: 'top left' }}>
        <LabelSheet {...props} guides />
      </div>
    </div>
  );
}
