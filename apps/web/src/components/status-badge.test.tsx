import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SAMPLE_ANIMALS } from '@/pages/dev-samples';

import { cycleTrackLabel, stageOf } from './cycle';
import { CycleTrack } from './cycle-track';
import { StatusBadge } from './status-badge';
import { STATUS_META } from './status-meta';

const KINDS = Object.keys(STATUS_META) as (keyof typeof STATUS_META)[];

describe('StatusBadge', () => {
  it.each(KINDS)('%s: punya teks dan ikon, bukan hanya warna', (kind) => {
    const { container } = render(<StatusBadge status={{ kind }} />);
    expect(screen.getByText(STATUS_META[kind].label)).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-status', kind);
  });

  it('menampilkan keterangan IB ke-berapa dan umur kebuntingan', () => {
    for (const { animal } of SAMPLE_ANIMALS) render(<StatusBadge status={animal.status} />);
    expect(screen.getByText(/menunggu PKB, IB ke-2/)).toBeInTheDocument();
    expect(screen.getByText(/4 bulan/)).toBeInTheDocument();
  });

  it('label status unik', () => {
    const labels = KINDS.map((k) => STATUS_META[k].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('CycleTrack', () => {
  it('tahap sekarang sesuai status', () => {
    expect(KINDS.map(stageOf)).toEqual([-1, 0, 1, 3, 3, 4, -1]);
  });

  it('punya label teks untuk pembaca layar', () => {
    render(<CycleTrack kind="bunting" />);
    expect(
      screen.getByRole('img', { name: 'Siklus: tahap Bunting (4 dari 5)' }),
    ).toBeInTheDocument();
    expect(cycleTrackLabel('keguguran')).toMatch(/keguguran/);
    expect(cycleTrackLabel('kosong')).toBe('Siklus: belum ada birahi tercatat');
  });

  it('tahap lewat bergaris, sekarang terisi, berikutnya kosong', () => {
    const { container } = render(<CycleTrack kind="sudah_IB_menunggu_PKB" />);
    const states = [...container.querySelectorAll('[data-stage-state]')].map((el) =>
      el.getAttribute('data-stage-state'),
    );
    expect(states).toEqual(['past', 'now', 'next', 'next', 'next']);
  });
});
