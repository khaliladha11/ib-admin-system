import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataProvider } from '@/data';
import { createAppRouter } from '@/router';
import { createTestLayer } from '@/test/data-fixtures';

async function renderAt(path: string) {
  const layer = await createTestLayer();
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <DataProvider layer={layer} autoSync={false}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return router;
}

describe('AppShell', () => {
  it('navigasi berisi Beranda, Ternak, Scan, Tugas, Lainnya; tab aktif ditandai', async () => {
    await renderAt('/ternak');
    const navs = await screen.findAllByRole('navigation', { name: 'Navigasi utama' });
    // Sidebar (PC) muncul lebih dulu di DOM; navigasi bawah (HP) yang terakhir.
    const bottom = navs.at(-1);
    if (!bottom) throw new Error('navigasi tidak ada');
    const links = within(bottom).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Beranda',
      'Ternak',
      'Scan',
      'Tugas',
      'Lainnya',
    ]);
    expect(within(bottom).getByRole('link', { name: 'Ternak' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(bottom).getByRole('link', { name: 'Beranda' })).not.toHaveAttribute(
      'aria-current',
    );
    for (const link of links) expect(link.className).toMatch(/min-h-16/);
    expect(screen.getByRole('heading', { level: 1, name: 'Ternak' })).toBeInTheDocument();
  });

  it('bilah atas menampilkan status sinkron', async () => {
    await renderAt('/');
    expect(await screen.findByText('Semua data terkirim')).toBeInTheDocument();
  });

  it('pindah halaman tanpa memuat ulang', async () => {
    const router = await renderAt('/');
    const bottom = (await screen.findAllByRole('navigation', { name: 'Navigasi utama' })).at(-1);
    if (!bottom) throw new Error('navigasi tidak ada');
    within(bottom).getByRole('link', { name: 'Tugas' }).click();
    expect(await screen.findByRole('heading', { level: 1, name: 'Tugas' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tugas');
  });

  it('alamat tidak dikenal: pesan ramah', async () => {
    await renderAt('/tidak-ada');
    expect(await screen.findByText('Halaman tidak ditemukan')).toBeInTheDocument();
  });

  it('/dev/komponen menampilkan semua bagian', async () => {
    await renderAt('/dev/komponen');
    for (const name of [
      'Warna',
      'Status reproduksi',
      'Kartu ternak',
      'Form catat event',
      'Status sinkron',
      'Tampilan kosong',
      'Pesan error',
    ]) {
      expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });
});
