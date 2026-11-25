// Pilihan memakai <select> bawaan browser: di Android tampil sebagai daftar layar penuh
// yang besar dan mudah disentuh, dan tetap jalan tanpa JavaScript tambahan.
import { ChevronDown } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

import { fieldClass } from './input';

function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(fieldClass, 'h-12 appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
