import { isHealthResponse } from '@ib/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp, SERVICE_NAME } from './app';
import { createDb } from './db/client';

const NOW = Date.UTC(2026, 10, 25, 3, 0, 0);
let ctx: ReturnType<typeof createDb>;

beforeEach(() => {
  ctx = createDb(':memory:');
});
afterEach(() => {
  ctx.sqlite.close();
});

describe('GET /api/health', () => {
  it('mengembalikan status ok dalam JSON', async () => {
    const res = await createApp({ db: ctx.db, now: () => NOW }).request('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body: unknown = await res.json();
    expect(isHealthResponse(body)).toBe(true);
    expect(body).toEqual({
      status: 'ok',
      service: SERVICE_NAME,
      time: new Date(NOW).toISOString(),
    });
  });

  it('rute yang tidak ada: 404 dengan format error JSON', async () => {
    const res = await createApp({ db: ctx.db }).request('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Alamat API tidak ditemukan.' },
    });
  });
});
