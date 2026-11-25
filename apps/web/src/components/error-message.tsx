import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { describeError } from './describe-error';

export interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  /** Tombol lain (mis. "Tetap simpan"). */
  action?: ReactNode;
  className?: string;
}

export function ErrorMessage({ error, onRetry, action, className }: ErrorMessageProps) {
  const e = describeError(error);
  const Icon = e.icon;
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-lg border-(length:--bw) border-l-[6px] bg-card p-4',
        e.tone === 'alarm' ? 'border-alarm' : 'border-soil',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-6 shrink-0', e.tone === 'alarm' ? 'text-alarm' : 'text-soil')}
        strokeWidth={2.5}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-lg font-bold">{e.title}</p>
        <p>{e.body}</p>
        {e.items.length > 0 && (
          <ul className="list-disc pl-5">
            {e.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {(onRetry ?? action) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {action}
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                Coba lagi
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
