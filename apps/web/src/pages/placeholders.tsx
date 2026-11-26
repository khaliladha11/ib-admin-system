// Pengalih kontras tinggi (dipakai di Lainnya dan /dev/komponen).
import { Contrast } from 'lucide-react';

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
