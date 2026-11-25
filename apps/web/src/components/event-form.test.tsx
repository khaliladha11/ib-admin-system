import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WarningsNeedConfirmation, type EventInput } from '@/data';

import { EventForm } from './event-form';

const NOW = new Date(2026, 10, 25, 9, 30).getTime();

function setup(
  onSubmit = vi.fn<(input: EventInput) => Promise<unknown>>().mockResolvedValue(undefined),
) {
  render(<EventForm onSubmit={onSubmit} now={() => NOW} />);
  return onSubmit;
}

describe('EventForm', () => {
  it('IB tanpa kode straw: pesan jelas per isian, belum dikirim', () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByLabelText('IB'));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan IB' }));
    expect(screen.getByText('Isi kode straw.')).toBeInTheDocument();
    expect(screen.getByText('Isi ID pejantan.')).toBeInTheDocument();
    expect(screen.getByLabelText('Kode straw')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('IB lengkap: mengirim EventInput dengan tanggal hari ini (jam sekarang)', async () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByLabelText('IB'));
    fireEvent.change(screen.getByLabelText('Kode straw'), { target: { value: 'SIM-1' } });
    fireEvent.change(screen.getByLabelText('ID pejantan'), { target: { value: 'BULL-7' } });
    fireEvent.change(screen.getByLabelText('Batch'), { target: { value: 'B1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan IB' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'IB',
        occurredAt: NOW,
        semenStockId: null,
        payload: { strawCode: 'SIM-1', bullId: 'BULL-7', batch: 'B1', notes: undefined },
      });
    });
    expect(await screen.findByText('IB tersimpan di HP ini.')).toBeInTheDocument();
  });

  it('PKB bunting wajib umur janin', () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByLabelText('PKB'));
    fireEvent.click(screen.getByLabelText('Bunting'));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan PKB' }));
    expect(screen.getByText('Pilih umur janin.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('tanggal setelah hari ini ditolak', () => {
    const onSubmit = setup();
    fireEvent.change(screen.getByLabelText('Tanggal kejadian'), {
      target: { value: '2026-11-26' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Birahi' }));
    expect(screen.getByText('Tanggal tidak boleh setelah hari ini.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('peringatan: tampil "Tetap simpan", lalu dikirim ulang dengan confirmWarnings', async () => {
    const onSubmit = vi
      .fn<(input: EventInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new WarningsNeedConfirmation(['Sapi tercatat bunting.']))
      .mockResolvedValueOnce(undefined);
    setup(onSubmit);
    fireEvent.click(screen.getByLabelText('Gelisah, sering melenguh'));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Birahi' }));
    expect(await screen.findByText('Sapi tercatat bunting.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tetap simpan' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
    expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({
      type: 'BH',
      confirmWarnings: true,
      payload: { signs: ['gelisah'] },
    });
    expect(await screen.findByText('Birahi tersimpan di HP ini.')).toBeInTheDocument();
  });

  it('peternak: hanya jenis yang diizinkan yang tampil', () => {
    render(<EventForm types={['BH', 'BB']} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('IB')).toBeNull();
    expect(screen.getByLabelText('Berat')).toBeInTheDocument();
  });
});
