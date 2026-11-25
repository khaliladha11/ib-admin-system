/** Path endpoint health, dipakai server (rute) dan web (fetch). */
export const HEALTH_PATH = '/api/health';

export interface HealthResponse {
  status: 'ok';
  service: string;
  /** Waktu server dalam format ISO 8601. */
  time: string;
}

export function createHealthResponse(service: string, now: Date): HealthResponse {
  return { status: 'ok', service, time: now.toISOString() };
}

/** Memeriksa bentuk respons dari jaringan sebelum dipakai di UI. */
export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.status === 'ok' && typeof v.service === 'string' && typeof v.time === 'string';
}
