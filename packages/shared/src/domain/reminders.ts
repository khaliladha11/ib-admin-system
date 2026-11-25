// Daftar pengingat untuk layar "Pengingat": terlambat (aturan skripsi) + jadwal dalam N hari.
// Dipakai server (/api/reminders) dan web (offline) agar hasilnya sama.
import { DAY_MS } from './constants';
import type { Schedule } from './schedule';

export const REMINDER_KINDS = [
  'IB_RESULT_OVERDUE',
  'BIRTH_REPORT_OVERDUE',
  'ESTRUS_EXPECTED',
  'PKB_DUE',
  'CALVING_EXPECTED',
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export interface ReminderItem {
  kind: ReminderKind;
  /** true untuk pengingat terlambat dari aturan skripsi (3 bulan / 9 bulan). */
  overdue: boolean;
  dueAt: number;
  overdueDays: number | null;
  message: string;
}

/** Tanggal untuk teks pengingat, zona waktu WIB. */
export const formatReminderDate = (ms: number) =>
  new Date(ms).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

/** Pengingat seekor sapi: semua yang terlambat, lalu jadwal yang jatuh paling lambat `today + withinDays`. */
export function listReminders(
  schedule: Schedule,
  today: number,
  withinDays: number,
): ReminderItem[] {
  const horizon = today + withinDays * DAY_MS;
  const fmt = formatReminderDate;
  const items: ReminderItem[] = schedule.reminders.map((r) => ({
    kind: r.code,
    overdue: true,
    dueAt: r.dueAt,
    overdueDays: r.overdueDays,
    message: r.message,
  }));
  const upcoming = (kind: ReminderKind, at: number | null | undefined, message: () => string) => {
    if (at != null && at <= horizon) {
      items.push({ kind, overdue: false, dueAt: at, overdueDays: null, message: message() });
    }
  };
  const { nextEstrusAt, pkbDueAt, expectedCalving } = schedule;
  upcoming('ESTRUS_EXPECTED', nextEstrusAt, () => `Perkiraan birahi ${fmt(nextEstrusAt ?? 0)}.`);
  if (schedule.reminders.length === 0) {
    upcoming('PKB_DUE', pkbDueAt, () => `Jadwal PKB ${fmt(pkbDueAt ?? 0)}.`);
    upcoming(
      'CALVING_EXPECTED',
      expectedCalving?.earliest,
      () =>
        `Perkiraan lahir ${fmt(expectedCalving?.earliest ?? 0)} – ${fmt(expectedCalving?.latest ?? 0)}.`,
    );
  }
  return items;
}

/** Urutan tampilan: terlambat lebih dulu, lalu menurut tanggal. */
export const compareReminders = (a: ReminderItem, b: ReminderItem) =>
  Number(b.overdue) - Number(a.overdue) || a.dueAt - b.dueAt;
