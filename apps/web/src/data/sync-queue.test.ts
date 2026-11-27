// Langkah 4.2: event "perlu dicek" tidak hilang; kirim ulang (tanggal baru) dan buang.
import { describe, expect, it } from 'vitest';

import {
  createTestLayer,
  DAY,
  errorReply,
  ibBody,
  makeEvent,
  pkbPregnant,
  TODAY,
  type Call,
} from '@/test/data-fixtures';

import { LocalValidationError } from './errors';
import { pendingEntries, reviewEntries } from './outbox';
import { loadAnimal, loadSyncQueue, loadSyncStatus } from './queries';

/** Server yang menolak event dengan urutan tidak masuk akal, lainnya diterima. */
const rejectEvents = (call: Call) =>
  call.path.endsWith('/events')
    ? errorReply(422, 'INVALID_EVENT', 'Sapi ini sudah tercatat bunting.')
    : call.path.startsWith('/api/sync/pull')
      ? { status: 200, body: { rows: {}, cursor: null, hasMore: false, scope: 's', reset: false } }
      : { status: 201, body: call.body };

describe('event perlu dicek', () => {
  it('tidak dihitung di status, tetapi tetap tersimpan dan tampil di antrean', async () => {
    const t = await createTestLayer('inseminator', rejectEvents);
    await t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY - DAY });
    await t.sync.pushOutbox();

    expect((await loadAnimal(t.db, t.animal.id, TODAY))?.status.kind).toBe('kosong');
    const queue = await loadSyncQueue(t.db);
    expect(queue.reviews).toHaveLength(1);
    expect(queue.reviews[0]).toMatchObject({ animalId: t.animal.id, animalName: t.animal.name });
    expect((await loadSyncStatus(t.db)).reviews).toBe(1);

    // Pull tidak menimpa/menghapus event yang perlu dicek.
    await t.sync.pullChanges();
    expect((await reviewEntries(t.db))[0]?.rowId).toBeDefined();
  });

  it('kirim ulang dengan tanggal baru: id perubahan baru, event kembali di riwayat', async () => {
    const t = await createTestLayer('inseminator', rejectEvents);
    const { event } = await t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY - DAY });
    await t.sync.pushOutbox();
    const [review] = await reviewEntries(t.db);
    if (!review) throw new Error('tidak ada');

    await t.repo.retryReview(review.id, { occurredAt: TODAY - 2 * DAY });
    const [pending] = await pendingEntries(t.db);
    expect(pending?.id).not.toBe(review.id);
    expect(pending).toMatchObject({ rowId: event.id, status: 'pending', attempts: 0 });
    expect((pending?.body as { occurredAt: number }).occurredAt).toBe(TODAY - 2 * DAY);
    expect(await t.db.events.get(event.id)).toMatchObject({
      deletedAt: null,
      occurredAt: TODAY - 2 * DAY,
    });
  });

  it('kirim ulang ditolak di HP bila masih bertentangan dengan riwayat lokal', async () => {
    const t = await createTestLayer('inseminator', rejectEvents);
    await t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY - DAY });
    await t.sync.pushOutbox();
    const [review] = await reviewEntries(t.db);
    if (!review) throw new Error('tidak ada');
    // Riwayat dari HP lain ditarik: IB lalu PKB bunting. IB baru di sapi bunting = error.
    await t.db.events.bulkAdd([
      makeEvent(t.animal.id, 120, ibBody),
      makeEvent(t.animal.id, 60, pkbPregnant),
    ]);
    await expect(t.repo.retryReview(review.id)).rejects.toBeInstanceOf(LocalValidationError);
    expect((await reviewEntries(t.db))[0]?.id).toBe(review.id); // tetap perlu dicek
  });

  it('buang: dihapus dari HP, server diberi tahu lewat outbox', async () => {
    const t = await createTestLayer('inseminator', rejectEvents);
    await t.repo.recordEvent(t.animal.id, { ...ibBody, occurredAt: TODAY - DAY });
    await t.sync.pushOutbox();
    const [review] = await reviewEntries(t.db);
    if (!review) throw new Error('tidak ada');
    await t.repo.discardReview(review.id);
    expect(await reviewEntries(t.db)).toEqual([]);
    expect(await pendingEntries(t.db)).toMatchObject([
      {
        kind: 'syncReview.discard',
        path: `/api/sync/reviews/${review.id}/discard`,
        rowId: review.id,
      },
    ]);
    await expect(t.repo.discardReview(review.id)).rejects.toThrow(/tidak ada di daftar/);
  });

  it('admin membuang catatan perlu dicek milik petugas (dari server)', async () => {
    const t = await createTestLayer('group_admin');
    const reviewId = '0193f000-0000-7000-8000-0000000000aa';
    await t.db.syncReviews.add({
      id: reviewId,
      createdAt: TODAY,
      updatedAt: TODAY,
      deletedAt: null,
      deviceId: 'web-x',
      userId: 'petugas',
      kind: 'event.create',
      rowId: null,
      animalId: t.animal.id,
      code: 'INVALID_EVENT',
      message: 'Sapi ini sudah tercatat bunting.',
      payload: { body: { type: 'IB' } },
      resolvedAt: null,
      resolution: null,
    });
    await t.repo.discardServerReview(reviewId);
    expect(await t.db.syncReviews.get(reviewId)).toMatchObject({ resolution: 'discarded' });
    expect((await pendingEntries(t.db))[0]).toMatchObject({ kind: 'syncReview.discard' });
    await expect(t.repo.discardServerReview(reviewId)).rejects.toThrow(/sudah diselesaikan/);
  });
});

describe('perubahan profil untuk konflik per kolom', () => {
  it('hanya kolom yang berubah yang dikirim; tanpa perubahan = tanpa entri outbox', async () => {
    const t = await createTestLayer('group_admin');
    await t.repo.updateFarmer(t.farmer.id, {
      name: t.farmer.name,
      phone: '081299990001',
      locationId: t.farmer.locationId,
    });
    const [entry] = await pendingEntries(t.db);
    expect(entry?.body).toEqual({ phone: '081299990001' });

    await t.repo.updateFarmer(t.farmer.id, { name: t.farmer.name, phone: '081299990001' });
    await t.repo.updateAnimal(t.animal.id, { name: t.animal.name, breed: t.animal.breed });
    expect(await pendingEntries(t.db)).toHaveLength(1);
  });
});
