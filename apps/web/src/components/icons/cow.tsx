// Ikon kepala sapi bergaya lucide (24×24, garis 2px, currentColor), pengganti ikon tapak kaki.
import type { LucideIcon } from 'lucide-react';
import { forwardRef, type SVGProps } from 'react';

export interface CowIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

const CowIcon = forwardRef<SVGSVGElement, CowIconProps>(function Cow(
  { size = 24, strokeWidth = 2, className, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* tanduk */}
      <path d="M8.5 5.5C8 4 6.8 3 5 3" />
      <path d="M15.5 5.5C16 4 17.2 3 19 3" />
      {/* telinga */}
      <path d="M7 8.5C5 8.8 3.2 8 2.5 6.6 4 6 5.8 6.4 7 7.4" />
      <path d="M17 8.5c2 .3 3.8-.5 4.5-1.9C20 6 18.2 6.4 17 7.4" />
      {/* kepala */}
      <path d="M7 13.5V7.5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v6" />
      {/* moncong */}
      <path d="M6.5 16.8c0-1.9 1.6-3.4 3.5-3.4h4c1.9 0 3.5 1.5 3.5 3.4S15.9 20.5 14 20.5h-4c-1.9 0-3.5-1.8-3.5-3.7z" />
      {/* mata dan lubang hidung */}
      <path d="M9.8 9.8h.01" />
      <path d="M14.2 9.8h.01" />
      <path d="M10.2 17h.01" />
      <path d="M13.8 17h.01" />
    </svg>
  );
});

/** Bertipe sama dengan ikon lucide agar bisa dipakai di tempat yang sama (navigasi, EmptyState). */
export const Cow = CowIcon as unknown as LucideIcon;
