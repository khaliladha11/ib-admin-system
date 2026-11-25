import type { EventBody } from '../schemas/events';

/** Bagian event yang dibutuhkan logika domain (cocok dengan AnimalEvent maupun data lokal). */
export type DomainEvent = EventBody & {
  id: string;
  animalId: string;
  /** Waktu kejadian sebenarnya (ms UTC). */
  occurredAt: number;
  voidsEventId: string | null;
  deletedAt?: number | null;
};

export type DomainEventOf<T extends DomainEvent['type']> = Extract<DomainEvent, { type: T }>;

/**
 * Event yang berlaku: tanpa event terhapus dan tanpa event yang sudah dibatalkan
 * oleh event pengganti. Diurutkan menurut waktu kejadian, lalu id.
 */
export function effectiveEvents<E extends DomainEvent>(events: readonly E[]): E[] {
  const alive = events.filter((e) => e.deletedAt == null);
  const voided = new Set(alive.flatMap((e) => (e.voidsEventId ? [e.voidsEventId] : [])));
  return alive
    .filter((e) => !voided.has(e.id))
    .sort((a, b) => a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
