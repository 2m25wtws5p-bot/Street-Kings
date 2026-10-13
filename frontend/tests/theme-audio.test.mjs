import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { CHAT_SOUNDS } from '../src/game/chat.js';
import { de as animalDe, en as animalEn } from '../src/i18n/messages/animalCrews.js';

const source = (await readFile(new URL('../src/game/sound.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
const chatIds = CHAT_SOUNDS.map(sound => sound.id);
function audioHarness({ suspended = false, refused = false, automaticEnd = true, browser = true } = {}) {
  const nodes = [], voices = [], gains = [], contexts = [];
  class Param {
    constructor() { this.events = []; }
    setValueAtTime(value, at) { assert.ok(Number.isFinite(value)); this.events.push(['set', value, at]); }
    linearRampToValueAtTime(value, at) { assert.ok(Number.isFinite(value)); this.events.push(['linear', value, at]); }
    exponentialRampToValueAtTime(value, at) { assert.ok(value > 0 && Number.isFinite(value)); this.events.push(['exponential', value, at]); }
    cancelScheduledValues(at) { this.events.push(['cancel', at]); }
    setTargetAtTime(value, at, duration) { this.events.push(['target', value, at, duration]); }
  }
  class Node {
    constructor(kind) {
      this.kind = kind; this.disconnects = 0; this.stops = []; nodes.push(this);
      for (const key of ['gain', 'frequency', 'detune', 'playbackRate', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param();
    }
    connect() {}
    disconnect() { this.disconnects++; }
    start(at) { assert.ok(at >= 0); this.startAt = at; voices.push(this); }
    stop(at) { assert.ok(at > 0); this.stops.push(at); if (automaticEnd) this.onended?.(); }
  }
  class AudioContext {
    constructor() { this.currentTime = 1; this.sampleRate = 48000; this.state = 'suspended'; this.destination = {}; contexts.push(this); }
    resume() { if (!suspended) this.state = 'running'; return Promise.resolve(); }
    createGain() { const node = new Node('gain'); gains.push(node); return node; }
    createDynamicsCompressor() { return new Node('limiter'); }
    createOscillator() { if (refused) throw new Error('Audio restricted'); return new Node('oscillator'); }
    createBiquadFilter() { return new Node('filter'); }
    createBufferSource() { return new Node('buffer'); }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  const deterministicMath = Object.create(Math); deterministicMath.random = () => .5;
  const sandbox = { ...(browser ? { window: { AudioContext } } : {}), process: { env: {} }, Math: deterministicMath };
  vm.runInNewContext(`${source}; globalThis.api = { sfx, setSoundTheme, getSoundTheme, setSoundEnabled, isSoundEnabled, unlockSound, installSoundUnlock };`, sandbox);
  const capture = callback => {
    const start = voices.length; callback();
    return voices.slice(start).map(node => ({ kind: node.kind, type: node.type,
      start: node.startAt, stop: node.stops[0], frequency: node.frequency.events }));
  };
  return { ...sandbox.api, nodes, voices, gains, contexts, capture };
}

for (const theme of ['animal', 'space']) {
  test(`${theme}: every game cue and twelve chat cues use short, original gentle tones`, () => {
    const audio = audioHarness(); audio.setSoundTheme(theme);
    for (const [name, cue] of Object.entries(audio.sfx)) {
      if (name === 'chatSound') continue;
      const voices = audio.capture(() => cue({ special: true }));
      assert.ok(voices.length, `${theme}/${name} produces a cue`);
      assert.ok(voices.every(voice => voice.kind === 'oscillator' && ['sine', 'triangle'].includes(voice.type)), 'No siren, harsh noise or sample playback');
      assert.ok(Math.max(...voices.map(voice => voice.stop)) - Math.min(...voices.map(voice => voice.start)) < 1.5, 'No loops or long background playback');
    }
    const signatures = chatIds.map(id => {
      const voices = audio.capture(() => audio.sfx.chatSound(id));
      assert.ok(voices.length, `${theme}/${id} produces a cue`);
      assert.ok(voices.every(voice => ['sine', 'triangle'].includes(voice.type)));
      assert.ok(Math.max(...voices.map(voice => voice.stop)) - Math.min(...voices.map(voice => voice.start)) < 1.5);
      return JSON.stringify(voices);
    });
    assert.equal(new Set(signatures).size, 12, 'All twelve chat buttons have distinct sounds');
    assert.ok(audio.nodes.filter(node => ['oscillator', 'filter'].includes(node.kind)).every(node => node.disconnects > 0), 'Every transient audio graph is disconnected');
    assert.ok(audio.gains.slice(1).every(node => node.gain.events.filter(event => event[0] === 'linear').every(event => event[1] <= .075)), 'Themed notes use a gentle gain ceiling');
  });

  test(`${theme}: mute, unlock, card deduplication and untrusted IDs retain their behavior`, () => {
    const audio = audioHarness(); audio.setSoundTheme(theme);
    assert.ok(audio.capture(() => audio.sfx.playCard({ special: true }, 'card-one')).length > 0);
    assert.equal(audio.capture(() => audio.sfx.playCard({ special: true }, 'card-one')).length, 0);
    const before = audio.voices.length;
    for (const id of ['', '__proto__', 'constructor', 'https://example.com/sound.mp3', '<audio>', null, {}]) audio.sfx.chatSound(id);
    assert.equal(audio.voices.length, before);
    audio.setSoundEnabled(false);
    for (const cue of Object.values(audio.sfx)) cue();
    for (const id of chatIds) audio.sfx.chatSound(id);
    audio.unlockSound();
    assert.equal(audio.voices.length, before);
    audio.setSoundTheme(theme === 'animal' ? 'space' : 'animal');
    assert.equal(audio.isSoundEnabled(), false, 'Changing rooms never unmutes audio');
    audio.setSoundEnabled(true);
    const unlocked = audio.capture(() => audio.unlockSound());
    assert.equal(unlocked.length, 1); assert.equal(unlocked[0].kind, 'buffer');
  });

  test(`${theme}: suspended and refused audio never queues sounds or interrupts a turn`, () => {
    const blocked = audioHarness({ suspended: true }); blocked.setSoundTheme(theme);
    for (let poll = 0; poll < 20; poll++) {
      blocked.sfx.playCard(); blocked.sfx.turnReminder();
      for (const id of chatIds) blocked.sfx.chatSound(id);
    }
    assert.equal(blocked.voices.length, 0);
    blocked.unlockSound(); assert.equal(blocked.voices.length, 1);
    for (const audio of [audioHarness({ refused: true }), audioHarness({ browser: false })]) {
      audio.setSoundTheme(theme);
      for (const cue of Object.values(audio.sfx)) assert.doesNotThrow(() => cue());
      for (const id of chatIds) assert.doesNotThrow(() => audio.sfx.chatSound(id));
    }
  });
}

test('all three worlds have distinct cues and returning to Street restores its original siren and rhythms', () => {
  const audio = audioHarness();
  const streetReminder = audio.capture(() => audio.sfx.turnReminder());
  const streetChat = chatIds.map(id => JSON.stringify(audio.capture(() => audio.sfx.chatSound(id))));
  assert.equal(streetReminder.length, 1); assert.equal(streetReminder[0].type, 'sawtooth');
  const worldChat = [streetChat];
  for (const theme of ['animal', 'space']) {
    audio.setSoundTheme(theme);
    worldChat.push(chatIds.map(id => JSON.stringify(audio.capture(() => audio.sfx.chatSound(id)))));
    assert.notEqual(JSON.stringify(audio.capture(() => audio.sfx.turnReminder())), JSON.stringify(streetReminder));
  }
  for (let index = 0; index < chatIds.length; index++) assert.equal(new Set(worldChat.map(world => world[index])).size, 3, `${chatIds[index]} differs in every world`);
  audio.setSoundTheme('street');
  assert.deepEqual(audio.capture(() => audio.sfx.turnReminder()), streetReminder);
  assert.deepEqual(chatIds.map(id => JSON.stringify(audio.capture(() => audio.sfx.chatSound(id)))), streetChat);
  audio.setSoundTheme('__proto__'); assert.equal(audio.getSoundTheme(), 'street');
});

test('leaving a theme cancels its delayed notes without resetting card deduplication', () => {
  const audio = audioHarness({ automaticEnd: false });
  audio.setSoundTheme('animal'); audio.sfx.fanfare();
  const playing = [...audio.voices]; assert.ok(playing.some(voice => voice.startAt > 1.5));
  audio.setSoundTheme('street');
  assert.ok(playing.every(voice => voice.stops.length === 2 && voice.stops[1] === 1.035), 'Even not-yet-started notes are stopped promptly');
  audio.sfx.playCard({ special: true }, 'same-card');
  audio.setSoundTheme('space');
  assert.equal(audio.capture(() => audio.sfx.playCard({ special: true }, 'same-card')).length, 0);
});

test('animal chat labels match its animal and nature sounds, in both languages', () => {
  for (const messages of [animalDe, animalEn]) {
    for (const id of chatIds) {
      assert.equal(typeof messages[`chat.sound.${id}`], 'string');
      assert.ok(messages[`chat.soundShort.${id}`].length <= 8);
      assert.doesNotMatch(messages[`chat.sound.${id}`], /police|sirene|scratch|airhorn|snare|vinyl|bass.drop|hi.hat|kick.beat/i);
    }
  }
});
