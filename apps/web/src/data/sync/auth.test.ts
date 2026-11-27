import { describe, expect, it } from 'vitest';

import { createTestLayer, errorReply, IDS } from '@/test/data-fixtures';

import { signIn, signOut } from './auth';

const meReply = (id: string, name: string) => ({
  status: 200,
  body: { user: { id, name, role: 'group_admin', locationId: null }, farmerId: null },
});

describe('signIn / signOut', () => {
  it('menyimpan sesi dan pemilik data, lalu menghapus tanda perlu masuk', async () => {
    const t = await createTestLayer('group_admin', () => meReply(IDS.admin, 'Hartono'));
    await t.db.meta.delete('session');
    await t.db.setMeta('sync', {
      cursor: '5.0.x',
      scope: null,
      lastSyncAt: null,
      lastError: 'x',
      needsLogin: true,
    });
    const session = await signIn(t.db, t.api, 'admin.ktt01@contoh.test', 'contoh123');
    expect(session.user).toEqual({
      id: IDS.admin,
      name: 'Hartono',
      role: 'group_admin',
      locationId: null,
    });
    expect(t.server.calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/auth/login',
      body: { identifier: 'admin.ktt01@contoh.test', password: 'contoh123' },
    });
    expect(await t.db.getMeta('sync')).toMatchObject({
      cursor: '5.0.x',
      needsLogin: false,
      lastError: null,
    });
  });

  it('password salah: error dari server diteruskan', async () => {
    const t = await createTestLayer('group_admin', () =>
      errorReply(401, 'UNAUTHENTICATED', 'Email/nomor HP atau password salah.'),
    );
    await expect(signIn(t.db, t.api, 'x', 'y')).rejects.toThrow(
      'Email/nomor HP atau password salah.',
    );
  });

  it('akun lain masuk: data lokal akun sebelumnya dihapus, kecuali masih ada yang belum terkirim', async () => {
    const t = await createTestLayer('group_admin', () => meReply(IDS.admin, 'Hartono'));
    await signIn(t.db, t.api, 'a', 'b');
    await t.repo.createAnimal({ farmerId: t.farmer.id, sex: 'F' });
    await signOut(t.db, t.api);
    expect(await t.db.getMeta('session')).toBeUndefined();

    t.server.setHandler(() => meReply(IDS.inseminator, 'Andi'));
    await expect(signIn(t.db, t.api, 'c', 'd')).rejects.toThrow(/belum terkirim/);
    expect(await t.db.animals.count()).toBe(2);

    await signIn(t.db, t.api, 'c', 'd', { discardOtherAccountData: true });
    expect(await t.db.animals.count()).toBe(0);
    expect(await t.db.outbox.count()).toBe(0);
    expect((await t.db.getMeta('owner'))?.id).toBe(IDS.inseminator);
  });
});
