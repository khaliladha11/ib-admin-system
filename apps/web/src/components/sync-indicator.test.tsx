import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { describeSync } from './describe-sync';
import { SyncIndicatorView } from './sync-indicator';

const base = { online: true, pending: 0, rejected: 0, needsLogin: false };

describe('describeSync', () => {
  it.each([
    [base, 'ok', 'Semua data terkirim'],
    [{ ...base, pending: 3 }, 'sending', 'Mengirim 3 data'],
    [{ ...base, online: false }, 'offline', 'Offline'],
    [{ ...base, online: false, pending: 5 }, 'offline', 'Offline, 5 belum terkirim'],
    [{ ...base, rejected: 2, pending: 1 }, 'rejected', '2 data ditolak server'],
    [{ ...base, online: false, needsLogin: true }, 'login', 'Masuk lagi untuk mengirim data'],
  ])('%o → %s', (state, kind, text) => {
    expect(describeSync(state)).toMatchObject({ kind, text });
  });
});

describe('SyncIndicatorView', () => {
  it('diumumkan sebagai status dan bisa disentuh untuk sinkron', () => {
    let pressed = 0;
    render(
      <SyncIndicatorView
        {...base}
        online={false}
        pending={2}
        onPress={() => {
          pressed += 1;
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Offline, 2 belum terkirim');
    const button = screen.getByRole('button');
    expect(button.className).toContain('min-h-11');
    button.click();
    expect(pressed).toBe(1);
  });
});
