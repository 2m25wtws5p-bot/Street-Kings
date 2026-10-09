import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { isChatSound } from '../src/game/chat.js';

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
