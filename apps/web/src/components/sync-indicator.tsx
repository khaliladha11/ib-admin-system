import { useDataLayer, useSyncStatus } from '@/data';
import { useOnline } from '@/hooks/use-online';
import { cn } from '@/lib/utils';

import { describeSync, type SyncState } from './describe-sync';

export interface SyncIndicatorViewProps extends SyncState {
  /** Sentuh untuk sinkron sekarang. */
  onPress?: () => void;
  /** Hanya ikon (+ jumlah); teks lengkap tetap dibacakan pembaca layar. */
  compact?: boolean;
  className?: string;
}

export function SyncIndicatorView({
  onPress,
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
          {state.pending > 0 && <span aria-hidden="true">{state.pending}</span>}
        </>
      ) : (
        <span>{view.text}</span>
      )}
    </>
  );
  const classes = cn(
    'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-2 text-base font-semibold whitespace-nowrap',
    view.className,
    className,
  );
  return (
    <div role="status" aria-live="polite" data-sync={view.kind}>
      {onPress ? (
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
  const { sync } = useDataLayer();
  return (
    <SyncIndicatorView
      online={online}
      pending={status?.pending ?? 0}
      rejected={status?.rejected.length ?? 0}
      needsLogin={status?.needsLogin ?? false}
      onPress={() => {
        void sync.syncNow().catch(() => undefined);
      }}
      compact={compact}
      className={className}
    />
  );
}
