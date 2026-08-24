/** Lightweight chess UI sounds via Web Audio (no asset files). */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  }
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.04) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audio.destination);
  const now = audio.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export const chessSounds = {
  move() {
    tone(420, 60, "triangle", 0.035);
  },
  capture() {
    tone(280, 80, "square", 0.03);
    setTimeout(() => tone(180, 90, "square", 0.025), 40);
  },
  check() {
    tone(660, 70, "sine", 0.04);
    setTimeout(() => tone(880, 90, "sine", 0.035), 70);
  },
  gameEnd() {
    tone(520, 120, "sine", 0.04);
    setTimeout(() => tone(390, 160, "sine", 0.035), 100);
  },
  illegal() {
    tone(140, 100, "sawtooth", 0.02);
  },
};
