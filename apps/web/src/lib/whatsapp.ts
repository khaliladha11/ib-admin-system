// Tautan WhatsApp (wa.me) dengan pesan terisi otomatis untuk menindaklanjuti laporan terlambat.
// Tidak ada pesan yang dikirim otomatis: admin membuka WhatsApp dan menekan kirim sendiri.
import { formatDate } from './format';

/** "0812-3456 789" / "+62812…" / "62812…" / "812…" → "62812…"; null bila tidak valid. */
export function toWaNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return /^62\d{8,13}$/.test(digits) ? digits : null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const number = toWaNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

export interface FollowUpMessageInput {
  code: 'IB_RESULT_OVERDUE' | 'BIRTH_REPORT_OVERDUE';
  recipient: 'farmer' | 'inseminator';
  recipientName: string | null;
  animalName: string | null;
  qrCode: string | null;
  farmerName: string | null;
  locationName: string | null;
  eventAt: number | null;
  overdueDays: number;
  senderName: string;
}

/** Pesan sopan dan singkat; menyebut sapi, tanggal patokan, dan apa yang diminta. */
export function followUpMessage(m: FollowUpMessageInput): string {
  const sapi = `sapi ${m.animalName ?? 'tanpa nama'}${m.qrCode ? ` (${m.qrCode})` : ''}`;
  const milik = m.farmerName
    ? ` milik ${m.farmerName}${m.locationName ? `, ${m.locationName}` : ''}`
    : '';
  const tgl = m.eventAt ? formatDate(m.eventAt) : null;
  const halo = `Halo${m.recipientName ? ` ${m.recipientName}` : ''},`;
  const penutup = `Terima kasih.\n${m.senderName}`;
  if (m.code === 'IB_RESULT_OVERDUE') {
    return m.recipient === 'inseminator'
      ? `${halo} hasil IB untuk ${sapi}${milik}${tgl ? ` yang di-IB pada ${tgl}` : ''} belum dilaporkan (lewat ${String(m.overdueDays)} hari dari batas 3 bulan). Mohon lakukan PKB dan catat hasilnya di aplikasi. ${penutup}`
      : `${halo} ${sapi} Bapak/Ibu${tgl ? ` di-IB pada ${tgl}` : ''}, tetapi hasil pemeriksaan kebuntingan (PKB) belum tercatat. Mohon minta PKB ke petugas lewat aplikasi atau balas pesan ini. ${penutup}`;
  }
  return m.recipient === 'inseminator'
    ? `${halo} ${sapi}${milik}${tgl ? ` dinyatakan bunting pada ${tgl}` : ''}, tetapi kelahiran/keguguran belum dilaporkan (lewat ${String(m.overdueDays)} hari dari perkiraan lahir paling lambat). Mohon cek ke peternak dan catat hasilnya. ${penutup}`
    : `${halo} ${sapi} Bapak/Ibu${tgl ? ` tercatat bunting sejak ${tgl}` : ''} dan sudah lewat perkiraan lahir. Apakah sapi sudah melahirkan atau keguguran? Mohon catat di aplikasi atau balas pesan ini. ${penutup}`;
}
