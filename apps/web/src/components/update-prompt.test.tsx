import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { swMessage } from './update-prompt-model';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [sw.offlineReady, sw.setOfflineReady],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

const { UpdatePrompt } = await import('./update-prompt');

describe('swMessage', () => {
  it('versi baru diutamakan; siap offline; atau tidak ada pesan', () => {
    expect(swMessage({ needRefresh: true, offlineReady: true })?.kind).toBe('update');
    expect(swMessage({ needRefresh: false, offlineReady: true })).toMatchObject({
      kind: 'ready',
      title: 'Siap dipakai tanpa sinyal',
    });
    expect(swMessage({ needRefresh: false, offlineReady: false })).toBeNull();
  });
});

describe('UpdatePrompt', () => {
  beforeEach(() => {
    sw.needRefresh = false;
    sw.offlineReady = false;
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tanpa versi baru: tidak ada kartu', () => {
    render(<UpdatePrompt />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('versi baru: "Perbarui sekarang" memasang versi baru, "Nanti" menutup', () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByText('Versi baru tersedia')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui sekarang' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Nanti' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('siap offline: pesan hilang sendiri', () => {
    vi.useFakeTimers();
    sw.offlineReady = true;
    render(<UpdatePrompt />);
    expect(screen.getByText('Siap dipakai tanpa sinyal')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(sw.setOfflineReady).toHaveBeenCalledWith(false);
  });
});
