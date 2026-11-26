// Petugas menerima tugas dari layar Tugas, lalu mencatat IB dari tombol tugas.
import { uuidv7 } from '@ib/shared';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataProvider, unlockApp } from '@/data';
import { createAppRouter } from '@/router';
import { createTestLayer, DAY, IDS, TODAY } from '@/test/data-fixtures';

describe('layar Tugas (petugas)', () => {
  it('Terima tugas → Sedang dikerjakan → Catat hasil IB membuka form IB', async () => {
    const t = await createTestLayer('inseminator');
    unlockApp();
    const time = TODAY - DAY;
    const base = { createdAt: time, updatedAt: time, deletedAt: null, deviceId: 'server' };
    const requestId = uuidv7(time);
    await t.db.serviceRequests.add({
      ...base,
      id: requestId,
      farmerId: t.farmer.id,
      animalId: t.animal.id,
      type: 'IB',
      status: 'assigned',
      requestedBy: IDS.farmerUser,
      preferredDate: null,
      notes: 'Birahi sejak pagi',
      rejectionReason: null,
      resultEventId: null,
    });
    await t.db.assignments.add({
      ...base,
      id: uuidv7(time),
      serviceRequestId: requestId,
      inseminatorId: IDS.inseminator,
      assignedBy: IDS.admin,
      assignedAt: time,
      acceptedAt: null,
      endedAt: null,
      endReason: null,
    });
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/tugas'] }));
    render(
      <DataProvider layer={t} autoSync={false}>
        <RouterProvider router={router} />
      </DataProvider>,
    );
    expect(await screen.findByText('“Birahi sejak pagi”')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terima tugas' }));
    expect(await screen.findByText('Sedang dikerjakan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Catat hasil IB' }));
    expect(await screen.findByRole('button', { name: 'Simpan IB' })).toBeInTheDocument();
    expect(screen.getByText('Tandai permintaan IB peternak selesai')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ jenis: 'IB', tugas: requestId });
  });
});
