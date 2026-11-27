// Nama form/layar di catatan pemakaian (langkah 5.1).
export const USAGE_NAME_TEXT: Record<string, string> = {
  record: 'Catat kejadian',
  request: 'Minta IB/PKB',
  home: 'Hari ini',
  animals: 'Daftar ternak',
  scan: 'Scan QR',
  tasks: 'Tugas',
};

export function formatDuration(ms: number | null): string {
  if (ms === null) return '–';
  if (ms < 1000) return '< 1 detik';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${String(s)} detik` : `${String(Math.floor(s / 60))} mnt ${String(s % 60)} dtk`;
}
