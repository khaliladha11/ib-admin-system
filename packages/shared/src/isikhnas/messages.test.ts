import { describe, expect, it } from 'vitest';

import { bb, bh, ev, health, ib, kgg, pkbNeg, pkbPos } from '../domain/test-helpers';
import { isIsikhnasEvent, isikhnasMessages } from './messages';

const ids = { ownerId: '3201 0001', animalId: 'H-777' };

describe('format pesan iSIKHNAS', () => {
  it('BH [ID hewan]', () => {
    expect(isikhnasMessages(bh(1), ids)).toEqual([{ text: 'BH H-777', missing: [] }]);
    // BH tidak butuh ID pemilik.
    expect(isikhnasMessages(bh(1), { ownerId: null, animalId: 'H-1' })[0]?.text).toBe('BH H-1');
  });

  it('IB [pemilik] [hewan] [bull] [batch]; spasi di ID dibuang', () => {
    expect(isikhnasMessages(ib(1), ids)).toEqual([
      { text: 'IB 32010001 H-777 BULL-1 B-1', missing: [] },
    ]);
  });

  it('PKB [pemilik] [hewan] [bulan]; tidak bunting = 0', () => {
    expect(isikhnasMessages(pkbPos(1, 3), ids)[0]?.text).toBe('PKB 32010001 H-777 3');
    expect(isikhnasMessages(pkbPos(1, 2.5), ids)[0]?.text).toBe('PKB 32010001 H-777 2.5');
    expect(isikhnasMessages(pkbNeg(1), ids)[0]?.text).toBe('PKB 32010001 H-777 0');
    const noAge = ev(1, { type: 'PKB', payload: { result: 'pregnant' } });
    expect(isikhnasMessages(noAge, ids)).toEqual([{ text: null, missing: ['value'] }]);
  });

  it('KGG [pemilik] [hewan] [trimester]', () => {
    expect(isikhnasMessages(kgg(1), ids)[0]?.text).toBe('KGG 32010001 H-777 2');
  });

  it('LH [pemilik] [hewan] [J/B] [ID anak]; kembar = satu pesan per anak', () => {
    const calfA = '0193f000-0000-7000-8000-0000000000aa';
    const calfB = '0193f000-0000-7000-8000-0000000000bb';
    const twins = ev(1, {
      type: 'LH',
      payload: {
        calves: [
          { sex: 'M', condition: 'alive', calfAnimalId: calfA },
          { sex: 'F', condition: 'alive', calfAnimalId: calfB },
          { sex: 'F', condition: 'stillborn' },
        ],
      },
    });
    const calfIds = new Map([
      [calfA, 'H-901'],
      [calfB, null],
    ]);
    expect(isikhnasMessages(twins, { ...ids, calfIds })).toEqual([
      { text: 'LH 32010001 H-777 J H-901', missing: [] },
      { text: null, missing: ['calf'] },
      { text: 'LH 32010001 H-777 B', missing: [] },
    ]);
  });

  it('BB [pemilik] [hewan] [bobot]', () => {
    expect(isikhnasMessages(bb(1, 312.25), ids)[0]?.text).toBe('BB 32010001 H-777 312.3');
  });

  it('ID belum diisi: pesan tidak dibuat, kekurangannya disebut', () => {
    expect(isikhnasMessages(ib(1), { ownerId: ' ', animalId: null })).toEqual([
      { text: null, missing: ['owner', 'animal'] },
    ]);
    expect(isikhnasMessages(bh(1), { ownerId: null, animalId: null })[0]?.missing).toEqual([
      'animal',
    ]);
  });

  it('HEALTH dan EXIT tidak dilaporkan lewat format ini', () => {
    expect(isIsikhnasEvent(health(1))).toBe(false);
    expect(isikhnasMessages(health(1), ids)).toEqual([]);
    expect(isIsikhnasEvent(ib(1))).toBe(true);
  });
});
