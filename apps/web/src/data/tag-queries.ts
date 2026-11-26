// Baca data tag dan label QR (langkah 3.1). Murni membaca Dexie; dipakai lewat hook.
import type { AnimalTag, QrCode } from '@ib/shared';

import type { IbDb } from './db';

export interface TagView extends AnimalTag {
  /** Masih menunggu dikirim ke server. */
  unsynced: boolean;
  /** Ditolak server (mis. kode sudah dipakai di tempat lain). */
  rejectedMessage: string | null;
}

/** Riwayat tag ternak: yang aktif dulu, lalu yang dicabut, masing-masing terbaru di atas. */
export async function loadAnimalTags(db: IbDb, animalId: string): Promise<TagView[]> {
  const [tags, outbox] = await Promise.all([
    db.animalTags.where('animalId').equals(animalId).toArray(),
    db.outbox.toArray(),
  ]);
  const pending = new Set(
    outbox.filter((e) => e.status === 'pending').flatMap((e) => [e.rowId, ...e.relatedRowIds]),
  );
  const rejected = new Map(
    outbox.filter((e) => e.status === 'rejected').map((e) => [e.rowId, e.lastError]),
  );
  return tags
    .filter((t) => t.deletedAt === null)
    .map((t) => ({
      ...t,
      unsynced: pending.has(t.id),
      rejectedMessage: rejected.has(t.id) ? (rejected.get(t.id) ?? 'Tidak diterima') : null,
    }))
    .sort(
      (a, b) =>
        Number(a.removedAt !== null) - Number(b.removedAt !== null) ||
        (b.removedAt ?? b.attachedAt) - (a.removedAt ?? a.attachedAt),
    );
}

export type QrLabelState = 'free' | 'used' | 'conflict';

export interface QrLabelView extends QrCode {
  /** free = belum dipasang, used = sudah dipasang, conflict = server menolak (jangan dipakai). */
  state: QrLabelState;
  unsynced: boolean;
  animal: { id: string; name: string | null } | null;
}

/** Label QR yang dibuat pengguna ini, terbaru di atas. */
export async function loadQrLabels(db: IbDb, userId: string): Promise<QrLabelView[]> {
  const [codes, tags, outbox, animals] = await Promise.all([
    db.qrCodes.where('issuedBy').equals(userId).toArray(),
    db.animalTags.where('[type+code]').between(['qr', ''], ['qr', '￿']).toArray(),
    db.outbox.toArray(),
    db.animals.toArray(),
  ]);
  const tagByCode = new Map(tags.filter((t) => t.deletedAt === null).map((t) => [t.code, t]));
  const animalById = new Map(animals.map((a) => [a.id, a]));
  const status = new Map(outbox.map((e) => [e.rowId, e.status]));
  return codes
    .filter((c) => c.deletedAt === null)
    .map((c): QrLabelView => {
      const tag = tagByCode.get(c.code);
      const animal = tag ? animalById.get(tag.animalId) : undefined;
      const entry = status.get(c.id);
      return {
        ...c,
        state: entry === 'rejected' ? 'conflict' : tag ? 'used' : 'free',
        unsynced: entry === 'pending',
        animal: animal ? { id: animal.id, name: animal.name } : null,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt || a.code.localeCompare(b.code));
}
