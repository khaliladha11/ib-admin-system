import { createHealthResponse } from '@ib/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('halaman Halo', () => {
  it('menampilkan "Server terhubung" bila /api/health berhasil', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(createHealthResponse('ib-server', new Date())));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Halo!' })).toBeInTheDocument();
    expect(await screen.findByText('Server terhubung')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('menampilkan pesan gagal, lalu berhasil setelah "Coba lagi"', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(jsonResponse(createHealthResponse('ib-server', new Date())));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Server tidak bisa dihubungi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Server terhubung')).toBeInTheDocument();
  });

  it('menganggap respons yang bentuknya salah sebagai gagal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'down' })));

    render(<App />);

    expect(await screen.findByText('Server tidak bisa dihubungi')).toBeInTheDocument();
  });
});
