// Original boom-bap cues: no external music samples, downloads or loops.
let ctx = null, master = null, noise = null;
let enabled = true;
let lastCardCue = null;
const configuredVolume = Number(process.env.REACT_APP_SFX_VOLUME);
const volume = Number.isFinite(configuredVolume) && configuredVolume > 0 ? Math.min(configuredVolume, .8) : .48;
const vary = (base, amount = .08) => base * (1 + (Math.random() * 2 - 1) * amount);

function ac(allowSuspended = false) {
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
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    // Don't queue timer/polling cues on a frozen context after page recovery.
    // Otherwise they all play together when the first real gesture resumes it.
    return ctx.state === "running" || allowSuspended ? ctx : null;
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

// iOS requires resume and a started source synchronously in a user gesture.
export function unlockSound() {
  const c = ac(true);
  if (!c) return;
  try {
    const source = c.createBufferSource();
    source.buffer = c.createBuffer(1, 1, c.sampleRate);
    source.connect(master);
    source.onended = () => source.disconnect();
    source.start(c.currentTime);
    source.stop(c.currentTime + .005);
  } catch { /* Refused audio must not affect gameplay. */ }
}
export function installSoundUnlock(target = typeof document === "undefined" ? null : document) {
  if (!target) return () => {};
  const unlock = () => unlockSound();
  // Safari can suspend audio again after a background switch.
  const events = ["pointerdown", "touchend", "keydown"];
  events.forEach(event => target.addEventListener(event, unlock, { capture: true, passive: true }));
  return () => events.forEach(event => target.removeEventListener(event, unlock, true));
}

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
function policeSiren() {
  const c = ac();
  if (!c) return;
  const at = c.currentTime;
  const oscillator = c.createOscillator();
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(680, at);
  // A recognizable police wail followed by faster yelps. Filtering keeps the
  // original synthesized harmonics gentle, with no samples or background loop.
  [[.28, 1380], [.56, 680], [.67, 1420], [.78, 680], [.89, 1420],
    [1, 680], [1.11, 1420], [1.22, 680]].forEach(([delay, frequency]) => {
    oscillator.frequency.linearRampToValueAtTime(frequency, at + delay);
  });
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  filter.Q.value = .5;
  const amp = c.createGain();
  amp.gain.setValueAtTime(.0001, at);
  amp.gain.linearRampToValueAtTime(.075, at + .025);
  amp.gain.setValueAtTime(.075, at + 1.1);
  amp.gain.exponentialRampToValueAtTime(.0001, at + 1.28);
  amp.connect(master);
  oscillator.connect(filter);
  filter.connect(amp);
  oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); amp.disconnect(); };
  oscillator.start(at);
  oscillator.stop(at + 1.3);
}
function airHorn() {
  const c = ac();
  if (!c) return;
  [220, 277.18, 329.63].forEach(frequency => {
    const oscillator = c.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = frequency;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1250;
    const amp = envelope(c, c.currentTime, .45, .023);
    oscillator.connect(filter);
    filter.connect(amp);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); amp.disconnect(); };
    oscillator.start(c.currentTime);
    oscillator.stop(c.currentTime + .47);
  });
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
      // Spaced ten seconds apart by the existing turn scheduler.
      policeSiren();
    } catch {
      // A visual reminder still works when the browser refuses audio.
    }
  },
  chatSound(id) {
    if (!enabled) return;
    try {
      switch (id) {
        case "siren": policeSiren(); break;
        case "scratch":
          texture(0, .12, .12, 600); texture(.11, .12, .1, 1500); texture(.22, .14, .09, 450);
          break;
        case "airhorn": airHorn(); break;
        default: break;
      }
    } catch { /* Sound messages must never interrupt a turn. */ }
  },
};
