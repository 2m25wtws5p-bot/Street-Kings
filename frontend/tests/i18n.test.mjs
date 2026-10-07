import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { catalogs, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, createTranslator, getLocale, normalizeLanguage, readLanguage, saveLanguage, translate } from '../src/i18n/core.js';
import { getGameLabels } from '../src/i18n/labels.js';
import { localLanguageSeat } from '../src/i18n/localLanguage.js';
import { SUITS, SPECIALS, AVATARS, SPECIAL_MAP, SUIT_ORDER } from '../src/game/constants.js';
import * as common from '../src/i18n/messages/common.js';
import * as game from '../src/i18n/messages/game.js';
import * as online from '../src/i18n/messages/online.js';
import * as rules from '../src/i18n/messages/rules.js';

const messages = [common, game, online, rules];
const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('German is the explicit default, regardless of browser language', async () => {
  assert.equal(DEFAULT_LANGUAGE, 'de');
  assert.equal(readLanguage(null), 'de');
  const provider = await readFile(new URL('../src/i18n/I18nProvider.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(provider, /navigator\.languages?/);
  assert.match(provider, /readLanguage\(browserStorage\(\)\)/);
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="de">/);
});

test('every registered language has exactly the same complete catalog and placeholders', () => {
  assert.equal(new Set(SUPPORTED_LANGUAGES.map(item => item.code)).size, SUPPORTED_LANGUAGES.length);
  for (const { code, locale, label } of SUPPORTED_LANGUAGES) {
    assert.ok(label && locale);
    assert.doesNotThrow(() => new Intl.NumberFormat(locale));
    assert.deepEqual(Object.keys(catalogs[code]).sort(), Object.keys(catalogs.de).sort(), code);
    for (const [key, deValue] of Object.entries(catalogs.de)) {
      const value = catalogs[code][key];
      assert.equal(typeof value, typeof deValue, key);
      const deForms = typeof deValue === 'string' ? { text: deValue } : deValue;
      const forms = typeof value === 'string' ? { text: value } : value;
      assert.deepEqual(Object.keys(forms).sort(), Object.keys(deForms).sort(), `${code}:${key}`);
      for (const [form, text] of Object.entries(forms)) {
        assert.equal(typeof text, 'string', `${code}:${key}:${form}`);
        assert.ok(text.trim(), `${code}:${key}:${form}`);
        assert.deepEqual(placeholders(text), placeholders(deForms[form]), `${code}:${key}:${form}`);
      }
    }
  }
});

test('message modules have no accidental duplicate keys across namespaces', () => {
  for (const code of ['de', 'en']) {
    const keys = messages.flatMap(module => Object.keys(module[code]));
    assert.equal(new Set(keys).size, keys.length, `${code} catalog merge overwrites a key`);
  }
});

test('every literal UI translation key resolves in all registered languages', async () => {
  async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const groups = await Promise.all(entries.map(entry => {
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      return entry.isDirectory() ? sourceFiles(child) : /\.(?:jsx|js)$/.test(entry.name) ? [child] : [];
    }));
    return groups.flat();
  }
  const files = await sourceFiles(new URL('../src/', import.meta.url));
  let count = 0;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const [, key] of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
      count++;
      for (const { code } of SUPPORTED_LANGUAGES) assert.ok(Object.hasOwn(catalogs[code], key), `${file.pathname}: ${code}:${key}`);
    }
  }
  assert.ok(count > 200, 'Expected the complete UI, not only the home screen');
});

test('portal dialogs and generated spectator labels respect the personal language', async () => {
  const dialog = await readFile(new URL('../src/components/ui/dialog.jsx', import.meta.url), 'utf8');
  assert.match(dialog, /lang=\{language\}/);
  assert.match(dialog, /t\('common\.close'\)/);
  const flow = await readFile(new URL('../src/components/OnlineFlow.jsx', import.meta.url), 'utf8');
  assert.match(flow, /roomApi\.watch\([^\n]+name\.trim\(\) \|\| t\('online\.defaultSpectator'\)/);
  assert.equal(translate('en', 'online.defaultSpectator'), 'Spectator');
  assert.equal(translate('de', 'online.defaultSpectator'), 'Zuschauer');
});

test('personal preferences persist safely without relying on storage permission', () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  assert.equal(saveLanguage(storage, 'en'), 'en');
  assert.equal(stored.get(LANGUAGE_STORAGE_KEY), 'en');
  assert.equal(readLanguage(storage), 'en');
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(readLanguage(denied), 'de');
  assert.equal(saveLanguage(denied, 'en'), 'en');
  assert.equal(saveLanguage(null, 'en'), 'en');
  for (const invalid of [null, undefined, '', 'fr', 'EN', '__proto__', 'constructor', {}, ['en'], 1]) {
    assert.equal(normalizeLanguage(invalid), 'de');
    assert.equal(saveLanguage(storage, invalid), 'de');
  }
});

