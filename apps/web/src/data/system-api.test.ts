import { describe, expect, it } from 'vitest';

import { appUrlOf, certUrlOf, type SystemInfo } from './system-api';

const info = (patch: Partial<SystemInfo>): SystemInfo => ({
  publicUrl: null,
  certUrl: null,
  addresses: [],
  backups: [],
  backupKeep: 14,
  demoMode: false,
  ...patch,
});

describe('alamat pos untuk HP', () => {
  it('PUBLIC_URL diutamakan; sertifikat lewat http di host yang sama', () => {
    const i = info({ publicUrl: 'https://192.168.1.10', addresses: ['10.0.0.5'] });
    expect(appUrlOf(i)).toBe('https://192.168.1.10');
    expect(certUrlOf(i)).toBe('http://192.168.1.10/sertifikat');
    expect(certUrlOf({ ...i, certUrl: 'http://x/y' })).toBe('http://x/y');
  });

  it('tanpa PUBLIC_URL: IP pertama yang terdeteksi; tanpa IP: null', () => {
    expect(appUrlOf(info({ addresses: ['10.0.0.5'] }))).toBe('https://10.0.0.5');
    expect(appUrlOf(info({}))).toBeNull();
    expect(certUrlOf(info({}))).toBeNull();
  });
});
