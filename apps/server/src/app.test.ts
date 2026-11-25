import { isHealthResponse } from '@ib/shared';
import { describe, expect, it } from 'vitest';
import { createApp, SERVICE_NAME } from './app';

describe('GET /api/health', () => {
  it('mengembalikan status ok dalam JSON', async () => {
    const now = new Date('2026-11-25T03:00:00.000Z');
    const res = await createApp(() => now).request('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body: unknown = await res.json();
    expect(isHealthResponse(body)).toBe(true);
    expect(body).toEqual({ status: 'ok', service: SERVICE_NAME, time: now.toISOString() });
  });

  it('mengembalikan 404 untuk rute yang tidak ada', async () => {
    const res = await createApp().request('/api/tidak-ada');
    expect(res.status).toBe(404);
  });
});