test('plural forms, interpolation and numbers follow the viewer language', () => {
  assert.equal(translate('de', 'common.cards', { count: 1 }), '1 Karte');
  assert.equal(translate('en', 'common.cards', { count: 1 }), '1 card');
  assert.equal(translate('en', 'common.cards', { count: 0 }), '0 cards');
  assert.equal(translate('en', 'common.cards', { count: 2 }), '2 cards');
  assert.equal(translate('de', 'common.cards', { count: 1234 }), '1.234 Karten');
  assert.equal(translate('en', 'common.cards', { count: 1234 }), '1,234 cards');
  assert.equal(getLocale('en'), 'en-US');
  assert.equal(translate('en', 'game.trickWinner', { name: 'Vitch' }), 'Vitch takes the trick!');
  assert.equal(translate('en', 'game.trickWinner', null), '{name} takes the trick!');
  assert.equal(translate('en', 'game.trickWinner', Object.create({ name: 'not own' })), '{name} takes the trick!');
});

test('unknown or missing messages fall back safely and never expose object prototypes', () => {
  assert.equal(createTranslator('unknown')('common.close'), 'Schließen');
  for (const key of ['missing.key', 'toString', 'constructor', '__proto__']) assert.equal(translate('en', key), key);
  // Controlled temporary test entry verifies the fallback used by incomplete future packs.
  catalogs.de['test.fallback'] = 'Deutsch {name}';
  try { assert.equal(translate('en', 'test.fallback', { name: 'Ace' }), 'Deutsch Ace'); }
  finally { delete catalogs.de['test.fallback']; }
});

test('localized card and portrait labels never mutate mechanical constants or identity names', () => {
  const original = JSON.stringify({ SUITS, SPECIALS, AVATARS, SPECIAL_MAP, SUIT_ORDER });
  for (const code of ['de', 'en']) {
    const { suits, specials, avatars } = getGameLabels(code);
    assert.deepEqual(Object.keys(suits), Object.keys(SUITS));
    for (const key of Object.keys(SUITS)) {
      const { people, realm, ...unchanged } = suits[key];
      const { people: _people, realm: _realm, ...base } = SUITS[key];
      assert.deepEqual(unchanged, base);
      assert.ok(people && realm);
      assert.notEqual(suits[key], SUITS[key]);
    }
    for (const key of Object.keys(SPECIALS)) {
      const { label, short, desc, ...unchanged } = specials[key];
      const { label: _label, short: _short, desc: _desc, ...base } = SPECIALS[key];
      assert.deepEqual(unchanged, base);
      assert.ok(label && short && desc);
    }
    assert.equal(avatars.length, AVATARS.length);
    avatars.forEach((avatar, index) => {
      assert.equal(avatar.key, AVATARS[index].key);
      assert.equal(avatar.color, AVATARS[index].color);
      if (avatar.key.startsWith('street-')) assert.equal(avatar.label, AVATARS[index].label);
    });
  }
  assert.equal(getGameLabels('en').suits.GREEN.people, 'Goods');
  assert.equal(getGameLabels('en').specials.pygmy.label, 'Godmother');
  assert.equal(JSON.stringify({ SUITS, SPECIALS, AVATARS, SPECIAL_MAP, SUIT_ORDER }), original);
});

test('local hot-seat language follows the human viewer without changing turn state', () => {
  const players = [{ isBot: false, language: 'de' }, { isBot: true }, { isBot: false, language: 'en' }];
  const state = { players, phase: 'passing', passSeat: 2, currentSeat: 0 };
  const original = JSON.stringify(state);
  assert.equal(localLanguageSeat(state), 2);
  assert.equal(localLanguageSeat({ ...state, phase: 'passGate', passSeat: 0 }, 2), 0);
  for (const phase of ['playGate', 'playing', 'trickEnd']) {
    assert.equal(localLanguageSeat({ ...state, phase, currentSeat: 2 }, 0), 2);
    assert.equal(localLanguageSeat({ ...state, phase, currentSeat: 1 }, 2), 2);
  }
  assert.equal(localLanguageSeat({ ...state, phase: 'roundEnd' }, 2), 2);
  assert.equal(localLanguageSeat({ players: [{ isBot: true }, { isBot: false }], phase: 'playing', currentSeat: 0 }), 1);
  assert.equal(localLanguageSeat({ players: [{ isBot: true }], phase: 'playing' }), null);
  assert.equal(JSON.stringify(state), original);
});
