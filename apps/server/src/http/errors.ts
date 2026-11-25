import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Kode error yang mungkin dikembalikan API. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_EVENT',
  'WARNINGS_NEED_CONFIRMATION',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Bentuk semua respons error: { error: { code, message, details? } }. */
export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('Error');

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Data') =>
  new ApiError(404, 'NOT_FOUND', `${what} tidak ditemukan.`);
export const forbidden = (message = 'Anda tidak punya akses untuk tindakan ini.') =>
  new ApiError(403, 'FORBIDDEN', message);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, 'CONFLICT', message, details);
export const unauthenticated = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');

export function errorBody(code: ErrorCode, message: string, details?: unknown) {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Dipasang sebagai app.onError: semua error menjadi JSON dengan format yang sama. */
export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  if (err instanceof HTTPException) {
    const code: ErrorCode = err.status === 401 ? 'UNAUTHENTICATED' : 'VALIDATION_ERROR';
    return c.json(errorBody(code, err.message || 'Permintaan tidak valid.'), err.status);
  }
  if (err instanceof z.ZodError) {
    return c.json(
      errorBody('VALIDATION_ERROR', 'Data yang dikirim tidak valid.', z.flattenError(err)),
      400,
    );
  }
  console.error(err);
  return c.json(errorBody('INTERNAL_ERROR', 'Terjadi kesalahan di server.'), 500);
}

/** defaultHook OpenAPIHono: kegagalan validasi Zod pada request menjadi 400 yang konsisten. */
export function validationHook(
  result: { success: true } | { success: false; error: z.ZodError },
  c: Context,
) {
  if (!result.success) {
    return c.json(
      errorBody('VALIDATION_ERROR', 'Data yang dikirim tidak valid.', z.flattenError(result.error)),
      400,
    );
  }
  return undefined;
}

/** Respons error standar untuk dokumentasi OpenAPI. */
const errorContent = { 'application/json': { schema: errorResponseSchema } };
export const errorResponses = {
  400: { description: 'Data tidak valid', content: errorContent },
  401: { description: 'Belum masuk', content: errorContent },
  403: { description: 'Tidak punya akses', content: errorContent },
  404: { description: 'Tidak ditemukan', content: errorContent },
  409: { description: 'Konflik dengan data yang ada', content: errorContent },
} as const;

export const eventErrorResponses = {
  ...errorResponses,
  422: { description: 'Urutan event tidak masuk akal', content: errorContent },
} as const;
