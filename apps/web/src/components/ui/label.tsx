// Komponen shadcn/ui (gaya new-york) tanpa Radix: <label> biasa sudah cukup.
import type * as React from 'react';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('text-base leading-tight font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export { Label };
