const assert = require('node:assert/strict');
let voices = 0, disconnects = 0;
const targets = [];
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
  start(at) { assert(at >= 0); voices++; }
  stop(at) { assert(at > 0); this.onended?.(); }
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
console.log('PASS: all street cues, bounded envelopes, node cleanup, mute/unmute and card-cue deduplication');
