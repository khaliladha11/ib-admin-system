// Manajemen pengguna: ONLINE-ONLY (menyangkut password dan hak akses), langsung ke server.
// Setelah berhasil, data pengguna ditarik ulang lewat sinkron agar daftar di perangkat ikut berubah.
import type { PublicUser, UserRole } from '@ib/shared';

import type { DataLayer } from './context';

export interface CreateUserInput {
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  locationId: string;
  password: string;
  /** Wajib untuk akun peternak. */
  farmerId?: string;
}

export type UpdateUserInput = Partial<{
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  locationId: string;
  isActive: boolean;
}>;

/** Peran yang boleh dibuat oleh admin ini (sama dengan aturan server). */
export const assignableRoles = (role: UserRole): readonly UserRole[] =>
  role === 'agency_admin'
    ? ['farmer', 'inseminator', 'group_admin', 'agency_admin']
    : ['farmer', 'inseminator'];

async function refresh(layer: DataLayer) {
  await layer.sync.pullChanges().catch(() => undefined);
}

export async function createUser(layer: DataLayer, input: CreateUserInput) {
  const user = await layer.api.request<PublicUser>('POST', '/api/users', input);
  await refresh(layer);
  return user;
}

export async function updateUser(layer: DataLayer, id: string, patch: UpdateUserInput) {
  const user = await layer.api.request<PublicUser>('PATCH', `/api/users/${id}`, patch);
  await refresh(layer);
  return user;
}

export async function resetPassword(layer: DataLayer, id: string, password: string) {
  await layer.api.request('POST', `/api/users/${id}/password`, { password });
}
