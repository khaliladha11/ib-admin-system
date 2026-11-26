// Mencari hasil scan atau ketikan di database lokal (jalan tanpa internet).
// Kode QR dikenali dari formatnya (IB-XXXXX atau URL .../t/IB-XXXXX); selain itu dianggap
// nomor eartag resmi.
import { parseQrCode, type Animal, type TagRemovalReason, type TagType } from '@ib/shared';

import type { IbDb } from './db';

type AnimalRef = Pick<Animal, 'id' | 'name' | 'sex'>;

export type ScanResult =
  /** Tag aktif: sapi ditemukan. */
  | { kind: 'animal'; code: string; tagType: TagType; animal: AnimalRef }
  /** Kode pernah dipasang tetapi sudah dicabut (label lama/hilang yang ditemukan lagi). */
  | {
      kind: 'removed';
      code: string;
      tagType: TagType;
      animal: AnimalRef | null;
      removedAt: number;
      reason: TagRemovalReason | null;
    }
  /** Belum terpakai di HP ini: boleh didaftarkan. `clash` = server menolak label ini. */
  | { kind: 'unused'; code: string; tagType: TagType; clash: boolean }
  /** Bukan kode ternak (mis. QR lain, URL lain, atau kosong). */
  | { kind: 'invalid'; text: string };

const looksLikeUrl = (s: string) => /^[a-z]+:\/\//i.test(s);
/** Nomor eartag: huruf/angka dengan pemisah umum, 3–50 karakter. */
const EARTAG_PATTERN = /^[0-9A-Za-z][0-9A-Za-z .\-/]{1,48}[0-9A-Za-z]$/;

/** Kode dari teks scan/ketikan: QR, eartag, atau null bila bukan kode ternak. */
export function classifyScanText(text: string): { tagType: TagType; code: string } | null {
  const raw = text.trim();
  const qr = parseQrCode(raw);
  if (qr) return { tagType: 'qr', code: qr };
  if (looksLikeUrl(raw) || /^IB-/i.test(raw)) return null;
  const eartag = raw.replace(/\s+/g, ' ');
  return EARTAG_PATTERN.test(eartag) ? { tagType: 'eartag', code: eartag } : null;
}

export async function lookupScan(db: IbDb, text: string): Promise<ScanResult> {
  const parsed = classifyScanText(text);
  if (!parsed) return { kind: 'invalid', text: text.trim() };
  const { tagType, code } = parsed;

  let tags = (await db.animalTags.where({ type: tagType, code }).toArray()).filter(
    (t) => t.deletedAt === null,
  );
  if (tags.length === 0 && tagType === 'eartag') {
    // Eartag ditulis tangan: cocokkan tanpa beda huruf besar/kecil dan pemisah.
    const norm = (s: string) => s.toUpperCase().replace(/[\s.\-/]/g, '');
    const wanted = norm(code);
    tags = (await db.animalTags.where('animalId').notEqual('').toArray()).filter(
      (t) => t.type === 'eartag' && t.deletedAt === null && norm(t.code) === wanted,
    );
  }

  const active = tags.find((t) => t.removedAt === null);
  const tag = active ?? tags.sort((a, b) => (b.removedAt ?? 0) - (a.removedAt ?? 0))[0];
  if (tag) {
    const animal = await db.animals.get(tag.animalId);
    const ref =
      animal?.deletedAt === null ? { id: animal.id, name: animal.name, sex: animal.sex } : null;
    if (active && ref) return { kind: 'animal', code: tag.code, tagType, animal: ref };
    return {
      kind: 'removed',
      code: tag.code,
      tagType,
      animal: ref,
      removedAt: tag.removedAt ?? tag.updatedAt,
      reason: tag.removalReason,
    };
  }

  let clash = false;
  if (tagType === 'qr') {
    const label = await db.qrCodes.where('code').equals(code).first();
    if (label) {
      clash =
        (await db.outbox
          .where('rowId')
          .equals(label.id)
          .and((e) => e.status === 'rejected')
          .count()) > 0;
    }
  }
  return { kind: 'unused', code, tagType, clash };
}
