// Kalimat "langkah berikutnya" untuk kartu ternak, dari jadwal computeSchedule.
import type { AnimalView } from '@/data';
import { formatDate, relativeDay } from '@/lib/format';

export function nextStepLabel(animal: AnimalView, today: number): string | undefined {
  const { status, schedule } = animal;
  if (schedule.reminders.length > 0) return 'Laporan terlambat, perlu dicek';
  switch (status.kind) {
    case 'birahi':
      return 'Sedang birahi: segera IB';
    case 'sudah_IB_menunggu_PKB':
      return schedule.pkbDueAt
        ? `PKB ${relativeDay(schedule.pkbDueAt, today)}, ${formatDate(schedule.pkbDueAt)}`
        : undefined;
    case 'bunting':
      return schedule.expectedCalving
        ? `Perkiraan lahir ${formatDate(schedule.expectedCalving.expected)}`
        : undefined;
    case 'keluar':
      return undefined;
    default:
      return schedule.nextEstrusAt
        ? `Perkiraan birahi ${relativeDay(schedule.nextEstrusAt, today)}`
        : 'Belum ada catatan birahi';
  }
}
