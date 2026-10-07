import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The CRA source uses ES modules, without requiring a package-wide Node module change.
const source = await readFile(new URL("../src/game/constants.js", import.meta.url), "utf8");
const { AVATARS, BOT_NAMES, randomAvatarIndex, randomBotName } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("portrait expansion keeps legacy identities stable and all keys distinct", () => {
  assert.equal(AVATARS.length, 18);
  assert.deepEqual(AVATARS.slice(0, 6).map(avatar => avatar.key), ["boss", "dealer", "driver", "smuggler", "hacker", "lawyer"]);
  assert.equal(new Set(AVATARS.map(avatar => avatar.key)).size, AVATARS.length);
});

test("every portrait click can reach any other portrait without repeating the current one", () => {
  for (let current = 0; current < AVATARS.length; current += 1) {
    const reachable = new Set();
    for (let index = 0; index < AVATARS.length - 1; index += 1) {
      const choice = randomAvatarIndex(current, () => index / (AVATARS.length - 1));
      assert.ok(Number.isInteger(choice) && choice >= 0 && choice < AVATARS.length);
      assert.notEqual(choice, current);
      reachable.add(choice);
    }
    assert.equal(reachable.size, AVATARS.length - 1);
    assert.notEqual(randomAvatarIndex(current, () => 1), current);
  }
});

test("street nickname pool is varied, distinct and fits the name inputs", () => {
  assert.ok(BOT_NAMES.length >= 30);
  assert.equal(new Set(BOT_NAMES.map(name => name.toLowerCase())).size, BOT_NAMES.length);
  assert.ok(BOT_NAMES.every(name => name.length > 0 && name.length <= 16));
  const reachable = new Set(BOT_NAMES.map((_, index) => randomBotName([], () => index / BOT_NAMES.length)));
  assert.equal(reachable.size, BOT_NAMES.length);
  assert.equal(randomBotName([], () => 1), BOT_NAMES.at(-1));
});

test("generated names exclude current player names regardless of case or surrounding spaces", () => {
  const allowed = BOT_NAMES.at(-1);
  const used = BOT_NAMES.slice(0, -1).map(name => `  ${name.toUpperCase()}  `);
  for (const value of [0, 0.25, 0.5, 0.99, 1]) {
    assert.equal(randomBotName(used, () => value), allowed);
  }
});

test("six generated defaults never duplicate each other or a custom player name", () => {
  const used = ["  BROOKLYN ACE  ", "Harlem Slim"];
  const chosen = [];
  for (let index = 0; index < 6; index += 1) {
    const name = randomBotName(used, () => 0);
    chosen.push(name);
    used.push(name);
  }
  assert.equal(new Set(chosen).size, 6);
  assert.ok(!chosen.includes("Brooklyn Ace") && !chosen.includes("Harlem Slim"));
});

test("an exhausted nickname pool still returns a usable known nickname", () => {
  assert.ok(BOT_NAMES.includes(randomBotName(BOT_NAMES, () => 0.5)));
});
