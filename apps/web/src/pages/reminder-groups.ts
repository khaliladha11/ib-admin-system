import type { ReminderView } from '@/data';

/** Kelompokkan per desa; urutan desa: yang punya pengingat terlambat dulu, lalu nama. */
export function groupByVillage(items: ReminderView[]) {
  const groups = new Map<string, { name: string; items: ReminderView[] }>();
  for (const item of items) {
    const key = item.animal.locationId ?? 'tanpa-desa';
    const group = groups.get(key) ?? { name: item.animal.locationName ?? 'Tanpa desa', items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.items.some((i) => i.overdue)) - Number(a.items.some((i) => i.overdue)) ||
      a.name.localeCompare(b.name, 'id'),
  );
}
