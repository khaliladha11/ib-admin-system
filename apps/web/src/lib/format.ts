// Format tanggal untuk layar (Bahasa Indonesia, zona waktu perangkat).
const DAY_MS = 86_400_000;

export const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatShortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export const formatLongToday = (ms: number) =>
  new Date(ms).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const formatDateTime = (ms: number) =>
  new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Selisih hari kalender (positif = ke depan). */
export const dayDiff = (ms: number, today: number) =>
  Math.round((startOfDay(ms) - startOfDay(today)) / DAY_MS);

/** "hari ini", "besok", "3 hari lagi", "kemarin", "5 hari lalu". */
export function relativeDay(ms: number, today: number): string {
  const d = dayDiff(ms, today);
  if (d === 0) return 'hari ini';
  if (d === 1) return 'besok';
  if (d === -1) return 'kemarin';
  return d > 0 ? `${String(d)} hari lagi` : `${String(-d)} hari lalu`;
}

/** Umur dari tanggal lahir YYYY-MM-DD: "2 tahun 3 bulan", "5 bulan". */
export function ageFrom(birthDate: string, today: number): string {
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const now = new Date(today);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 1) return 'kurang dari 1 bulan';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${String(rest)} bulan`;
  return rest === 0 ? `${String(years)} tahun` : `${String(years)} tahun ${String(rest)} bulan`;
}

/** Normalisasi untuk pencarian: huruf kecil, tanpa spasi/tanda hubung. */
export const normalizeSearch = (text: string) => text.toLowerCase().replace(/[\s\-_.]/g, '');
