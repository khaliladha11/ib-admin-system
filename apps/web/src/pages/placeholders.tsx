// Layar Scan (dibuat di langkah 3.2) dan pengalih kontras tinggi.
import { Contrast, ScanQrCode } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';

export function ScanPage() {
  return (
    <EmptyState icon={ScanQrCode} art="meadow" title="Pemindai QR belum tersedia">
      Pemindai kamera dibuat di langkah 3.2. Untuk sementara, cari ternak dari menu Ternak.
    </EmptyState>
  );
}

export function ContrastToggle({
  mode,
  onChange,
}: {
  mode: 'normal' | 'high';
  onChange: (mode: 'normal' | 'high') => void;
}) {
  const high = mode === 'high';
  return (
    <label className="surface flex min-h-14 cursor-pointer items-center justify-between gap-4 p-4">
      <span className="flex items-center gap-3">
        <Contrast aria-hidden="true" className="size-6 shrink-0" />
        <span>
          <span className="block font-bold">Kontras tinggi</span>
          <span className="block text-muted-foreground">
            Teks hitam pekat dan garis tebal, untuk layar di bawah terik matahari.
          </span>
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={high}
        onChange={(e) => {
          onChange(e.target.checked ? 'high' : 'normal');
        }}
        className="size-7 shrink-0 accent-(--leaf)"
      />
    </label>
  );
}
