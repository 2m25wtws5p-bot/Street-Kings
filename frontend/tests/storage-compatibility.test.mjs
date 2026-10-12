import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/game/storage.js", import.meta.url), "utf8");
const moduleUrl = value => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
const actualStorage = await import(moduleUrl(source));
function fingerprint(key) {
  let value = 0xcbf29ce484222325n;
  for (const char of key) value = BigInt.asUintN(64, (value ^ BigInt(char.charCodeAt(0))) * 0x100000001b3n);
  return `${key.length}:${value.toString(16).padStart(16, "0")}`;
}
// Only these test-module constants change. Production recognition never uses
// generic archive names or an import fallback based on data shape alone.
const fixtureSource = source
  .replace(/const LEGACY_STATS_FINGERPRINT = "[^"]+";/, `const LEGACY_STATS_FINGERPRINT = "${fingerprint("test_archive_stats_v1x")}";`)
  .replace(/const LEGACY_ROOM_FINGERPRINT = "[^"]+";/, `const LEGACY_ROOM_FINGERPRINT = "${fingerprint("archive_room")}";`);
const storage = await import(moduleUrl(fixtureSource));

function browserStorage(records = {}) {
  const values = new Map(Object.entries(records));
  return {
    values,
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const archivedStats = { gamesPlayed: 2, roundsPlayed: 5, lowestScore: 4,
  players: { Ace: { games: 2, wins: 1, totalPoints: 17 } } };
const archivedRoom = { code: "ACE42", token: "private-access", spectator: false };

test("older exact statistics migrate to the current namespace without deleting the archive", () => {
  const archived = JSON.stringify(archivedStats);
  globalThis.localStorage = browserStorage({ test_archive_stats_v1x: archived, unrelated: "ignore" });
  const result = storage.loadStats();
  assert.equal(result.players.Ace.totalHeat, 17);
  assert.equal(result.gamesPlayed, 2);
  assert.equal(localStorage.values.get("test_archive_stats_v1x"), archived);
  assert.equal(JSON.parse(localStorage.values.get("street_kings_stats_v2")).players.Ace.totalHeat, 17);
  storage.clearStats();
  assert.equal(storage.loadStats().gamesPlayed, 0, "Cleared statistics do not restore an old archive");
  assert.equal(localStorage.values.get("test_archive_stats_v1x"), archived);
});

test("older exact room access migrates while explicit leave prevents a stale resume", () => {
  const archived = JSON.stringify(archivedRoom);
  globalThis.localStorage = browserStorage({ archive_room: archived });
  assert.deepEqual(storage.loadRoomSession(), archivedRoom);
  assert.equal(localStorage.values.get("archive_room"), archived);
  storage.clearRoomSession();
  assert.equal(storage.loadRoomSession(), null);
  assert.equal(localStorage.values.get("archive_room"), archived);
});

test("foreign namespaces, invalid schemas and invalid private access are never guessed", () => {
  for (const records of [
    { one_room: JSON.stringify(archivedRoom), two_room: JSON.stringify({ ...archivedRoom, code: "OTHER" }) },
    { archive_room: JSON.stringify({ ...archivedRoom, external: true }) },
    { archive_room: JSON.stringify({ ...archivedRoom, token: "" }) },
  ]) {
    globalThis.localStorage = browserStorage(records);
    assert.equal(storage.loadRoomSession(), null);
    assert.equal(localStorage.values.has("street_kings_room_v2"), false);
  }
  globalThis.localStorage = browserStorage({ one_stats_v1: JSON.stringify(archivedStats), two_stats_v1: JSON.stringify(archivedStats) });
  assert.equal(storage.loadStats().gamesPlayed, 0);
  assert.equal(localStorage.values.has("street_kings_stats_v2"), false);
  globalThis.localStorage = browserStorage({ test_archive_stats_v1x: JSON.stringify({ ...archivedStats, external: true }) });
  assert.equal(storage.loadStats().gamesPlayed, 0);
});

test("current records always take precedence over archived candidates", () => {
  globalThis.localStorage = browserStorage({ archive_room: JSON.stringify(archivedRoom), street_kings_room_v2: "null" });
  assert.equal(storage.loadRoomSession(), null);
  globalThis.localStorage = browserStorage({ test_archive_stats_v1x: JSON.stringify(archivedStats), street_kings_stats_v2: "{}" });
  assert.equal(storage.loadStats().gamesPlayed, 0);
});

test("production migration never imports another same-origin app's matching-schema room or statistics", () => {
  const room = JSON.stringify(archivedRoom), stats = JSON.stringify(archivedStats);
  globalThis.localStorage = browserStorage({ archive_room: room, test_archive_stats_v1x: stats,
    another_room: room, other_stats_v1: stats });
  assert.equal(actualStorage.loadRoomSession(), null);
  assert.equal(actualStorage.loadStats().gamesPlayed, 0);
  assert.equal(localStorage.values.has("street_kings_room_v2"), false);
  assert.equal(localStorage.values.has("street_kings_stats_v2"), false);
  assert.equal(localStorage.values.get("archive_room"), room);
  assert.equal(localStorage.values.get("test_archive_stats_v1x"), stats);
});

test("a known namespace still migrates when unrelated exact-shape records exist", () => {
  globalThis.localStorage = browserStorage({ archive_room: JSON.stringify(archivedRoom),
    another_room: JSON.stringify({ ...archivedRoom, code: "OTHER" }),
    test_archive_stats_v1x: JSON.stringify(archivedStats), other_stats_v1: JSON.stringify(archivedStats) });
  assert.deepEqual(storage.loadRoomSession(), archivedRoom);
  assert.equal(storage.loadStats().gamesPlayed, 2);
});
