const assert = require('node:assert/strict');
let voices = 0, disconnects = 0;
const targets = [];
const starts = [], stops = [];
class Param {
  setValueAtTime(value) { assert(Number.isFinite(value)); }
  linearRampToValueAtTime(value) { assert(Number.isFinite(value)); }
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
vm.runInNewContext(source + '\n;globalThis.audioApi = { sfx, setSoundEnabled, isSoundEnabled };', sandbox);
const { sfx, setSoundEnabled, isSoundEnabled } = sandbox.audioApi;
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
assert.equal(voices - before, 2, 'Turn reminder is a soft two-note cue');
assert(Math.max(...stops.slice(reminderStop)) - Math.min(...starts.slice(reminderStart)) <= .5, 'Turn reminder must be brief');
before = voices;
setSoundEnabled(false);
assert.equal(isSoundEnabled(), false);
for (const cue of Object.keys(sfx)) sfx[cue]();
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
console.log('PASS: all street cues, brief turn reminder, node cleanup, mute/unmute, refused audio and card-cue deduplication');
