// Pembaca QR: BarcodeDetector bawaan browser (Chrome Android) bila ada, selain itu ZXing
// (@zxing/browser) yang dimuat hanya saat dibutuhkan.

export type ScanEngine = 'native' | 'zxing';

export interface QrDetector {
  engine: ScanEngine;
  /** Teks QR pada frame video saat ini, atau null bila tidak ada. */
  detect: (video: HTMLVideoElement) => Promise<string | null>;
}

interface NativeBarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
interface NativeBarcodeDetectorClass {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats: () => Promise<string[]>;
}

/** BarcodeDetector yang bisa membaca QR, atau null. */
export async function nativeDetectorClass(
  scope: object = globalThis,
): Promise<NativeBarcodeDetectorClass | null> {
  const Ctor = (scope as { BarcodeDetector?: NativeBarcodeDetectorClass }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = await Ctor.getSupportedFormats();
    return formats.includes('qr_code') ? Ctor : null;
  } catch {
    return null;
  }
}

export async function createQrDetector(): Promise<QrDetector> {
  const Native = await nativeDetectorClass();
  if (Native) {
    const detector = new Native({ formats: ['qr_code'] });
    return {
      engine: 'native',
      detect: async (video) => {
        const found = await detector.detect(video);
        return found[0]?.rawValue ?? null;
      },
    };
  }

  const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const reader = new BrowserQRCodeReader(new Map([[DecodeHintType.TRY_HARDER, true]]));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return {
    engine: 'zxing',
    detect: (video) => {
      if (!ctx || video.videoWidth === 0) return Promise.resolve(null);
      // Potong bagian tengah (bingkai bidik) agar lebih cepat di HP murah.
      const side = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = Math.min(side, 720);
      canvas.height = canvas.width;
      ctx.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      try {
        return Promise.resolve(reader.decodeFromCanvas(canvas).getText());
      } catch {
        return Promise.resolve(null); // tidak ada QR pada frame ini
      }
    },
  };
}
