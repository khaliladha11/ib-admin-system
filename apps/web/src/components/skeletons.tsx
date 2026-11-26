// Kerangka (skeleton) saat data lokal sedang dibaca, agar layar tidak putih kosong.
// Kilau hijau bergerak pelan; diam bila "kurangi gerakan" aktif.
import * as m from 'motion/react-m';

import { cn } from '@/lib/utils';

export function Bone({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-secondary', className)}>
      <m.div
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '220%' }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Daftar kartu (ternak, permintaan, pengingat). */
export function ListSkeleton({
  rows = 4,
  label = 'Memuat data…',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <Frame label={label}>
      <Bone className="h-12 rounded-full" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="surface flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <Bone className="h-5 w-2/5" />
            <Bone className="h-7 w-24 rounded-full" />
          </div>
          <Bone className="h-3 w-full" />
          <Bone className="h-4 w-3/5" />
        </div>
      ))}
    </Frame>
  );
}

/** Profil ternak / detail. */
export function DetailSkeleton({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <Frame label={label}>
      <div className="flex items-start gap-4">
        <Bone className="size-28 rounded-2xl" />
        <div className="flex flex-1 flex-col gap-2 pt-2">
          <Bone className="h-8 w-3/4" />
          <Bone className="h-5 w-1/2" />
        </div>
      </div>
      <div className="surface flex flex-col gap-3 p-4">
        <Bone className="h-8 w-32 rounded-full" />
        <Bone className="h-3 w-full" />
        <Bone className="h-4 w-2/3" />
      </div>
      <Bone className="h-12 rounded-full" />
      <Bone className="h-24" />
    </Frame>
  );
}

/** Ringkasan admin. */
export function DashboardSkeleton({ label = 'Memuat ringkasan…' }: { label?: string }) {
  return (
    <Frame label={label}>
      <Bone className="h-10 w-1/2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bone className="h-64 rounded-2xl" />
        <Bone className="h-64 rounded-2xl" />
      </div>
    </Frame>
  );
}

/** Form. */
export function FormSkeleton({ label = 'Menyiapkan form…' }: { label?: string }) {
  return (
    <Frame label={label}>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-14" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Bone key={i} className="h-12" />
      ))}
      <Bone className="h-13 rounded-full" />
    </Frame>
  );
}
