import { describe, expect, it } from 'vitest';

import { followUpMessage, toWaNumber, waLink } from './whatsapp';

describe('toWaNumber', () => {
  it.each([
    ['0812-3456-7890', '6281234567890'],
    ['+62 812 3456 7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['81234567890', '6281234567890'],
  ])('%s → %s', (input, out) => {
    expect(toWaNumber(input)).toBe(out);
  });

  it('nomor kosong atau terlalu pendek → null (tombol tidak ditampilkan)', () => {
    expect(toWaNumber(null)).toBeNull();
    expect(toWaNumber('0812')).toBeNull();
    expect(waLink('', 'x')).toBeNull();
  });
});

describe('pesan tindak lanjut', () => {
  const base = {
    animalName: 'Melati',
    qrCode: 'IB-7K3QX',
    farmerName: 'Pak Suparman',
    locationName: 'Desa Sukamaju',
    eventAt: new Date(2026, 7, 1).getTime(),
    overdueDays: 12,
    senderName: 'Hartono, admin KTT Sumber Rejeki',
  };

  it('petugas: hasil IB belum dilaporkan', () => {
    const text = followUpMessage({
      ...base,
      code: 'IB_RESULT_OVERDUE',
      recipient: 'inseminator',
      recipientName: 'Andi',
    });
    expect(text).toContain('Halo Andi,');
    expect(text).toContain('sapi Melati (IB-7K3QX) milik Pak Suparman, Desa Sukamaju');
    expect(text).toContain('1 Agustus 2026');
    expect(text).toContain('lewat 12 hari dari batas 3 bulan');
    expect(text).toContain('Hartono, admin KTT Sumber Rejeki');
  });

  it('peternak: kelahiran belum dilaporkan', () => {
    const text = followUpMessage({
      ...base,
      code: 'BIRTH_REPORT_OVERDUE',
      recipient: 'farmer',
      recipientName: 'Pak Suparman',
    });
    expect(text).toContain('sudah melahirkan atau keguguran');
  });

  it('tautan wa.me berisi nomor dan pesan ter-encode', () => {
    expect(waLink('081234567890', 'Halo Andi, tes & cek')).toBe(
      'https://wa.me/6281234567890?text=Halo%20Andi%2C%20tes%20%26%20cek',
    );
  });
});
