// Beranda "Hari ini": pengingat dari computeSchedule (lewat listReminders), per desa.
import type { ReminderKind, UserRole } from '@ib/shared';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import {
  ChevronRight,
  ClipboardClock,
  Flame,
  MapPin,
  PartyPopper,
  Sprout,
  Stethoscope,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { DashboardSkeleton, ListSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { ReminderActionLink } from '@/components/reminder-action-link';
import {
  useDataLayer,
  useReminders,
  useServiceRequestViews,
  useSession,
  type ReminderView,
} from '@/data';
import { dayDiff, formatDate, formatLongToday, relativeDay } from '@/lib/format';
import { reminderAction } from '@/lib/reminder-actions';
import { cn } from '@/lib/utils';

import { isAdminRole } from '@/layout/nav-items';

import { groupByVillage } from './reminder-groups';

/** Ikon dan warna per jenis pengingat; judulnya dari reminderAction (sesuai peran). */
const KIND_META: Record<ReminderKind, { icon: LucideIcon; tone: string }> = {
  IB_RESULT_OVERDUE: {
    icon: ClipboardClock,
    tone: 'text-alarm',
  },
  BIRTH_REPORT_OVERDUE: {
    icon: TriangleAlert,
    tone: 'text-alarm',
  },
  ESTRUS_EXPECTED: { icon: Flame, tone: 'text-(--st-birahi-fg)' },
  PKB_DUE: { icon: Stethoscope, tone: 'text-(--st-ib-fg)' },
  CALVING_EXPECTED: { icon: Sprout, tone: 'text-(--st-lahir-fg)' },
};

export const REMINDER_WINDOW_DAYS = 7;

function when(item: ReminderView, today: number) {
  if (item.overdue) return `Terlambat ${String(item.overdueDays ?? 0)} hari`;
  return dayDiff(item.dueAt, today) <= 0
    ? 'Hari ini'
    : relativeDay(item.dueAt, today).replace(/^./, (c) => c.toUpperCase());
}

// Dashboard admin dimuat terpisah: HP peternak/petugas tidak perlu mengunduhnya.
const AdminDashboard = lazy(() =>
  import('./admin/dashboard').then((m) => ({ default: m.AdminDashboard })),
);

export function HomePage() {
  const role = useSession()?.user.role;
  return isAdminRole(role) ? (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  ) : (
    <FieldHome />
  );
}

function FieldHome() {
  const { now } = useDataLayer();
  const today = now();
  const reminders = useReminders(REMINDER_WINDOW_DAYS);
  const session = useSession();
  const requests = useServiceRequestViews();
  const waitingTasks =
    session?.user.role === 'inseminator'
      ? (requests ?? []).filter((r) => r.assignedToMe && r.request.status === 'assigned').length
      : 0;

  if (!reminders) return <ListSkeleton label="Memuat jadwal hari ini…" />;
  const overdue = reminders.filter((r) => r.overdue).length;
  const groups = groupByVillage(reminders);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-muted-foreground">{formatLongToday(today)}</p>
        <p className="display text-[2.25rem]">
          {reminders.length === 0
            ? 'Tidak ada jadwal'
            : `${String(reminders.length)} hal perlu diperhatikan`}
        </p>
        {overdue > 0 && (
          <p className="font-semibold text-alarm">{String(overdue)} laporan sudah terlambat</p>
        )}
      </div>

      {waitingTasks > 0 && (
        <Link
          to="/tugas"
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-straw px-5 py-3 font-bold text-ink shadow-card"
        >
          <span>{String(waitingTasks)} tugas baru menunggu Anda terima</span>
          <ChevronRight aria-hidden="true" className="size-6 shrink-0" />
        </Link>
      )}

      {reminders.length === 0 ? (
        <EmptyState icon={PartyPopper} art="meadow" title="Tidak ada jadwal 7 hari ke depan">
          Birahi, jadwal PKB, perkiraan lahir, dan laporan terlambat akan muncul di sini. Catat
          kejadian di menu Ternak supaya jadwalnya terhitung.
        </EmptyState>
      ) : (
        groups.map((group) => (
          <section
            key={group.name}
            aria-label={`Desa ${group.name}`}
            className="flex flex-col gap-2"
          >
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MapPin aria-hidden="true" className="size-5 text-primary" />
              {group.name}
              <span className="font-normal text-muted-foreground">({group.items.length})</span>
            </h2>
            <ul className="surface flex flex-col overflow-hidden">
              {group.items.map((item) => (
                <ReminderRow
                  key={`${item.kind}-${item.animal.id}`}
                  item={item}
                  today={today}
                  role={session?.user.role}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ReminderRow({
  item,
  today,
  role,
}: {
  item: ReminderView;
  today: number;
  role: UserRole | undefined;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const { title, action } = reminderAction(item.kind, role, item.animal.id);
  // Tombol hanya untuk yang perlu dikerjakan sekarang: terlambat, atau jatuh tempo hari ini.
  const showAction =
    action && (item.overdue || dayDiff(item.dueAt, today) <= 0 || item.kind === 'PKB_DUE');
  return (
    <li className="border-b-(length:--bw) last:border-b-0">
      <Link
        to="/ternak/$animalId"
        params={{ animalId: item.animal.id }}
        className="flex min-h-16 items-start gap-3 px-4 py-3 hover:bg-secondary"
      >
        <Icon
          aria-hidden="true"
          className={cn('mt-0.5 size-6 shrink-0', meta.tone)}
          strokeWidth={2.25}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold">{title}</span>
          <span className={cn('font-bold', item.overdue ? 'text-alarm' : 'text-foreground')}>
            {when(item, today)}
            {item.overdue && (
              <span className="font-normal text-muted-foreground">
                , batas {formatDate(item.dueAt)}
              </span>
            )}
          </span>
          <span>
            {item.animal.name ?? 'Tanpa nama'}
            {item.animal.qrCode && (
              <span className="font-semibold text-muted-foreground"> {item.animal.qrCode}</span>
            )}
          </span>
          {item.animal.farmerName && (
            <span className="text-sm text-muted-foreground">{item.animal.farmerName}</span>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      </Link>
      {showAction && (
        <div className="-mt-1 px-4 pb-3 pl-13">
          <ReminderActionLink target={action.target} label={action.label} />
        </div>
      )}
    </li>
  );
}
