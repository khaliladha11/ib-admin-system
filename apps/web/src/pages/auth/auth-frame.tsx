// Bingkai layar masuk/PIN: nama aplikasi di atas, isi di tengah. Tanpa navigasi.
import type { ReactNode } from 'react';

import { CycleTrack } from '@/components/cycle-track';

export function AuthFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-8 pb-6">
        <div className="flex flex-col gap-3">
          <p className="text-xl font-bold text-primary">IB Ternak</p>
          <CycleTrack kind="bunting" className="max-w-80" />
          <h1 className="text-2xl font-bold">{title}</h1>
          {intro && <div className="text-muted-foreground">{intro}</div>}
        </div>
        <div className="rounded-xl border-(length:--bw) bg-card p-4">{children}</div>
      </div>
    </div>
  );
}
