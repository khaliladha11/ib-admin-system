// Hook pemindai: kamera belakang + pembaca QR, memanggil `onCode` untuk setiap kode baru.
// Kode yang sama dalam 2,5 detik diabaikan agar satu label tidak terbaca berkali-kali.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  cameraProblemOf,
  openRearCamera,
  setTorch,
  stopStream,
  torchSupported,
  type CameraProblem,
} from '@/lib/scan/camera';
import { createQrDetector, type QrDetector, type ScanEngine } from '@/lib/scan/detector';

const INTERVAL_MS = 180;
const REPEAT_COOLDOWN_MS = 2500;

export type ScannerState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'scanning'; engine: ScanEngine; torch: boolean | null }
  | { status: 'error'; problem: CameraProblem };

export function useQrScanner(onCode: (text: string) => void, paused: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<QrDetector | null>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<ScannerState>({ status: 'idle' });

  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  });

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setState({ status: 'starting' });
    try {
      const stream = await openRearCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      detectorRef.current ??= await createQrDetector();
      setState({
        status: 'scanning',
        engine: detectorRef.current.engine,
        torch: torchSupported(stream) ? false : null,
      });
    } catch (err) {
      stop();
      setState({ status: 'error', problem: cameraProblemOf(err) });
    }
  }, [stop]);

  // Izin kamera sudah pernah diberikan: langsung nyalakan (tanpa perlu menekan tombol).
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      .query({ name: 'camera' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') void start();
      })
      .catch(() => undefined); // browser tanpa Permissions API untuk kamera: tunggu tombol
    return () => {
      cancelled = true;
    };
  }, [start]);

  // Baca frame berkala selama kamera menyala.
  const scanning = state.status === 'scanning';
  useEffect(() => {
    if (!scanning) return;
    let busy = false;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (busy || pausedRef.current || !video || !detector || video.readyState < 2) return;
      busy = true;
      detector
        .detect(video)
        .then((text) => {
          if (!text) return;
          const now = Date.now();
          const last = lastRef.current;
          if (last?.text === text && now - last.at < REPEAT_COOLDOWN_MS) return;
          lastRef.current = { text, at: now };
          onCodeRef.current(text);
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [scanning]);

  // Matikan kamera saat halaman ditinggalkan atau aplikasi ke latar belakang.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        stop();
        setState({ status: 'idle' });
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stop();
    };
  }, [stop]);

  const toggleTorch = useCallback(async () => {
    if (state.status !== 'scanning' || state.torch === null || !streamRef.current) return;
    const next = !state.torch;
    try {
      await setTorch(streamRef.current, next);
      setState({ ...state, torch: next });
    } catch {
      setState({ ...state, torch: null });
    }
  }, [state]);

  /** Lupakan kode terakhir agar label yang sama bisa discan lagi. */
  const forgetLast = useCallback(() => {
    lastRef.current = null;
  }, []);

  return { videoRef, state, start, stop, toggleTorch, forgetLast };
}
