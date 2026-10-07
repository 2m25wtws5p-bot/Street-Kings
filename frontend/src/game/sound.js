// Original boom-bap cues: no external music samples, downloads or loops.
let ctx = null, master = null, noise = null;
let enabled = true;
let lastCardCue = null;
const configuredVolume = Number(process.env.REACT_APP_SFX_VOLUME);
const volume = Number.isFinite(configuredVolume) && configuredVolume > 0 ? Math.min(configuredVolume, .8) : .48;
const vary = (base, amount = .08) => base * (1 + (Math.random() * 2 - 1) * amount);

function ac() {
  if (!enabled || typeof window === "undefined") return null;
  try {
    if (!ctx || ctx.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 12;
      limiter.ratio.value = 6;
      limiter.attack.value = .003;
      limiter.release.value = .16;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .4), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    // Audio restrictions must never interrupt a turn.
    return null;
  }
}
export function setSoundEnabled(value) {
  enabled = Boolean(value);
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, .015);
  }
}
export function isSoundEnabled() { return enabled; }

function envelope(c, at, duration, gain) {
  const node = c.createGain();
  node.gain.setValueAtTime(.0001, at);
  node.gain.linearRampToValueAtTime(gain, at + .004);
  node.gain.exponentialRampToValueAtTime(.0001, at + duration);
  node.connect(master);
  return node;
}
function bass(delay = 0, gain = .3, duration = .2, frequency = 105) {
  const c = ac();
  if (!c) return;
  const at = c.currentTime + delay;
  const oscillator = c.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(vary(frequency), at);
  oscillator.frequency.exponentialRampToValueAtTime(46, at + duration * .8);
  const amp = envelope(c, at, duration, gain);
  oscillator.connect(amp);
  oscillator.onended = () => { oscillator.disconnect(); amp.disconnect(); };
  oscillator.start(at);
  oscillator.stop(at + duration + .02);
}
function texture(delay, duration, gain, frequency, type = "bandpass") {
  const c = ac();
  if (!c) return;
  const at = c.currentTime + delay;
  const source = c.createBufferSource();
  source.buffer = noise;
  source.playbackRate.value = vary(1, .1);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = vary(frequency, .12);
  filter.Q.value = .65;
  const amp = envelope(c, at, duration, gain);
  source.connect(filter);
  filter.connect(amp);
  source.onended = () => { source.disconnect(); filter.disconnect(); amp.disconnect(); };
  source.start(at, Math.random() * .04);
  source.stop(at + duration + .02);
}
function chord(delay, duration = .32, gain = .025) {
  const c = ac();
  if (!c) return;
  // Warm minor-seventh stab rather than a bright arcade fanfare.
  [130.81, 155.56, 196, 233.08].forEach((frequency) => {
    const at = c.currentTime + delay;
    const oscillator = c.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = (Math.random() * 2 - 1) * 5;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, at);
    filter.frequency.exponentialRampToValueAtTime(450, at + duration);
    const amp = envelope(c, at, duration, gain);
    oscillator.connect(filter);
    filter.connect(amp);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); amp.disconnect(); };
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
  });
}
function reminderTone(delay, frequency) {
  const c = ac();
  if (!c) return;
  const at = c.currentTime + delay;
  const oscillator = c.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, at);
  const amp = envelope(c, at, .14, .075);
  oscillator.connect(amp);
  oscillator.onended = () => { oscillator.disconnect(); amp.disconnect(); };
  oscillator.start(at);
  oscillator.stop(at + .16);
}
const hat = (delay = 0, gain = .07) => texture(delay, .045, gain, 6500, "highpass");
const rim = (delay = 0, gain = .13) => texture(delay, .075, gain, 1500);
export const sfx = {
  playCard(card, cueKey) {
    if (!enabled) return;
    if (cueKey && lastCardCue === cueKey) return;
    if (cueKey) lastCardCue = cueKey;
    texture(0, .09, .09, 2400); // cardboard slide
    bass(.1, card?.special ? .27 : .18, .16, 115); // soft table tap / kick
    rim(.105, .035);
    if (card?.special) hat(.16, .05);
  },
  select() { if (enabled) { hat(0, .035); texture(0, .04, .04, 1200); } },
  winTrick() { if (enabled) { bass(.13, .28); rim(.3, .12); chord(.32); } },
  fireBurst() { if (enabled) { sfx.playCard({ special: true }); chord(.14, .22, .016); } },
  witchReveal() { if (enabled) { texture(0, .16, .08, 1800); chord(.08, .4); } },
  fanfare() {
    if (!enabled) return;
    // Short, swung drum fill, not continuous background music.
    bass(0, .3); hat(.18); rim(.37); bass(.56, .22); hat(.77); rim(.96); chord(.98, .5, .035);
  },
  reveal() { if (enabled) { texture(0, .18, .09, 1400); hat(.12, .045); } },
  turnReminder() {
    if (!enabled) return;
    try {
      // A brief rising chime, spaced ten seconds apart by the turn scheduler.
      reminderTone(0, 660);
      reminderTone(.17, 880);
    } catch {
      // A visual reminder still works when the browser refuses audio.
    }
  },
};
