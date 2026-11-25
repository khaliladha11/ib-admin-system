import { describe, expect, it } from 'vitest';

import { uuidv7 } from '../ids';
import {
  animalTagSchema,
  assignmentSchema,
  farmerSchema,
  QR_CODE_PATTERN,
  userSchema,
} from './entities';

const now = Date.UTC(2026, 10, 25);
const base = {
  id: uuidv7(now),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  deviceId: 'server',
};

describe('QR_CODE_PATTERN', () => {
  it.each(['IB-7KQ2M', 'IB-ZZZZZ', 'IB-23456'])('menerima %s', (code) => {
    expect(QR_CODE_PATTERN.test(code)).toBe(true);
  });

  it.each(['IB-7KQ2', 'IB-O1234', 'IB-I2345', 'IB-12345', 'ib-7kq2m', 'XX-7KQ2M'])(
    'menolak %s (salah format atau memakai O/0/I/1)',
    (code) => {
      expect(QR_CODE_PATTERN.test(code)).toBe(false);
    },
  );
});

describe('userSchema', () => {
  const user = {
    ...base,
    name: 'Petugas Contoh',
    email: null,
    phone: '081234567890',
    passwordHash: null,
    role: 'inseminator',
    locationId: null,
    isActive: true,
  };

  it('menerima pengguna dengan nomor HP saja', () => {
    expect(userSchema.safeParse(user).success).toBe(true);
  });

  it('wajib punya email atau nomor HP', () => {
    expect(userSchema.safeParse({ ...user, phone: null }).success).toBe(false);
  });

  it('peran hanya dari daftar', () => {
    expect(userSchema.safeParse({ ...user, role: 'admin' }).success).toBe(false);
  });

  it('format nomor HP divalidasi', () => {
    expect(userSchema.safeParse({ ...user, phone: '0812-3456' }).success).toBe(false);
  });
});

describe('farmerSchema', () => {
  it('boleh tanpa akun login (userId null)', () => {
    const farmer = {
      ...base,
      userId: null,
      locationId: uuidv7(),
      name: 'Pak Contoh',
      phone: null,
      address: null,
      isikhnasOwnerId: null,
    };
    expect(farmerSchema.safeParse(farmer).success).toBe(true);
  });
});

describe('animalTagSchema', () => {
  const tag = {
    ...base,
    animalId: uuidv7(),
    type: 'qr',
    code: 'IB-7KQ2M',
    attachedAt: now,
    removedAt: null,
    removalReason: null,
  };

  it('menerima tag QR yang terpasang', () => {
    expect(animalTagSchema.safeParse(tag).success).toBe(true);
  });

  it('kode QR harus berformat IB-XXXXX; eartag bebas', () => {
    expect(animalTagSchema.safeParse({ ...tag, code: 'ABC' }).success).toBe(false);
    expect(
      animalTagSchema.safeParse({ ...tag, type: 'eartag', code: 'ID-3201-000123' }).success,
    ).toBe(true);
  });

  it('waktu cabut dan alasan cabut diisi bersamaan', () => {
    expect(animalTagSchema.safeParse({ ...tag, removedAt: now }).success).toBe(false);
    expect(
      animalTagSchema.safeParse({ ...tag, removedAt: now, removalReason: 'lost' }).success,
    ).toBe(true);
  });
});

describe('assignmentSchema', () => {
  it('waktu selesai dan alasan selesai diisi bersamaan', () => {
    const a = {
      ...base,
      serviceRequestId: uuidv7(),
      inseminatorId: uuidv7(),
      assignedBy: uuidv7(),
      assignedAt: now,
      acceptedAt: null,
      endedAt: now,
      endReason: null,
    };
    expect(assignmentSchema.safeParse(a).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...a, endReason: 'reassigned' }).success).toBe(true);
  });
});
