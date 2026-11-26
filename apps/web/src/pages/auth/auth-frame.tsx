// Bingkai layar masuk/PIN: nama aplikasi, ilustrasi padang, judul serif, lalu isi. Tanpa navigasi.
import type { ReactNode } from 'react';

import { Cow } from '@/components/icons/cow';
import { Meadow } from '@/components/illustrations/meadow';

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
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-6 pb-6">
        <p className="flex items-center gap-2 text-lg font-bold text-leaf-deep">
          <span className="flex size-10 items-center justify-center rounded-full bg-straw text-ink">
            <Cow aria-hidden="true" className="size-6" />
          </span>
          IB Ternak
        </p>
        <div className="surface overflow-hidden">
          <Meadow className="h-32 bg-gradient-to-b from-sky-wash to-paper" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="display text-[2.75rem]">{title}</h1>
          {intro && <div className="text-muted-foreground">{intro}</div>}
        </div>
        <div className="surface p-4">{children}</div>
      </div>
    </div>
  );
}
