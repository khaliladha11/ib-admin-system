// Header keamanan (langkah 6.1). Semua respons: nosniff, tanpa referrer, tidak boleh dibingkai,
// izin perangkat hanya kamera (scan QR). CSP ketat untuk aplikasi web dari origin yang sama;
// halaman Swagger butuh satu skrip inline sehingga punya CSP sendiri.
// HSTS sengaja TIDAK dipasang: pos IB dibuka lewat alamat IP dengan sertifikat lokal, dan
// sertifikat root diunduh lewat http://IP/sertifikat (lihat docs/INSTALL.md).
import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

type SecureHeadersOptions = NonNullable<Parameters<typeof secureHeaders>[0]>;

/** CSP aplikasi web (build Vite: tanpa skrip inline). */
export const APP_CSP = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  // Motion dan Tailwind memakai atribut style; tidak ada <style> dari pihak luar.
  styleSrc: ["'self'", "'unsafe-inline'"],
  // Foto ternak (blob:), gambar kecil data:.
  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  mediaSrc: ["'self'", 'blob:'],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

const DOCS_CSP = { ...APP_CSP, scriptSrc: ["'self'", "'unsafe-inline'"] };

const common: SecureHeadersOptions = {
  strictTransportSecurity: false,
  xFrameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
  // Kamera untuk scan QR; lainnya mati.
  permissionsPolicy: {
    camera: ['self'],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
  },
};

const appHeaders = secureHeaders({ ...common, contentSecurityPolicy: APP_CSP });
const docsHeaders = secureHeaders({ ...common, contentSecurityPolicy: DOCS_CSP });

export const securityHeaders: MiddlewareHandler = (c, next) =>
  c.req.path === '/api/docs' ? docsHeaders(c, next) : appHeaders(c, next);
