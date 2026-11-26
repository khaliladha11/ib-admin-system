// Kerangka aplikasi. HP: bilah atas + navigasi bawah (Scan menonjol di tengah).
// Layar ≥ 1024px: sidebar kiri dengan item yang sama.
import {
  Link,
  useRouter,
  useRouterState,
  type StaticDataRouteOption,
} from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Meadow } from '@/components/illustrations/meadow';
import { SyncIndicator } from '@/components/sync-indicator';
import { cn } from '@/lib/utils';

import { useSession } from '@/data';

import { isAdminRole, navItemsFor, titleFor, type NavItem } from './nav-items';

const APP_NAME = 'IB Ternak';

function BottomNav({ items }: { items: readonly NavItem[] }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-20 border-t-(length:--bw) border-line-strong bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgb(20_38_26/0.12)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, shortLabel, icon: Icon }) => {
          const scan = to === '/scan';
          return (
            <li key={to} className="flex">
              <Link
                to={to}
                aria-label={shortLabel ? label : undefined}
                activeOptions={{ exact: to === '/' }}
                className={cn(
                  'group flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-sm font-semibold text-muted-foreground',
                  'aria-[current=page]:font-bold aria-[current=page]:text-primary',
                )}
              >
                {scan ? (
                  <span className="-mt-7 flex size-16 items-center justify-center rounded-full border-4 border-card bg-straw text-ink shadow-md group-aria-[current=page]:outline-3 group-aria-[current=page]:outline-ink">
                    <Icon aria-hidden="true" className="size-8" strokeWidth={2.25} />
                  </span>
                ) : (
                  <span className="flex h-8 w-14 items-center justify-center rounded-full group-aria-[current=page]:bg-secondary">
                    <Icon aria-hidden="true" className="size-6" strokeWidth={2.25} />
                  </span>
                )}
                <span className={cn('whitespace-nowrap', scan && 'text-foreground')}>
                  {shortLabel ?? label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Sidebar({ items }: { items: readonly NavItem[] }) {
  const scan = items.find((i) => i.to === '/scan');
  const ScanIcon = scan?.icon;
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-62 flex-col gap-6 border-r-(length:--bw) bg-card px-4 py-5 lg:flex">
      <p className="px-2 text-xl font-bold text-primary">{APP_NAME}</p>
      {scan && ScanIcon && (
        <Link
          to={scan.to}
          className="flex min-h-14 items-center gap-3 rounded-lg bg-straw px-4 text-lg font-bold text-ink aria-[current=page]:outline-3 aria-[current=page]:outline-ink"
        >
          <ScanIcon aria-hidden="true" className="size-7" />
          Scan ternak
        </Link>
      )}
      <nav aria-label="Navigasi utama">
        <ul className="flex flex-col gap-1">
          {items
            .filter((i) => i.to !== '/scan')
            .map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact: to === '/' }}
                  className="flex min-h-12 items-center gap-3 rounded-lg border-l-4 border-transparent px-3 text-base font-semibold text-muted-foreground hover:bg-secondary aria-[current=page]:border-primary aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
                >
                  <Icon aria-hidden="true" className="size-6" />
                  {label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      {/* Hiasan pengisi ruang di bawah menu (PC). */}
      <div className="surface mt-auto overflow-hidden">
        <Meadow className="h-28 bg-gradient-to-b from-sky-wash to-paper" />
      </div>
    </aside>
  );
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Judul bilah atas. */
    title?: string;
    /** Layar tugas tunggal (form): tanpa navigasi bawah, dengan tombol kembali. */
    focus?: boolean;
    /** Tujuan tombol kembali bila tidak ada riwayat (dibuka langsung dari tautan). */
    backTo?:
      '/' | '/scan' | '/ternak' | '/tugas' | '/lainnya' | '/permintaan' | '/peternak' | '/pengguna';
  }
}

function BackButton({ fallback }: { fallback: NonNullable<StaticDataRouteOption['backTo']> }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Kembali"
      onClick={() => {
        if (router.history.canGoBack()) router.history.back();
        else void router.navigate({ to: fallback });
      }}
      className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-secondary"
    >
      <ArrowLeft aria-hidden="true" className="size-6" />
    </button>
  );
}

/**
 * Setelah pindah halaman (bukan saat pertama dibuka): umumkan judul halaman dan pindahkan
 * fokus ke judul, agar pengguna pembaca layar tahu halaman sudah berganti.
 */
function useRouteAnnouncement(
  pathname: string,
  title: string,
  headingRef: React.RefObject<HTMLHeadingElement | null>,
) {
  const first = useRef(true);
  const [text, setText] = useState('');
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setText(`Halaman ${title}`);
    headingRef.current?.focus({ preventScroll: true });
  }, [pathname, title, headingRef]);
  return text;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const data = useRouterState({
    select: (s) => s.matches.at(-1)?.staticData ?? {},
  });
  const focus = data.focus ?? false;
  const role = useSession()?.user.role;
  const title =
    data.title ??
    (pathname === '/' ? (isAdminRole(role) ? 'Ringkasan' : 'Hari ini') : titleFor(pathname));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const announcement = useRouteAnnouncement(pathname, title, headingRef);
  return (
    <div className="min-h-dvh">
      <Sidebar items={navItemsFor(role, 'side')} />
      <div className="lg:pl-62">
        <header className="sticky top-0 z-10 border-b-(length:--bw) bg-card/95 backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-300 items-center justify-between gap-2 px-4">
            <div className="flex min-w-0 items-center gap-1">
              {focus && <BackButton fallback={data.backTo ?? '/'} />}
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="truncate text-lg font-bold focus:outline-none"
              >
                {title}
              </h1>
            </div>
            <SyncIndicator compact={focus} />
          </div>
        </header>
        <main className={cn('mx-auto max-w-300 px-4 pt-4', focus ? 'pb-6' : 'pb-28 lg:pb-10')}>
          {children}
        </main>
      </div>
      {!focus && <BottomNav items={navItemsFor(role, 'bottom')} />}
      {/* Diumumkan pembaca layar setiap pindah halaman. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
