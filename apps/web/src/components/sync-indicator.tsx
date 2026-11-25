import { useDataLayer, useSyncStatus } from '@/data';
import { useOnline } from '@/hooks/use-online';
import { cn } from '@/lib/utils';

import { describeSync, type SyncState } from './describe-sync';

export interface SyncIndicatorViewProps extends SyncState {
  /** Sentuh untuk sinkron sekarang. */
  onPress?: () => void;
  className?: string;
}

export function SyncIndicatorView({ onPress, className, ...state }: SyncIndicatorViewProps) {
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
      <span>{view.text}</span>
    </>
  );
  const classes = cn(
    'inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-base font-semibold',
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
export function SyncIndicator({ className }: { className?: string }) {
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
      className={className}
    />
  );
}
