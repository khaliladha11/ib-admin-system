import { describe, expect, it } from 'vitest';
import { createHealthResponse, isHealthResponse } from './health';

describe('createHealthResponse', () => {
  it('mengisi status, nama layanan, dan waktu ISO', () => {
    const now = new Date('2026-11-25T03:00:00.000Z');
    expect(createHealthResponse('ib-server', now)).toEqual({
      status: 'ok',
      service: 'ib-server',
      time: '2026-11-25T03:00:00.000Z',
    });
  });
});

describe('isHealthResponse', () => {
  it('menerima respons yang valid', () => {
    expect(isHealthResponse(createHealthResponse('ib-server', new Date()))).toBe(true);
  });

  it.each([null, undefined, 'ok', 42, {}, { status: 'down', service: 'x', time: 't' }])(
    'menolak %j',
    (value) => {
      expect(isHealthResponse(value)).toBe(false);
    },
  );
});
