import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { CHAT_SOUNDS, isChatSound } from '../src/game/chat.js';
import { de, en } from '../src/i18n/messages/soundPalette.js';

test('twelve original chat cues have unique IDs, compact labels and a matching server allowlist', async () => {
  assert.equal(CHAT_SOUNDS.length, 12);
  const ids = CHAT_SOUNDS.map(sound => sound.id);
  assert.equal(new Set(ids).size, 12);
  const server = await readFile(new URL('../../backend/server.py', import.meta.url), 'utf8');
  const configured = server.match(/CHAT_SOUND_IDS = frozenset\(\(([\s\S]*?)\)\)/)[1];
  const serverIds = [...configured.matchAll(/"([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(serverIds.sort(), [...ids].sort());
  for (const sound of CHAT_SOUNDS) {
    assert.equal(isChatSound(sound.id), true);
    assert.equal(typeof sound.icon, 'string');
    for (const language of [de, en]) {
      const label = language[`chat.soundShort.${sound.id}`];
      assert.equal(typeof label, 'string');
      assert.ok(label.length <= 8, `${sound.id} has a compact localized label`);
    }
  }
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
});

const source = (await readFile(new URL('../src/game/useChatSounds.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace(/export function /g, 'function ');
const freshChatSounds = vm.runInNewContext(`${source}; freshChatSounds`, { isChatSound, Date });
const message = (id, sound = 'siren', createdAt = 10000) => ({ id, sound, createdAt });

test('remote sounds are local allowlisted, recent, once-only messages', () => {
  const seen = new Set();
  const input = [message('one'), message('one'), message('two', 'scratch'), message('url', 'https://example.com/no.mp3'), message('old', 'airhorn', 100), message('future', 'siren', 12000), message('bad', 'siren', '10000'), {}];
  assert.deepEqual(Array.from(freshChatSounds(input, seen, 11000), value => value.id), ['one', 'two']);
  assert.equal(freshChatSounds(input, seen, 11000).length, 0);
  assert.equal(freshChatSounds([message('boundary', 'siren', 4000)], new Set(), 11000).length, 0);
});

test('remote sound memory remains bounded across long chat sessions', () => {
  const seen = new Set();
  freshChatSounds(Array.from({ length: 150 }, (_, id) => message(String(id))), seen, 11000);
  assert.equal(seen.size, 100);
  assert.equal(seen.has('0'), false);
  assert.equal(seen.has('149'), true);
});

test('every supported cue can be received without admitting remote assets', () => {
  const input = CHAT_SOUNDS.map(sound => message(sound.id, sound.id));
  assert.deepEqual(Array.from(freshChatSounds(input, new Set(), 11000), value => value.sound), CHAT_SOUNDS.map(sound => sound.id));
  for (const id of ['__proto__', 'constructor', 'https://example.test/audio.mp3', 'data:audio/wav,abc', '', null]) {
    assert.equal(isChatSound(id), false);
  }
});
