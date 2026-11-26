// Kamera belakang untuk Scan. Pesan error ditulis untuk peternak, bukan nama error browser.

export type CameraProblem = 'denied' | 'notFound' | 'busy' | 'insecure' | 'unsupported' | 'other';

export const CAMERA_PROBLEM_TEXT: Record<CameraProblem, { title: string; body: string }> = {
  denied: {
    title: 'Izin kamera ditolak',
    body: 'Buka pengaturan situs di browser (ikon gembok di samping alamat), pilih Izin › Kamera › Izinkan, lalu tekan Coba lagi. Sementara itu, ketik kodenya di bawah.',
  },
  notFound: {
    title: 'Kamera tidak ditemukan',
    body: 'HP atau komputer ini tidak punya kamera yang bisa dipakai. Ketik kode di bawah.',
  },
  busy: {
    title: 'Kamera sedang dipakai aplikasi lain',
    body: 'Tutup aplikasi kamera atau video call, lalu tekan Coba lagi.',
  },
  insecure: {
    title: 'Kamera hanya bisa dipakai lewat alamat aman (https)',
    body: 'Buka aplikasi lewat alamat yang diawali https://. Sementara itu, ketik kodenya di bawah.',
  },
  unsupported: {
    title: 'Browser ini tidak bisa memakai kamera',
    body: 'Pakai Chrome versi terbaru, atau ketik kodenya di bawah.',
  },
  other: {
    title: 'Kamera tidak bisa dibuka',
    body: 'Tekan Coba lagi. Bila tetap gagal, ketik kodenya di bawah.',
  },
};

/** Golongkan error getUserMedia menjadi masalah yang bisa dijelaskan ke pengguna. */
export function cameraProblemOf(err: unknown): CameraProblem {
  const name = err instanceof Error || err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'notFound';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    case 'InsecureContextError':
      return 'insecure';
    case 'UnsupportedError':
      return 'unsupported';
    default:
      return 'other';
  }
}

class CameraUnavailable extends Error {
  constructor(name: 'InsecureContextError' | 'UnsupportedError') {
    super(name);
    this.name = name;
  }
}

/** Nyalakan kamera belakang (resolusi cukup untuk QR, hemat baterai). */
export async function openRearCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new CameraUnavailable('InsecureContextError');
  if (!('mediaDevices' in navigator) || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    throw new CameraUnavailable('UnsupportedError');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => {
    t.stop();
  });
}

/** Senter (lampu kilat) bila kamera mendukung; berguna di kandang yang gelap. */
export function torchSupported(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  const caps: (MediaTrackCapabilities & { torch?: boolean }) | undefined = track?.getCapabilities();
  return caps?.torch === true;
}

export async function setTorch(stream: MediaStream, on: boolean) {
  const track = stream.getVideoTracks()[0];
  await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}
