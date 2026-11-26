// Langkah 2.4: error tidak lagi membuat layar putih; pindah halaman diumumkan dan fokus ke judul.
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/empty-state';
import { Cow } from '@/components/icons/cow';
import { DataProvider, unlockApp } from '@/data';
import { createAppRouter } from '@/router';
import { createTestLayer } from '@/test/data-fixtures';

import { RouteError } from './route-error';

describe('RouteError', () => {
  it('menampilkan pesan ramah dan jalan keluar, bukan layar putih', async () => {
    const root = createRootRoute({
      component: () => <RouteError error={new Error('boom')} reset={() => undefined} />,
    });
    const router = createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan di aplikasi');
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeInTheDocument();
    expect(screen.getByText(/tidak hilang/)).toBeInTheDocument();
    expect(screen.getByText(/hubungi admin kelompok/)).toBeInTheDocument();
  });
});

describe('pengumuman pindah halaman', () => {
  it('judul halaman diumumkan dan menerima fokus setelah navigasi', async () => {
    const layer = await createTestLayer('inseminator');
    unlockApp();
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));
    render(
      <DataProvider layer={layer} autoSync={false}>
        <RouterProvider router={router} />
      </DataProvider>,
    );
    const nav = (await screen.findAllByRole('navigation', { name: 'Navigasi utama' })).at(-1);
    if (!nav) throw new Error('nav');
    const link = nav.querySelector<HTMLAnchorElement>('a[href="/tugas"]');
    if (!link) throw new Error('link');
    fireEvent.click(link);
    await waitFor(() => {
      expect(screen.getByText('Halaman Tugas')).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Tugas' }));
  });
});

describe('EmptyState', () => {
  it('judul dan ajakan tetap ada; ilustrasi hanya hiasan', () => {
    const { container } = render(
      <EmptyState icon={Cow} art="meadow" title="Belum ada ternak">
        Daftar muncul saat ada sinyal.
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'Belum ada ternak' })).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
