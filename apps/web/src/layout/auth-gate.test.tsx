// Pintu masuk: tanpa sesi → Masuk; dengan PIN → layar PIN; PIN benar → aplikasi.
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DataProvider, lockApp, setPin } from '@/data';
import { createAppRouter } from '@/router';
import { createTestLayer, IDS, type TestLayer } from '@/test/data-fixtures';

function renderApp(layer: TestLayer, path = '/') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <DataProvider layer={layer} autoSync={false}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
}

const meReply = {
  status: 200,
  body: {
    user: { id: IDS.admin, name: 'Hartono', role: 'group_admin', locationId: null },
    farmerId: null,
  },
};

beforeEach(() => {
  lockApp();
});

describe('AuthGate', () => {
  it('tanpa sesi: layar Masuk; isian kosong diberi pesan', async () => {
    const t = await createTestLayer();
    await t.db.meta.delete('session');
    renderApp(t);
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(screen.getByText('Isi email atau nomor HP.')).toBeInTheDocument();
  });

  it('password salah: pesan jelas', async () => {
    const t = await createTestLayer('group_admin', () => ({
      status: 401,
      body: { error: { code: 'UNAUTHENTICATED', message: 'x' } },
    }));
    await t.db.meta.delete('session');
    renderApp(t);
    fireEvent.change(await screen.findByLabelText('Email atau nomor HP'), {
      target: { value: 'admin.ktt01@contoh.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'salah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('password salah');
  });

  it('berhasil masuk: tawaran PIN, lalu Lewati membuka beranda', async () => {
    const t = await createTestLayer('group_admin', (call) =>
      call.path === '/api/auth/login' ? meReply : { status: 200, body: {} },
    );
    await t.db.meta.delete('session');
    renderApp(t);
    fireEvent.change(await screen.findByLabelText('Email atau nomor HP'), {
      target: { value: 'admin.ktt01@contoh.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'contoh123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('heading', { name: 'Pasang PIN?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lewati, pakai password saja' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Hari ini' })).toBeInTheDocument();
  });

  it('PIN terpasang: aplikasi terkunci sampai PIN benar', async () => {
    const t = await createTestLayer();
    await setPin(t.db, '2468');
    lockApp();
    renderApp(t);
    expect(await screen.findByText('Masukkan PIN untuk membuka aplikasi.')).toBeInTheDocument();
    for (const d of '1111') fireEvent.click(screen.getByRole('button', { name: d }));
    fireEvent.click(screen.getByRole('button', { name: 'Buka' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN salah. Sisa 4 kali');
    for (const d of '2468') fireEvent.click(screen.getByRole('button', { name: d }));
    fireEvent.click(screen.getByRole('button', { name: 'Buka' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeInTheDocument();
    });
  });
});
