// Hook membaca Dexie (bukan API) dan ikut berubah setelah penulisan lokal.
import { computeSchedule, deriveReproStatus, type DomainEvent } from '@ib/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  createTestLayer,
  ibBody,
  makeEvent,
  pkbPregnant,
  TODAY,
  type TestLayer,
} from '@/test/data-fixtures';

import {
  useAnimals,
  useAnimalTimeline,
  useFarmers,
  useReminders,
  useServiceRequests,
  useSyncStatus,
} from './hooks';
import { DataProvider } from './provider';

function wrapperFor(t: TestLayer) {
  return ({ children }: { children: ReactNode }) => (
    <DataProvider layer={t} autoSync={false}>
      {children}
    </DataProvider>
  );
}

describe('hook data lokal', () => {
  it('useAnimals diperbarui otomatis setelah createAnimal, tanpa memanggil API', async () => {
    const t = await createTestLayer();
    const { result } = renderHook(() => useAnimals(), { wrapper: wrapperFor(t) });
    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(result.current?.[0]).toMatchObject({
      id: t.animal.id,
      farmerName: 'Pak Contoh',
      status: { kind: 'kosong' },
      unsynced: false,
    });

    await act(async () => {
      await t.repo.createAnimal({
        farmerId: t.farmer.id,
        sex: 'F',
        name: 'Anggrek',
        qrCode: 'IB-ABC23',
      });
    });
    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });
    expect(result.current?.find((a) => a.name === 'Anggrek')).toMatchObject({
      qrCode: 'IB-ABC23',
      unsynced: true,
    });
    expect(t.server.calls).toEqual([]);
  });

  it('useAnimals menyembunyikan ternak yang keluar kecuali diminta', async () => {
    const t = await createTestLayer();
    await t.db.events.add(makeEvent(t.animal.id, 1, { type: 'EXIT', payload: { reason: 'sold' } }));
    const hidden = renderHook(() => useAnimals(), { wrapper: wrapperFor(t) });
    const shown = renderHook(() => useAnimals({ includeExited: true }), { wrapper: wrapperFor(t) });
    await waitFor(() => {
      expect(shown.result.current).toHaveLength(1);
    });
    expect(hidden.result.current).toEqual([]);
  });

  it('useAnimalTimeline: status dan jadwal sama dengan fungsi domain', async () => {
    const t = await createTestLayer('inseminator');
    const events = [makeEvent(t.animal.id, 70, ibBody), makeEvent(t.animal.id, 10, pkbPregnant)];
    await t.db.events.bulkAdd(events);
    const { result } = renderHook(() => useAnimalTimeline(t.animal.id), { wrapper: wrapperFor(t) });
    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });
    const domain = events as DomainEvent[];
    const expected = computeSchedule(domain, TODAY);
    expect(result.current?.animal.status).toEqual(deriveReproStatus(domain, TODAY).status);
    expect(result.current?.schedule).toEqual({
      nextEstrusAt: expected.nextEstrusAt,
      pkbDueAt: expected.pkbDueAt,
      expectedCalving: expected.expectedCalving,
      reminders: expected.reminders,
    });
    expect(result.current?.events.map((e) => e.type)).toEqual(['IB', 'PKB']);

    // Koreksi: event pembatal membuat PKB lama "voided" dan status kembali ke sudah IB.
    await act(async () => {
      await t.repo.recordEvent(t.animal.id, {
        ...pkbPregnant,
        payload: { result: 'not_pregnant' },
        occurredAt: TODAY,
        voidsEventId: events[1]?.id,
      });
    });
    await waitFor(() => {
      expect(result.current?.events).toHaveLength(3);
    });
    expect(result.current?.events.find((e) => e.id === events[1]?.id)?.voided).toBe(true);
    expect(result.current?.events.at(-1)?.unsynced).toBe(true);
  });

  it('useAnimalTimeline: ternak tidak ada → null', async () => {
    const t = await createTestLayer();
    const { result } = renderHook(() => useAnimalTimeline('0193f000-0000-7000-8000-00000000dead'), {
      wrapper: wrapperFor(t),
    });
    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });

  it('useFarmers dan useServiceRequests membaca data lokal', async () => {
    const t = await createTestLayer();
    const farmers = renderHook(() => useFarmers(), { wrapper: wrapperFor(t) });
    const requests = renderHook(() => useServiceRequests({ status: 'submitted' }), {
      wrapper: wrapperFor(t),
    });
    await waitFor(() => {
      expect(farmers.result.current?.map((f) => f.name)).toEqual(['Pak Contoh']);
    });
    expect(requests.result.current).toEqual([]);
    await act(async () => {
      await t.repo.createServiceRequest({ animalId: t.animal.id, type: 'IB' });
    });
    await waitFor(() => {
      expect(requests.result.current).toHaveLength(1);
    });
  });

  it('useReminders menghitung pengingat terlambat secara offline', async () => {
    const t = await createTestLayer();
    await t.db.events.add(makeEvent(t.animal.id, 100, ibBody));
    const { result } = renderHook(() => useReminders(), { wrapper: wrapperFor(t) });
    await waitFor(() => {
      expect(result.current?.length).toBeGreaterThan(0);
    });
    expect(result.current?.[0]).toMatchObject({
      kind: 'IB_RESULT_OVERDUE',
      overdue: true,
      animal: { id: t.animal.id, farmerName: 'Pak Contoh' },
    });
  });

  it('useSyncStatus menghitung entri pending dan menampilkan yang ditolak', async () => {
    const t = await createTestLayer();
    const { result } = renderHook(() => useSyncStatus(), { wrapper: wrapperFor(t) });
    await waitFor(() => {
      expect(result.current?.pending).toBe(0);
    });
    await act(async () => {
      await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
      await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'M' });
    });
    await waitFor(() => {
      expect(result.current?.pending).toBe(2);
    });

    t.server.setHandler((call) =>
      call.body && (call.body as { sex?: string }).sex === 'M'
        ? {
            status: 403,
            body: { error: { code: 'FORBIDDEN', message: 'Lokasi di luar wilayah Anda.' } },
          }
        : { status: 201, body: call.body },
    );
    await act(async () => {
      await t.sync.pushOutbox();
    });
    await waitFor(() => {
      expect(result.current?.pending).toBe(0);
    });
    expect(result.current?.rejected.map((e) => e.lastError)).toEqual([
      'Lokasi di luar wilayah Anda.',
    ]);
  });
});
