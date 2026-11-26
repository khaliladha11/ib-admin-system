import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import type { ReminderTarget } from '@/lib/reminder-actions';

/** Tombol tindakan pengingat (Minta PKB, Catat PKB, Catat lahir, ...). */
export function ReminderActionLink({ target, label }: { target: ReminderTarget; label: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      {target.to === '/tugas/ajukan' ? (
        <Link to={target.to} search={target.search}>
          {label}
        </Link>
      ) : (
        <Link to={target.to} params={target.params} search={target.search}>
          {label}
        </Link>
      )}
    </Button>
  );
}
