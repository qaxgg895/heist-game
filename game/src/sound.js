// Tiny synthesised sound effects: no audio files, just the Web Audio API.
// Everything is guarded, so a browser without audio (or a headless screenshot
// run) simply stays silent.
export function createSound() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(gain, ctx.currentTime + delay);
      amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur);
    } catch {
      // Silence is always an acceptable fallback.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12);
      tone(1318, 0.14, 'sine', 0.1, 0.08);
    },
    diamond() {
      tone(1046, 0.1, 'sine', 0.12);
      tone(1318, 0.1, 'sine', 0.12, 0.09);
      tone(1568, 0.22, 'sine', 0.12, 0.18);
    },
    spotted() {
      tone(220, 0.16, 'sawtooth', 0.07);
      tone(185, 0.22, 'sawtooth', 0.07, 0.12);
    },
    laser() {
      tone(1400, 0.08, 'square', 0.06);
      tone(900, 0.12, 'square', 0.06, 0.07);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, i * 0.11));
    },
    busted() {
      tone(160, 0.5, 'sawtooth', 0.1);
      tone(110, 0.7, 'sawtooth', 0.1, 0.25);
    },
  };
}
