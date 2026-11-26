// Tanda berhasil scan: getar singkat + bunyi "bip" (dibuat dengan Web Audio, tanpa file suara).

let audio: AudioContext | null = null;

export function beep(frequency = 1046, durationMs = 90) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const t = audio.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + durationMs / 1000 + 0.02);
  } catch {
    // Browser tanpa Web Audio: cukup getar.
  }
}

export function vibrate(pattern: number | number[] = 60) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

/** Berhasil: satu bip tinggi + getar pendek. Kode tidak dikenal: dua bip rendah. */
export function scanFeedback(kind: 'ok' | 'unknown') {
  if (kind === 'ok') {
    vibrate(60);
    beep(1046, 90);
  } else {
    vibrate([40, 60, 40]);
    beep(523, 80);
    setTimeout(() => {
      beep(523, 80);
    }, 140);
  }
}
