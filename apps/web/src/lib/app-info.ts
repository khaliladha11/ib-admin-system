// Info aplikasi untuk Lainnya → Tentang aplikasi. AGPL-3.0 §13: pengguna lewat jaringan harus
// bisa mendapatkan kode sumber, jadi tautan sumber selalu ditampilkan. Fork yang diubah wajib
// mengisi VITE_SOURCE_URL dengan alamat kode sumbernya sendiri.
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';
export const SOURCE_URL =
  (import.meta.env.VITE_SOURCE_URL as string | undefined) ??
  'https://github.com/khaliladha11/ib-admin-system';
export const LICENSE_NAME = 'AGPL-3.0';
