// Isi QR label: kode saja, atau URL https://domain/t/IB-XXXXX bila VITE_QR_BASE_URL diatur.
// QR tidak pernah berisi nama sapi, nama peternak, atau data pribadi lain.
import { qrPayload } from '@ib/shared';

const BASE_URL = (import.meta.env.VITE_QR_BASE_URL as string | undefined) ?? '';

export const labelPayload = (code: string) => qrPayload(code, BASE_URL);
