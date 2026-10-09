const assert = require('node:assert/strict');
let voices = 0, disconnects = 0;
const targets = [];
const sweeps = [];
const starts = [], stops = [];
class Param {
  setValueAtTime(value) { assert(Number.isFinite(value)); }
  linearRampToValueAtTime(value) { assert(Number.isFinite(value)); sweeps.push(value); }
  exponentialRampToValueAtTime(value) { assert(value > 0 && Number.isFinite(value)); }
  cancelScheduledValues() {}
  setTargetAtTime(value) { targets.push(value); }
}
class Node {
  constructor() { for (const key of ['gain','frequency','detune','playbackRate','Q','threshold','knee','ratio','attack','release']) this[key] = new Param(); }
  connect() {}
  disconnect() { disconnects++; }
  start(at) { assert(at >= 0); starts.push(at); voices++; }
  stop(at) { assert(at > 0); stops.push(at); this.onended?.(); }
}
class AudioContext {
  constructor() { this.currentTime = 1; this.sampleRate = 48000; this.state = 'suspended'; this.destination = {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createOscillator() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return new Node(); }
  createBuffer(channels, length) { return {getChannelData:()=>new Float32Array(length)}; }
}
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: { AudioContext }, process: { env: {} } };
const source = fs.readFileSync(path.join(__dirname, '../src/game/sound.js'), 'utf8').replace(/^export /gm, '');
vm.runInNewContext(source + '\n;globalThis.audioApi = { sfx, setSoundEnabled, isSoundEnabled, unlockSound, installSoundUnlock };', sandbox);
const { sfx, setSoundEnabled, isSoundEnabled, unlockSound, installSoundUnlock } = sandbox.audioApi;
for (const cue of Object.keys(sfx)) sfx[cue]();
assert(voices > 20);
assert(disconnects >= voices * 2, 'Transient audio nodes must be disconnected');
let before = voices;
sfx.playCard({special:true}, 'one-card');
assert.equal(voices - before, 4);
before = voices;
sfx.playCard({special:true}, 'one-card');
assert.equal(voices, before, 'Polling/rerenders must not replay the same card cue');
before = voices;
const reminderStart = starts.length, reminderStop = stops.length;
sfx.turnReminder();
assert.equal(voices - before, 1, 'Turn reminder uses one bounded siren voice');
assert(Math.max(...stops.slice(reminderStop)) - Math.min(...starts.slice(reminderStart)) <= 1.5, 'Siren must stop promptly');
assert.deepEqual(sweeps.filter(value => value >= 680).slice(-8), [1380,680,1420,680,1420,680,1420,680], 'Police siren has a slow wail followed by quick yelps');
for (const sound of ['siren', 'scratch', 'airhorn']) {
  before = voices;
  const firstStart = starts.length, firstStop = stops.length;
  sfx.chatSound(sound);
  assert(voices > before, `${sound} produces an original local cue`);
  assert(Math.max(...stops.slice(firstStop)) - Math.min(...starts.slice(firstStart)) <= 1.5, 'Chat cues are bounded');
}
before = voices;
for (const invalid of ['', 'https://example.com/audio.mp3', '<audio>', 'constructor', null]) sfx.chatSound(invalid);
assert.equal(voices, before, 'Unknown sound IDs never produce audio');
before = voices;
unlockSound();
assert.equal(voices - before, 1, 'iOS unlock starts a silent buffer in the gesture');
const listeners = new Map();
const target = {addEventListener:(event, fn) => listeners.set(event, fn), removeEventListener:(event) => listeners.delete(event)};
const cleanup = installSoundUnlock(target);
assert.deepEqual([...listeners.keys()], ['pointerdown','touchend','keydown']);
listeners.get('touchend')();
cleanup();
assert.equal(listeners.size, 0, 'Gesture listeners are cleaned up');
before = voices;
setSoundEnabled(false);
assert.equal(isSoundEnabled(), false);
for (const cue of Object.keys(sfx)) sfx[cue]();
sfx.chatSound('siren'); sfx.chatSound('scratch'); sfx.chatSound('airhorn');
assert.equal(voices, before);
assert.equal(targets.at(-1), 0);
setSoundEnabled(true);
assert.equal(isSoundEnabled(), true);
assert(targets.at(-1) > 0 && targets.at(-1) <= .8);
delete sandbox.window;
sfx.playCard();
sfx.turnReminder();
assert.equal(voices, before, 'No browser audio means silent reminders');
for (const window of [
  {},
  { AudioContext: class { constructor() { throw new Error('Audio unavailable'); } } },
  { AudioContext: class extends AudioContext { createOscillator() { throw new Error('Audio restricted'); } } },
]) {
  const restricted = { window, process: { env: {} } };
  vm.runInNewContext(source + '\n;globalThis.audioApi = { sfx };', restricted);
  assert.doesNotThrow(() => restricted.audioApi.sfx.turnReminder(), 'Refused audio must not interrupt visual reminders');
}
const blocked = { window: { AudioContext: class extends AudioContext { resume() { return Promise.resolve(); } } }, process: { env: {} } };
vm.runInNewContext(source + '\n;globalThis.audioApi = { sfx, unlockSound };', blocked);
before = voices;
for (let poll = 0; poll < 20; poll++) { blocked.audioApi.sfx.playCard(); blocked.audioApi.sfx.turnReminder(); }
assert.equal(voices, before, 'Suspended audio must never accumulate a polling/reminder backlog');
blocked.audioApi.unlockSound();
assert.equal(voices, before + 1, 'Only a silent gesture-unlock source may start on a suspended context');
console.log('PASS: street cues, police siren, gesture/iOS unlock, cleanup, mute and refused audio');
