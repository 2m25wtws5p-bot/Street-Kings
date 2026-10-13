// Original boom-bap cues: no external music samples, downloads or loops.
let ctx = null, master = null, noise = null;
let enabled = true;
let lastCardCue = null;
let soundTheme = "street";
const themedVoices = new Set();
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
// Presentation only: cue IDs, game timing, mute and browser unlock stay shared.
export function setSoundTheme(theme) {
  const next = theme === "animal" || theme === "space" ? theme : "street";
  if (next !== soundTheme) {
    // Cancel delayed notes when leaving a world, so no old melody bleeds into
    // the next room. This never touches mute, card deduplication or game timers.
    for (const voice of themedVoices) {
      try {
        voice.amp.gain.cancelScheduledValues(ctx.currentTime);
        voice.amp.gain.setTargetAtTime(.0001, ctx.currentTime, .008);
        voice.oscillator.stop(ctx.currentTime + .035);
      } catch { /* A stopped or refused node is already silent. */ }
    }
    themedVoices.clear();
  }
  soundTheme = next;
}
export function getSoundTheme() { return soundTheme; }

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
function tone(delay, duration, gain, from, to = from, type = "triangle") {
  const c = ac();
  if (!c) return;
  const at = c.currentTime + delay;
  const oscillator = c.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  const amp = envelope(c, at, duration, gain);
  oscillator.connect(filter);
  filter.connect(amp);
  oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); amp.disconnect(); };
  oscillator.start(at);
  oscillator.stop(at + duration + .02);
}
const hat = (delay = 0, gain = .07) => texture(delay, .045, gain, 6500, "highpass");
const rim = (delay = 0, gain = .13) => texture(delay, .075, gain, 1500);

