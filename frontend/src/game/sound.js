// Tiny Web Audio synth for mystical game feedback. No external assets.
let ctx = null;
let enabled = true;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setSoundEnabled(v) {
  enabled = v;
}
export function isSoundEnabled() {
  return enabled;
}

function tone(freq, start, dur, type = "sine", gain = 0.14) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

function noiseBurst(start, dur, gain = 0.12) {
  const c = ac();
  if (!c) return;
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(c.currentTime + start);
}

export const sfx = {
  playCard() {
    if (!enabled) return;
    tone(523.25, 0, 0.18, "triangle", 0.1);
  },
  select() {
    if (!enabled) return;
    tone(659.25, 0, 0.1, "sine", 0.07);
  },
  winTrick() {
    if (!enabled) return;
    tone(196, 0, 0.6, "sine", 0.16);
    tone(392, 0.02, 0.5, "sine", 0.08);
  },
  fireBurst() {
    if (!enabled) return;
    noiseBurst(0, 0.35, 0.14);
    tone(120, 0, 0.3, "sawtooth", 0.06);
  },
  witchReveal() {
    if (!enabled) return;
    [523.25, 622.25, 783.99].forEach((f, i) => tone(f, i * 0.06, 0.5, "sine", 0.08));
  },
  fanfare() {
    if (!enabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.5, "triangle", 0.12));
  },
  reveal() {
    if (!enabled) return;
    tone(440, 0, 0.25, "sine", 0.1);
    tone(880, 0.05, 0.2, "sine", 0.05);
  },
};
