import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { useSyncStatus } from '@/data';
import { useOnline } from '@/hooks/use-online';
import { cn } from '@/lib/utils';

import { describeSync, type SyncState } from './describe-sync';

export interface SyncIndicatorViewProps extends SyncState {
  /** Sentuh untuk sinkron sekarang. */
  onPress?: () => void;
  /** Bungkus sebagai tautan (mis. ke halaman "Data belum terkirim"). */
  renderLink?: (props: { className: string; children: ReactNode }) => ReactNode;
  /** Hanya ikon (+ jumlah); teks lengkap tetap dibacakan pembaca layar. */
  compact?: boolean;
  className?: string;
}

export function SyncIndicatorView({
  onPress,
  renderLink,
  className,
  compact,
  ...state
}: SyncIndicatorViewProps) {
  const view = describeSync(state);
  const Icon = view.icon;
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={cn(
          'size-5 shrink-0',
          view.kind === 'sending' && 'animate-spin [animation-duration:2s]',
        )}
        strokeWidth={2.5}
      />
      {compact ? (
        <>
          <span className="sr-only">{view.text}</span>
          {state.pending + (state.reviews ?? 0) > 0 && (
            <span aria-hidden="true">{state.pending + (state.reviews ?? 0)}</span>
          )}
        </>
      ) : (
        <span>{view.text}</span>
      )}
    </>
  );
  const classes = cn(
    'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-2 text-base font-semibold whitespace-nowrap',
    view.className,
    className,
  );
  return (
    <div role="status" aria-live="polite" data-sync={view.kind}>
      {renderLink ? (
        renderLink({ className: cn(classes, 'hover:bg-secondary'), children: content })
      ) : onPress ? (
        <button type="button" onClick={onPress} className={cn(classes, 'hover:bg-secondary')}>
          {content}
        </button>
      ) : (
        <span className={classes}>{content}</span>
      )}
    </div>
  );
}

/** Indikator yang terhubung ke data lokal dan status koneksi. */
export function SyncIndicator({ className, compact }: { className?: string; compact?: boolean }) {
  const status = useSyncStatus();
  const online = useOnline();
  return (
    <SyncIndicatorView
      online={online}
      pending={status?.pending ?? 0}
      rejected={status?.rejected.length ?? 0}
      reviews={status?.reviews ?? 0}
      needsLogin={status?.needsLogin ?? false}
      renderLink={({ className: linkClass, children }) => (
        <Link to="/data-belum-terkirim" className={linkClass}>
          {children}
        </Link>
      )}
      compact={compact}
      className={className}
    />
  );
}
