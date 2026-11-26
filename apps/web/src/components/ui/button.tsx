// Komponen shadcn/ui (gaya new-york, Tailwind v4).
// Penyesuaian proyek: tinggi minimum 44px (h-11) dan teks 16px agar nyaman disentuh
// di HP, sesuai CLAUDE.md.
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-base font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-leaf-strong',
        accent: 'bg-accent text-accent-foreground shadow-card hover:brightness-95',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-90',
        outline: 'border-(length:--bw) border-input bg-card text-foreground hover:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-95',
        ghost: 'text-foreground hover:bg-secondary',
        link: 'text-primary underline underline-offset-4',
      },
      size: {
        default: 'h-11 px-6 py-2 has-[>svg]:px-5',
        sm: 'h-11 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 px-6 has-[>svg]:px-5',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
