/** Konfigurasi server dari environment variable (lihat .env.example di root). */
export interface ServerConfig {
  /** Cookie hanya dikirim lewat HTTPS. Bawaan: true bila NODE_ENV=production. */
  cookieSecure: boolean;
  /** Lama sesi login, dalam hari. */
  sessionTtlDays: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
  };
}
