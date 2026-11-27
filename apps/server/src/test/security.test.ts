// Langkah 6.1: batas percobaan masuk dan header keamanan.
import { describe, expect, it } from 'vitest';

import { createLoginLimiter, IP_FACTOR } from '../auth/login-limiter';
import { createHarness } from './api-harness';

const MIN = 60_000;

describe('createLoginLimiter', () => {
  it('mengunci akun setelah batas, lalu terbuka lagi setelah waktu kunci', () => {
    const l = createLoginLimiter({ maxAttempts: 3, lockMs: 15 * MIN });
    for (let i = 0; i < 2; i++) l.failed('0812 0000-0100', '1.1.1.1', i);
    expect(l.retryAfter('081200000100', '1.1.1.1', 10)).toBeNull();
    l.failed('081200000100', '1.1.1.1', 10);
    expect(l.retryAfter('081200000100', '9.9.9.9', 20)).toBe(15 * 60);
    expect(l.retryAfter('081200000100', '9.9.9.9', 10 + 15 * MIN)).toBeNull();
  });

  it('hitungan lama kedaluwarsa; masuk berhasil mengosongkan hitungan akun', () => {
    const l = createLoginLimiter({ maxAttempts: 2, lockMs: MIN });
    l.failed('a@x.test', 'ip', 0);
    l.failed('a@x.test', 'ip', 2 * MIN); // jendela pertama sudah lewat
    expect(l.retryAfter('a@x.test', 'ip', 2 * MIN)).toBeNull();
    l.succeeded('a@x.test', 'ip');
    l.failed('a@x.test', 'ip', 2 * MIN + 1);
    expect(l.retryAfter('a@x.test', 'ip', 2 * MIN + 2)).toBeNull();
  });

  it('satu IP mencoba banyak akun ikut dikunci', () => {
    const l = createLoginLimiter({ maxAttempts: 2, lockMs: MIN });
    for (let i = 0; i < 2 * IP_FACTOR; i++) l.failed(`akun${String(i)}`, '6.6.6.6', i);
    expect(l.retryAfter('akun-baru', '6.6.6.6', 100)).not.toBeNull();
    expect(l.retryAfter('akun-baru', '7.7.7.7', 100)).toBeNull();
  });
});

describe('API login', () => {
  it('5× password salah → 429 dengan Retry-After, password benar pun ditolak sampai kunci lewat', async () => {
    const h = await createHarness({ loginMaxAttempts: 5, loginLockMinutes: 15 });
    const login = (password: string, ip = '10.0.0.5') =>
      h.app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ identifier: 'admin.ktt01@contoh.test', password }),
      });
    for (let i = 0; i < 5; i++) expect((await login('salah')).status).toBe(401);
    const blocked = await login('contoh123');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('900');
    const body = (await blocked.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body.error.message).toMatch(/15 menit/);

    // Akun lain dari alamat yang sama tetap bisa masuk.
    const other = await h.request('POST', '/api/auth/login', {
      body: { identifier: 'admin.dinas@contoh.test', password: 'contoh123' },
    });
    expect(other.status).toBe(200);

    h.advanceDays(1 / 48); // 30 menit
    expect((await login('contoh123')).status).toBe(200);
    h.close();
  });
});

describe('header keamanan', () => {
  it('API dan halaman: nosniff, tanpa frame, CSP ketat, tanpa HSTS', async () => {
    const h = await createHarness();
    const res = await h.app.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('strict-transport-security')).toBeNull();
    expect(res.headers.get('permissions-policy')).toContain('camera=(self)');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");

    const docs = await h.app.request('/api/docs');
    expect(docs.headers.get('content-security-policy')).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    h.close();
  });
});
