// Klien HTTP kecil untuk /api. Hanya dipakai oleh sync engine dan sign-in, bukan oleh komponen.
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Server menjawab dengan status bukan 2xx. */
export class ApiRequestError extends Error {
  override readonly name = 'ApiRequestError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Server tidak bisa dihubungi (offline, DNS, server mati). */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';
  constructor(cause?: unknown) {
    super('Tidak bisa terhubung ke server.', { cause });
  }
}

export interface ApiClient {
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
}

export interface ApiClientOptions {
  /** Kosong = origin yang sama (dev: proxy Vite ke server). */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Dikirim sebagai header x-device-id (kolom device_id di server). */
  deviceId?: () => Promise<string>;
}

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  typeof (value as ApiErrorBody).error.message === 'string';

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createApiClient({
  baseUrl = '',
  fetch = (...args) => globalThis.fetch(...args),
  deviceId,
}: ApiClientOptions = {}): ApiClient {
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const headers: Record<string, string> = {};
      if (body !== undefined) headers['content-type'] = 'application/json';
      if (deviceId) headers['x-device-id'] = await deviceId();
      let res: Response;
      try {
        res = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          credentials: 'include',
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        throw new NetworkError(err);
      }
      const text = await res.text();
      const data = parseJson(text);
      if (!res.ok) {
        if (isErrorBody(data)) {
          throw new ApiRequestError(
            res.status,
            data.error.code,
            data.error.message,
            data.error.details,
          );
        }
        throw new ApiRequestError(res.status, 'UNKNOWN', `Server menjawab ${String(res.status)}.`);
      }
      return data as T;
    },
  };
}
