import { replay } from './repro-status';
import type { DomainEvent } from './timeline';

export interface ValidationResult {
  /** false bila ada error; event tidak boleh disimpan. */
  ok: boolean;
  /** Alasan penolakan (Bahasa Indonesia). */
  errors: string[];
  /** Boleh disimpan setelah pengguna mengonfirmasi. */
  warnings: string[];
}

/**
 * Periksa apakah `newEvent` masuk akal terhadap riwayat `events` seekor sapi.
 * Event bertanggal mundur dinilai pada posisinya di linimasa, dan ditolak bila
 * membuat event-event sesudahnya tidak masuk akal.
 */
export function validateNextEvent(
  events: readonly DomainEvent[],
  newEvent: DomainEvent,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const done = (): ValidationResult => ({ ok: errors.length === 0, errors, warnings });

  if (events.some((e) => e.animalId !== newEvent.animalId)) {
    errors.push('Riwayat berisi event milik ternak lain; event tidak bisa diperiksa.');
    return done();
  }

  if (newEvent.voidsEventId !== null) {
    const target = events.find((e) => e.id === newEvent.voidsEventId && e.deletedAt == null);
    if (!target) {
      errors.push('Event yang dibatalkan tidak ditemukan.');
    } else if (target.animalId !== newEvent.animalId) {
      errors.push('Event yang dibatalkan milik ternak lain.');
    } else if (events.some((e) => e.deletedAt == null && e.voidsEventId === target.id)) {
      errors.push('Event ini sudah dibatalkan sebelumnya.');
    }
    if (errors.length > 0) return done();
  }

  const before = replay(events);
  const after = replay([...events, newEvent]);

  for (const issue of after.issues) {
    if (issue.event.id !== newEvent.id) continue;
    (issue.severity === 'error' ? errors : warnings).push(issue.message);
  }

  const previousErrors = new Set(
    before.issues.filter((i) => i.severity === 'error').map((i) => i.event.id),
  );
  const broken = after.issues.find(
    (i) => i.severity === 'error' && i.event.id !== newEvent.id && !previousErrors.has(i.event.id),
  );
  if (broken) {
    errors.push(`Event ini membuat riwayat sesudahnya tidak masuk akal: ${broken.message}`);
  }

  return done();
}
