import type { Db } from '../db/client';
import type { ServerConfig } from '../config';
import type { LoginLimiter } from '../auth/login-limiter';
import type { AuthUser } from '../auth/session';

/** Variabel per-request yang dipasang middleware. */
export interface AppEnv {
  Variables: {
    db: Db;
    config: ServerConfig;
    /** Waktu sekarang (ms). Bisa diganti di tes. */
    now: () => number;
    /** device_id untuk baris yang ditulis (header X-Device-Id, bawaan "server"). */
    deviceId: string;
    /** Batas percobaan masuk (satu per app). */
    loginLimiter: LoginLimiter;
    /** Pengguna yang sedang masuk, bila ada. */
    user: AuthUser | null;
  };
}
