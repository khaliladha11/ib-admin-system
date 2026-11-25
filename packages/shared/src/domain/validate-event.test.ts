import { describe, expect, it } from 'vitest';

import { bb, bh, DAY, ev, exit, health, ib, kgg, lh, pkbNeg, pkbPos } from './test-helpers';
import { validateNextEvent } from './validate-event';

const pregnant = () => [ib(150), pkbPos(90, 2)];

function expectOk(result: ReturnType<typeof validateNextEvent>) {
  expect(result.errors).toEqual([]);
  expect(result.ok).toBe(true);
}

function expectError(result: ReturnType<typeof validateNextEvent>, pattern: RegExp) {
  expect(result.ok).toBe(false);
  expect(result.errors.join('\n')).toMatch(pattern);
}

describe('validateNextEvent: diterima', () => {
  it('(21) BH pada sapi kosong', () => {
    expectOk(validateNextEvent([], bh(0)));
  });

  it.each([
    ['birahi', [bh(1)]],
    ['kosong', [bb(20)]],
    ['sudah lahir', [ib(330), pkbPos(250, 3), lh(60)]],
    ['keguguran', [ib(200), pkbPos(140), kgg(60)]],
  ])('(22) IB pada sapi %s', (_label, history) => {
    expectOk(validateNextEvent(history, ib(0)));
  });

  it('(23) PKB bunting atau tidak bunting setelah IB', () => {
    expectOk(validateNextEvent([ib(70)], pkbPos(0)));
    expectOk(validateNextEvent([ib(70)], pkbNeg(0)));
  });

  it('(24) KGG pada sapi bunting', () => {
    expectOk(validateNextEvent(pregnant(), kgg(0)));
  });

  it('(25) LH pada sapi bunting dengan umur kebuntingan normal', () => {
    const result = validateNextEvent([ib(285), pkbPos(220)], lh(0));
    expectOk(result);
    expect(result.warnings).toEqual([]);
  });

  it('(26) BB dan HEALTH pada status apa pun selain keluar', () => {
    for (const history of [[], [bh(1)], [ib(40)], pregnant(), [ib(330), pkbPos(250), lh(10)]]) {
      expectOk(validateNextEvent(history, bb(0)));
      expectOk(validateNextEvent(history, health(0)));
    }
  });

  it('(27) event pengganti dinilai seolah event lama tidak ada', () => {
    const history = pregnant();
    const wrongLh = lh(10);
    // LH lama (yang menyebabkan status "sudah lahir") diganti KGG: harus diterima.
    const fix = ev(10, { type: 'KGG', payload: { trimester: 3 } }, { voidsEventId: wrongLh.id });
    expectOk(validateNextEvent([...history, wrongLh], fix));
  });
});

describe('validateNextEvent: ditolak', () => {
  it('(28) LH tanpa PKB bunting', () => {
    expectError(validateNextEvent([bh(1)], lh(0)), /Kelahiran hanya bisa dicatat untuk sapi yang tercatat bunting/);
  });

  it('(29) IB pada sapi bunting', () => {
    expectError(validateNextEvent(pregnant(), ib(0)), /Sapi sedang bunting; IB tidak bisa dicatat/);
  });

  it('(30) KGG pada sapi yang tidak bunting', () => {
    expectError(validateNextEvent([ib(40)], kgg(0)), /Keguguran hanya bisa dicatat untuk sapi yang tercatat bunting/);
  });

  it('(31) event apa pun setelah EXIT', () => {
    expectError(validateNextEvent([exit(5)], bb(0)), /Ternak sudah keluar/);
    expectError(validateNextEvent([exit(5)], bh(0)), /Ternak sudah keluar/);
  });

  it('(33) voidsEventId harus menunjuk event yang ada, belum dibatalkan, dan milik ternak yang sama', () => {
    const original = bb(10, 34);
    const missing = ev(10, { type: 'BB', payload: { weightKg: 340 } }, { voidsEventId: '0193f000-0000-7000-8000-999999999999' });
    expectError(validateNextEvent([original], missing), /Event yang dibatalkan tidak ditemukan/);

    const first = ev(10, { type: 'BB', payload: { weightKg: 340 } }, { voidsEventId: original.id });
    const again = ev(10, { type: 'BB', payload: { weightKg: 341 } }, { voidsEventId: original.id });
    expectError(validateNextEvent([original, first], again), /sudah dibatalkan/);

    const other = { ...bb(10, 34), animalId: '0193f000-0000-7000-8000-00000000abcd' };
    const fixOther = ev(10, { type: 'BB', payload: { weightKg: 340 } }, { voidsEventId: other.id });
    expectError(validateNextEvent([other], fixOther), /ternak lain/);
  });

  it('(34) event bertanggal mundur yang membuat riwayat sesudahnya tidak masuk akal', () => {
    const history = [ib(300), pkbPos(240, 2), lh(20)];
    expectError(validateNextEvent(history, pkbNeg(100)), /riwayat sesudahnya/);
  });

  it('(35) PKB kurang dari 30 hari setelah IB', () => {
    expectError(validateNextEvent([ib(20)], pkbPos(0)), /PKB terlalu cepat/);
  });

  it('event dari ternak lain ditolak', () => {
    const other = { ...bh(0), animalId: '0193f000-0000-7000-8000-00000000abcd' };
    expectError(validateNextEvent([ib(40)], other), /ternak lain/);
  });
});

describe('validateNextEvent: peringatan (boleh disimpan)', () => {
  it('(36) BH pada sapi bunting', () => {
    const result = validateNextEvent(pregnant(), bh(0));
    expectOk(result);
    expect(result.warnings.join('\n')).toMatch(/tercatat bunting tetapi menunjukkan birahi/);
  });

  it('(32/37) PKB tanpa catatan IB', () => {
    for (const pkb of [pkbPos(0, 3), pkbNeg(0)]) {
      const result = validateNextEvent([bb(10)], pkb);
      expectOk(result);
      expect(result.warnings.join('\n')).toMatch(/Belum ada catatan IB/);
    }
  });

  it('(38) LH dengan umur kebuntingan di bawah 240 hari', () => {
    const result = validateNextEvent([ib(200), pkbPos(140)], lh(0));
    expectOk(result);
    expect(result.warnings.join('\n')).toMatch(/prematur/);
  });

  it('(39) IB kurang dari 18 hari setelah IB sebelumnya, di luar masa birahi yang sama', () => {
    const result = validateNextEvent([ib(10)], ib(0));
    expectOk(result);
    expect(result.warnings.join('\n')).toMatch(/18 hari/);
  });

  it('IB ulang dalam masa birahi yang sama tanpa peringatan', () => {
    const first = ib(0);
    const second = { ...ib(0), occurredAt: first.occurredAt + DAY / 2 };
    expect(validateNextEvent([first], second).warnings).toEqual([]);
  });

  it('PKB tidak bunting pada sapi yang tercatat bunting', () => {
    const result = validateNextEvent(pregnant(), pkbNeg(0));
    expectOk(result);
    expect(result.warnings.join('\n')).toMatch(/keguguran yang belum dicatat/);
  });
});