// The two additional worlds use quiet, rounded oscillators rather than samples,
// sirens or percussion. Every transient disconnects its complete audio graph.
function gentleNote(delay, duration, from, to = from, gain = .055, type = "sine") {
  const c = ac();
  if (!c) return;
  const at = c.currentTime + delay;
  const oscillator = c.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration * .85);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1900;
  filter.Q.value = .5;
  const amp = c.createGain();
  amp.gain.setValueAtTime(.0001, at);
  amp.gain.linearRampToValueAtTime(gain, at + Math.min(.025, duration * .2));
  amp.gain.exponentialRampToValueAtTime(.0001, at + duration);
  amp.connect(master);
  oscillator.connect(filter);
  filter.connect(amp);
  const voice = { oscillator, amp };
  themedVoices.add(voice);
  oscillator.onended = () => {
    themedVoices.delete(voice);
    oscillator.disconnect(); filter.disconnect(); amp.disconnect();
  };
  oscillator.start(at);
  oscillator.stop(at + duration + .025);
}
function chimes(notes, gap = .12, duration = .22, delay = 0, gain = .045, type = "sine") {
  notes.forEach((frequency, index) => gentleNote(delay + index * gap, duration, frequency, frequency, gain, type));
}
function birdSong(delay = 0) {
  gentleNote(delay, .1, 830, 1190, .045);
  gentleNote(delay + .15, .12, 960, 1320, .04);
  gentleNote(delay + .33, .17, 1175, 880, .035);
}
function bubbles(delay = 0) {
  gentleNote(delay, .12, 310, 610, .06);
  gentleNote(delay + .14, .14, 390, 750, .05);
  gentleNote(delay + .31, .16, 490, 880, .04);
}
function spaceSignal(delay = 0) {
  chimes([392, 587.33, 783.99], .14, .18, delay, .04, "triangle");
}
const animalCues = {
  playCard(card) {
    gentleNote(0, .12, 390, 560, .055, "triangle");
    if (card?.special) chimes([659.25, 880], .13, .18, .1, .035);
  },
  select() { gentleNote(0, .12, 620, 760, .035); },
  winTrick() { chimes([523.25, 659.25, 783.99], .16, .25, 0, .05); },
  fireBurst() { birdSong(); chimes([659.25, 880], .16, .25, .37, .035); },
  takeoverReveal() { chimes([392, 523.25, 659.25, 783.99], .17, .28, 0, .05, "triangle"); },
  fanfare() { chimes([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5], .16, .3, 0, .05); },
  reveal() { bubbles(); },
  turnReminder() { birdSong(); chimes([659.25, 783.99], .17, .23, .58, .04); },
  chat: {
    siren() { birdSong(); },
    scratch() { chimes([329.63, 440, 523.25], .18, .13, 0, .065, "triangle"); },
    airhorn() { gentleNote(0, .29, 350, 270, .065); gentleNote(.35, .32, 380, 290, .055); },
    kick() { gentleNote(0, .14, 260, 350, .075); gentleNote(.23, .16, 290, 380, .065); },
    snare() { chimes([220, 246.94, 220, 261.63], .11, .23, 0, .04, "triangle"); },
    hihat() { gentleNote(0, .08, 1050, 1400, .03); gentleNote(.12, .1, 1180, 1510, .025); },
    clap() { bubbles(); },
    bassdrop() { gentleNote(0, .52, 196, 146.83, .07); chimes([293.66], .1, .3, .48, .03); },
    rimshot() { gentleNote(0, .18, 280, 450, .055); gentleNote(.27, .2, 330, 520, .05); },
    cowbell() { chimes([880, 659.25, 783.99, 1046.5], .16, .27, 0, .035); },
    vinyl() { gentleNote(0, .38, 293.66, 329.63, .035, "triangle"); gentleNote(.2, .43, 392, 349.23, .025); },
    radio() { chimes([587.33, 493.88, 659.25, 523.25, 783.99], .105, .19, 0, .03); },
  },
};
const spaceCues = {
  playCard(card) {
    gentleNote(0, .16, 260, 520, .045, "triangle");
    gentleNote(.07, .15, 780, 650, .025);
    if (card?.special) spaceSignal(.18);
  },
  select() { gentleNote(0, .09, 740, 880, .03, "triangle"); gentleNote(.07, .11, 1100, 990, .02); },
  winTrick() { spaceSignal(); gentleNote(.38, .34, 196, 293.66, .045); },
  fireBurst() { gentleNote(0, .42, 170, 760, .05); chimes([880, 1174.66], .13, .2, .3, .025); },
  takeoverReveal() { gentleNote(0, .65, 130.81, 523.25, .045, "triangle"); spaceSignal(.4); },
  fanfare() { chimes([261.63, 392, 523.25, 659.25, 783.99], .19, .34, 0, .045, "triangle"); chimes([1046.5, 1318.51], .16, .24, .85, .025); },
  reveal() { gentleNote(0, .3, 220, 880, .035); gentleNote(.2, .24, 660, 330, .025); },
  turnReminder() { spaceSignal(); spaceSignal(.62); },
  chat: {
    siren() { chimes([440, 880, 440], .21, .25, 0, .035); },
    scratch() { gentleNote(0, .36, 180, 1080, .04, "triangle"); gentleNote(.3, .28, 980, 250, .03); },
    airhorn() { chimes([261.63, 329.63, 392], 0, .47, 0, .025, "triangle"); chimes([523.25], .1, .22, .46, .025); },
    kick() { gentleNote(0, .21, 150, 310, .065); gentleNote(.32, .25, 190, 380, .05, "triangle"); },
    snare() { chimes([660, 990, 660, 1320], .095, .09, 0, .025, "triangle"); },
    hihat() { chimes([1200, 1000, 1400], .17, .13, 0, .025); },
    clap() { gentleNote(0, .15, 390, 260, .05, "triangle"); chimes([587.33, 783.99], .18, .2, .19, .035); },
    bassdrop() { gentleNote(0, .58, 440, 110, .05, "triangle"); gentleNote(.14, .48, 880, 220, .025); },
    rimshot() { spaceSignal(); },
    cowbell() { chimes([698.46, 1046.5, 1396.91, 1046.5], .14, .24, 0, .025, "triangle"); },
    vinyl() { gentleNote(0, .48, 246.94, 740.82, .035); gentleNote(.13, .55, 369.99, 1109.98, .025, "triangle"); },
    radio() { chimes([880, 660], .1, .09, 0, .03, "triangle"); chimes([440, 660, 880], .14, .16, .26, .03); },
  },
};
function playThemed(event, detail) {
  if (soundTheme === "street") return false;
  if (!enabled) return true;
  try {
    const cues = soundTheme === "animal" ? animalCues : spaceCues;
    if (event === "chatSound") {
      if (typeof detail === "string" && Object.prototype.hasOwnProperty.call(cues.chat, detail)) cues.chat[detail]();
    } else cues[event]?.(detail);
  } catch { /* The visual game must work even if a browser refuses audio. */ }
  return true;
}
export const sfx = {
  playCard(card, cueKey) {
    if (!enabled) return;
    if (cueKey && lastCardCue === cueKey) return;
    if (cueKey) lastCardCue = cueKey;
    if (playThemed("playCard", card)) return;
    texture(0, .09, .09, 2400); // cardboard slide
    bass(.1, card?.special ? .27 : .18, .16, 115); // soft table tap / kick
    rim(.105, .035);
    if (card?.special) hat(.16, .05);
  },
  select() { if (playThemed("select")) return; if (enabled) { hat(0, .035); texture(0, .04, .04, 1200); } },
  winTrick() { if (playThemed("winTrick")) return; if (enabled) { bass(.13, .28); rim(.3, .12); chord(.32); } },
  fireBurst() { if (playThemed("fireBurst")) return; if (enabled) { sfx.playCard({ special: true }); chord(.14, .22, .016); } },
  takeoverReveal() { if (playThemed("takeoverReveal")) return; if (enabled) { texture(0, .16, .08, 1800); chord(.08, .4); } },
  fanfare() {
    if (!enabled) return;
    if (playThemed("fanfare")) return;
    // Short, swung drum fill, not continuous background music.
    bass(0, .3); hat(.18); rim(.37); bass(.56, .22); hat(.77); rim(.96); chord(.98, .5, .035);
  },
  reveal() { if (playThemed("reveal")) return; if (enabled) { texture(0, .18, .09, 1400); hat(.12, .045); } },
  turnReminder() {
    if (!enabled) return;
    if (playThemed("turnReminder")) return;
    try {
      // Spaced ten seconds apart by the existing turn scheduler.
      policeSiren();
    } catch {
      // A visual reminder still works when the browser refuses audio.
    }
  },
  chatSound(id) {
    if (!enabled) return;
    if (playThemed("chatSound", id)) return;
    try {
      switch (id) {
        case "siren": policeSiren(); break;
        case "scratch":
          texture(0, .12, .12, 600); texture(.11, .12, .1, 1500); texture(.22, .14, .09, 450);
          break;
        case "airhorn": airHorn(); break;
        case "kick":
          bass(0, .3, .18, 120); bass(.24, .25, .21, 95);
          break;
        case "snare":
          texture(0, .16, .11, 2200); rim(.16, .08); texture(.29, .18, .1, 2400);
          break;
        case "hihat":
          [0, .12, .24, .41].forEach(delay => hat(delay, .065));
          break;
        case "clap":
          [0, .025, .05].forEach(delay => texture(delay, .11, .065, 1200));
          texture(.27, .14, .08, 1200);
          break;
        case "bassdrop":
          tone(0, .65, .15, 180, 38, "sine");
          texture(0, .12, .04, 750);
          break;
        case "rimshot":
          tone(0, .075, .055, 480, 430, "triangle");
          tone(.13, .07, .045, 650, 590, "triangle");
          rim(.13, .04);
          break;
        case "cowbell":
          [0, .29].forEach(delay => {
            tone(delay, .16, .024, 740, 740, "square");
            tone(delay, .13, .018, 1110, 1110, "square");
          });
          break;
        case "vinyl":
          // A falling record-stop squeak with soft crackle, not a music sample.
          tone(0, .52, .055, 900, 70, "sawtooth");
          texture(0, .18, .025, 1800); texture(.25, .15, .02, 650);
          break;
        case "radio":
          // Short radio squelch and two bleeps; no speech or real recordings.
          texture(0, .12, .045, 1700);
          tone(.12, .085, .045, 1150, 1150, "sine");
          tone(.25, .085, .035, 850, 850, "sine");
          texture(.35, .12, .035, 1700);
          break;
        default: break;
      }
    } catch { /* Sound messages must never interrupt a turn. */ }
  },
};
