// Komponen shadcn/ui (gaya new-york), disesuaikan: tinggi 48px, teks 16px (tanpa zoom di Android),
// garis input ≥ 3:1 terhadap latar.
import type * as React from 'react';

import { cn } from '@/lib/utils';

export const fieldClass =
  'w-full min-w-0 rounded-md border-(length:--bw) border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:border-2';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input type={type} data-slot="input" className={cn(fieldClass, 'h-12', className)} {...props} />
  );
}

export { Input };
