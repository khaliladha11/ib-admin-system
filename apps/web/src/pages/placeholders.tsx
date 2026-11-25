// Isi sementara untuk menu utama; layar sebenarnya dibangun di langkah 2.2.
import { Link } from '@tanstack/react-router';
import { ClipboardList, Contrast, House, PawPrint, ScanQrCode, SwatchBook } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useContrastMode } from '@/design/contrast-mode';

export function HomePage() {
  return (
    <EmptyState icon={House} title="Belum ada pengingat">
      Pengingat birahi, jadwal PKB, dan perkiraan lahir akan muncul di sini setelah data ternak
      tersimpan di HP ini.
    </EmptyState>
  );
}

export function AnimalsPage() {
  return (
    <EmptyState
      icon={PawPrint}
      title="Belum ada ternak di HP ini"
      action={
        <Button asChild>
          <Link to="/scan">Scan label ternak</Link>
        </Button>
      }
    >
      Scan label QR di telinga sapi untuk membuka atau mendaftarkan ternak.
    </EmptyState>
  );
}

export function ScanPage() {
  return (
    <EmptyState icon={ScanQrCode} title="Pemindai QR belum tersedia">
      Pemindai kamera dibuat di langkah 3.2. Untuk sementara, cari ternak dari menu Ternak.
    </EmptyState>
  );
}

export function TasksPage() {
  return (
    <EmptyState icon={ClipboardList} title="Tidak ada tugas">
      Permintaan IB dan PKB yang ditugaskan kepada Anda akan tampil di sini.
    </EmptyState>
  );
}

export function MorePage() {
  const [mode, setMode] = useContrastMode();
  return (
    <div className="flex flex-col gap-4">
      <ContrastToggle mode={mode} onChange={setMode} />
      <Button variant="outline" size="lg" asChild className="justify-start">
        <Link to="/dev/komponen">
          <SwatchBook aria-hidden="true" />
          Lihat semua komponen
        </Link>
      </Button>
    </div>
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
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border-(length:--bw) bg-card p-4">
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
