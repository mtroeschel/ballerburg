/**
 * Synthetische Sounds über die Web Audio API (keine Asset-Dateien).
 * Erster Aufruf initialisiert den AudioContext (Browser-Autoplay-Regel).
 */
export interface Sound {
  click(): void;
  cannonFire(): void;
  impact(): void;
  bigExplosion(): void;
  victory(): void;
}

export function createSound(): Sound {
  let ac: AudioContext | null = null;

  const ensure = (): AudioContext | null => {
    if (ac) {
      if (ac.state === 'suspended') void ac.resume();
      return ac;
    }
    try {
      ac = new AudioContext();
      return ac;
    } catch {
      return null;
    }
  };

  const playNoise = (dur: number, vol: number, lowpassHz: number): void => {
    const ctx = ensure();
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const n = Math.max(1, Math.floor(sr * dur));
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);
    let lp = 0;
    const k = Math.min(1, lowpassHz / sr);
    for (let i = 0; i < n; i++) {
      const f = Math.random() * 2 - 1;
      lp += (f - lp) * k;
      data[i] = lp * vol;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  };

  const playTone = (
    freqFrom: number,
    freqTo: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'sine',
  ): void => {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.linearRampToValueAtTime(freqTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(t0 + dur + 0.02);
  };

  return {
    click() {
      playTone(700, 900, 0.06, 0.12, 'square');
    },
    cannonFire() {
      playNoise(0.28, 0.35, 220);
      playTone(80, 38, 0.4, 0.5, 'sine');
    },
    impact() {
      playNoise(0.2, 0.4, 300);
      playTone(110, 45, 0.3, 0.45, 'sine');
    },
    bigExplosion() {
      playNoise(0.8, 0.55, 180);
      playNoise(0.5, 0.3, 1200);
      playTone(70, 30, 0.9, 0.6, 'sine');
    },
    victory() {
      playTone(523, 523, 0.14, 0.25, 'square'); // C5
      playTone(659, 659, 0.14, 0.25, 'square'); // E5
      playTone(784, 784, 0.3, 0.28, 'square');  // G5
    },
  };
}