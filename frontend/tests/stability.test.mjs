import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const storage = await import(moduleUrl(await source("game/storage.js")));
const constantsUrl = moduleUrl(await source("game/constants.js"));
const engineUrl = moduleUrl((await source("game/engine.js")).replace('from "./constants"', `from "${constantsUrl}"`));
const exchangeUrl = moduleUrl(await source("game/exchangeHistory.js"));
const reducerSource = (await source("game/useGame.js"))
  .replace('import { useReducer, useCallback } from "react";', "const useReducer = () => {}; const useCallback = () => {};")
  .replace('from "./engine"', `from "${engineUrl}"`)
  .replace('from "./exchangeHistory"', `from "${exchangeUrl}"`);
const { reducer } = await import(moduleUrl(`${reducerSource}\nexport { reducer };`));
const { botPass, botPlay } = await import(engineUrl);
const apiSource = (await source("game/api.js")).replace('import axios from "axios";', 'const axios={create:()=>({interceptors:{request:{use(){}}}})};');
const { validateRoomView, validateRoomSession, normalizeRecentGames } = await import(moduleUrl(apiSource));
const flowSource = await source("components/OnlineFlow.jsx");
const urlFunction = flowSource.slice(flowSource.indexOf("function setUrlRoom"), flowSource.indexOf("export function OnlineFlow"));
const { setUrlRoom } = await import(moduleUrl(`${urlFunction}\nexport { setUrlRoom };`));
const appSource = await source("App.js");

// Exercise the actual self-contained JSX callbacks without introducing a JSX
// compiler dependency into this dependency-free CI suite. Browser QA also
// exercises these callbacks through the rendered invitation and home screens.
test("leaving an invitation clears both the URL and the next online entry", () => {
  const previousWindow = globalThis.window;
  let url = "https://example.test/Street-Kings/?room=OLD&keep=1";
  globalThis.window = { get location() { return url; }, history: { replaceState(_state, _title, next) { url = String(next); } } };
  try {
    const exit = flowSource.match(/<CreateJoin[^>]*onExit=\{(\(\) => \{[^}]*\})\}/);
    assert.ok(exit, "Invitation exit callback must be tested when its wiring changes");
    let exited = false;
    const onExit = Function("setUrlRoom", "onExit", `return ${exit[1]};`)(setUrlRoom, () => { exited = true; });
    onExit();
    assert.equal(exited, true);
    assert.equal(new URL(url).searchParams.has("room"), false);
    assert.equal(new URL(url).searchParams.get("keep"), "1");
    for (const pattern of [/onOnline=\{(\(\) => \{[^}]*\})\}/, /<OnlineFlow[^>]*onExit=\{(\(\) => \{[^}]*\})\}/]) {
      const callback = appSource.match(pattern);
      assert.ok(callback, "Home/online navigation callback must reset invitation state");
      const calls = [];
      Function("setInitialCode", "setScreen", `return ${callback[1]};`)(
        value => calls.push(["code", value]), value => calls.push(["screen", value]))();
      assert.deepEqual(calls[0], ["code", null]);
      assert.ok(["home", "online"].includes(calls[1][1]));
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("displayed help describes token recovery and red-card-only Kingpin heat", async () => {
  const rules = await source("components/RulesDialog.jsx");
  const { SPECIALS } = await import(constantsUrl);
  assert.match(SPECIALS.fire.desc, /roten Karten/);
  assert.doesNotMatch(SPECIALS.fire.desc, /gesamte Hitze/);
  assert.match(rules, /gespeicherter Spielerzugang/);
  assert.doesNotMatch(rules, /demselben Namen<\/b> wieder bei/);
  assert.match(rules, /eine Runde ohne Tausch/);
});

function memoryStorage(value) {
  let raw = value;
  return { getItem: () => raw, setItem: (_key, next) => { raw = next; }, removeItem: () => { raw = null; } };
}
const players = Array.from({ length: 4 }, (_, i) => ({ name: `Crew ${i}`, isBot: false }));

test("corrupted saved statistics cannot crash or concatenate counters", () => {
  globalThis.localStorage = memoryStorage(JSON.stringify({ gamesPlayed: "4", roundsPlayed: null, players: null }));
  const stats = storage.recordGame({ players, scores: [1, 2, 3, 4], winnerNames: ["Crew 0"], rounds: 2 });
  assert.equal(stats.gamesPlayed, 1);
  assert.equal(stats.roundsPlayed, 2);
  assert.equal(stats.players["Crew 0"].games, 1);
});

test("player names matching Object prototype keys are ordinary saved identities", () => {
  globalThis.localStorage = memoryStorage(null);
  const names = ["__proto__", "constructor", "toString"];
  const stats = storage.recordGame({ players: names.map(name => ({ name })), scores: [2, 3, 4], winnerNames: ["__proto__"], rounds: 1 });
  for (const name of names) {
    assert.equal(stats.players[name].games, 1);
    assert.ok(Number.isFinite(stats.players[name].totalFire));
  }
  assert.equal(stats.players.__proto__.wins, 1);
  assert.deepEqual(Object.keys(storage.loadStats().players).sort(), [...names].sort());
});

test("malformed score records are ignored without contaminating statistics", () => {
  globalThis.localStorage = memoryStorage(null);
  const stats = storage.recordGame({ players, scores: [0, NaN], winnerNames: null, rounds: -5 });
  assert.equal(stats.gamesPlayed, 0);
  assert.equal(stats.lowestScore, null);
});

test("blocked browser storage still permits an entire local result", () => {
  globalThis.localStorage = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); } };
  assert.equal(storage.recordGame({ players, scores: [1, 2, 3, 4], winnerNames: [], rounds: 2 }).gamesPlayed, 1);
  assert.equal(storage.clearStats().gamesPlayed, 0);
});

test("room persistence survives denial and rejects damaged or incomplete sessions", () => {
  for (const raw of ["{", "null", "[]", '{"code":"ROOM"}', '{"code":"ROOM","token":""}', '{"code":"bad/code","token":"secret"}']) {
    globalThis.localStorage = memoryStorage(raw);
    assert.equal(storage.loadRoomSession(), null);
  }
  globalThis.localStorage = memoryStorage(null);
  assert.equal(storage.saveRoomSession({ code: "ROOM", token: "secret", spectator: false }), true);
  assert.deepEqual(storage.loadRoomSession(), { code: "ROOM", token: "secret", spectator: false });
  storage.clearRoomSession(); assert.equal(storage.loadRoomSession(), null);
  globalThis.localStorage = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); }, removeItem() { throw new Error("SecurityError"); } };
  assert.equal(storage.loadRoomSession(), null);
  assert.equal(storage.saveRoomSession({ code: "ROOM", token: "secret" }), false);
  assert.doesNotThrow(storage.clearRoomSession);
});

test("malformed recent-game data is rejected before rendering its winners", () => {
  const valid = { players: 4, rounds: 3, winners: ["Boss"] };
  for (const data of [null, {}, "games", [null], [{ ...valid, winners: null }], [{ ...valid, winners: [1] }], [{ ...valid, rounds: -1 }]]) {
    assert.deepEqual(normalizeRecentGames(data), []);
  }
  assert.deepEqual(normalizeRecentGames([valid, { ...valid, players: 7 }]), [valid]);
});

test("incomplete room responses cannot be passed to components", () => {
  const lobby = { code: "ROOM", status: "lobby", phase: "lobby", n: 1, version: 0, players: [{ seat: 0, name: "Boss" }], yourSeat: 0 };
  assert.equal(validateRoomView(lobby), lobby);
  for (const view of [null, {}, { ...lobby, players: null }, { ...lobby, version: "1" }, { ...lobby, n: 4 }, { ...lobby, status: "playing" }]) {
    assert.throws(() => validateRoomView(view), error => error.code === "ONLINE_RESPONSE");
  }
});

test("all authoritative room phases pass validation, malformed cards and sessions do not", () => {
  const base = { code: "ROOM", status: "playing", phase: "playing", n: 3, version: 1,
    players: players.slice(0, 3).map((player, seat) => ({ ...player, seat })), yourSeat: 0,
    scores: [0, 0, 0], handCounts: [20, 20, 20], yourHand: [{ id: "RED-1", suit: "RED", value: 1 }],
    trick: [], lastTrick: null, currentSeat: 0, lastWinner: null, passedSeats: [false, false, false],
    roundResult: { results: [{ total: 0 }, { total: 0 }, { total: 0 }] } };
  for (const phase of ["passing", "playing", "trickEnd", "roundScores", "gameOver"]) {
    const view = { ...base, phase, status: phase === "gameOver" ? "gameOver" : "playing" };
    assert.equal(validateRoomView(view), view);
  }
  assert.throws(() => validateRoomView({ ...base, yourHand: [{ id: "RED-1", suit: "RED", value: "1" }] }));
  assert.throws(() => validateRoomView({ ...base, phase: "roundScores", roundResult: {} }));
  for (const session of [null, {}, { code: "ROOM", token: "" }, { code: "ROOM", token: {} }]) {
    assert.throws(() => validateRoomSession(session), error => error.code === "ONLINE_RESPONSE");
  }
  const valid = { code: "ROOM", token: "saved", spectator: true };
  assert.equal(validateRoomSession(valid), valid);
});

test("optional exchange and spectator data cannot crash their card lists or captions", () => {
  const lobby = { code: "ROOM", status: "lobby", phase: "lobby", n: 1, version: 0, players: [{ seat: 0, name: "Boss" }], yourSeat: 0 };
  const card = { id: "RED-1", suit: "RED", value: 1 };
  const exchange = { sent: [card], received: [card], sentTo: "Crew", receivedFrom: "Boss" };
  assert.equal(validateRoomView(lobby), lobby); // older rooms have no exchange/spectator fields
  const current = { ...lobby, spectators: ["Watcher"], yourExchange: exchange };
  assert.equal(validateRoomView(current), current);
  for (const spectators of ["Watcher", { length: 1 }, [null], [{}]]) {
    assert.throws(() => validateRoomView({ ...lobby, spectators }), error => error.code === "ONLINE_RESPONSE");
  }
  for (const yourExchange of [[], "deal", { ...exchange, sent: {} }, { ...exchange, received: "cards" },
    { ...exchange, sent: [null] }, { ...exchange, sentTo: {} }, { ...exchange, receivedFrom: [] }]) {
    assert.throws(() => validateRoomView({ ...lobby, yourExchange }), error => error.code === "ONLINE_RESPONSE");
  }
});

test("unknown special-card keys cannot address inherited artwork or component properties", () => {
  const card = { id: "RED-1", suit: "RED", value: 1 };
  const base = { code: "ROOM", status: "playing", phase: "playing", n: 3, version: 1,
    players: players.slice(0, 3).map((player, seat) => ({ ...player, seat })), yourSeat: 0,
    scores: [0, 0, 0], handCounts: [20, 20, 20], yourHand: [card],
    trick: [], lastTrick: null, currentSeat: 0, lastWinner: null };
  for (const special of [undefined, null, "fire", "water", "earth", "air", "pygmy", "wizard"]) {
    const valid = { ...base, yourHand: [{ ...card, special }] };
    assert.equal(validateRoomView(valid), valid);
  }
  for (const special of ["__proto__", "constructor", "toString", "hasOwnProperty", "unknown", {}, true, 1]) {
    const invalid = { ...card, special };
    const views = [
      { ...base, yourHand: [invalid] },
      { ...base, trick: [{ seat: 0, card: invalid }] },
      { ...base, lastTrick: [{ seat: 0, card: invalid }] },
      { ...base, yourExchange: { sent: [invalid], received: [] } },
      { ...base, yourExchange: { sent: [], received: [invalid] } },
    ];
    for (const view of views) assert.throws(() => validateRoomView(view), error => error.code === "ONLINE_RESPONSE");
  }
});

test("round-score takeover captions cannot address a missing winner or render objects", () => {
  const base = { code: "ROOM", status: "playing", phase: "roundScores", n: 3, version: 1,
    players: players.slice(0, 3).map((player, seat) => ({ ...player, seat })), yourSeat: 0,
    scores: [0, 0, 0], handCounts: [0, 0, 0], yourHand: [], trick: [], lastTrick: null,
    currentSeat: 0, lastWinner: null, roundResult: { shooter: -1, spellName: null, results: [{ total: 0 }, { total: 0 }, { total: 0 }] } };
  assert.equal(validateRoomView(base), base);
  for (const shooter of [3, 99, "0", {}, -2]) {
    assert.throws(() => validateRoomView({ ...base, roundResult: { ...base.roundResult, shooter } }), error => error.code === "ONLINE_RESPONSE");
  }
  assert.throws(() => validateRoomView({ ...base, roundResult: { ...base.roundResult, shooter: 0, spellName: {} } }), error => error.code === "ONLINE_RESPONSE");
});

test("duplicate pass confirmation does not advance the next player's gate", () => {
  let state = reducer({ phase: "setup" }, { type: "START_GAME", players });
  state = reducer(state, { type: "REVEAL" });
  const cardIds = state.hands[0].slice(0, state.passCount).map(card => card.id);
  const first = reducer(state, { type: "CONFIRM_PASS", cardIds });
  assert.equal(first.passSeat, 1);
  assert.equal(reducer(first, { type: "CONFIRM_PASS", cardIds }), first);
});

test("invalid pass counts, duplicates and foreign cards never change local hands", () => {
  const base = reducer({ phase: "setup" }, { type: "START_GAME", players });
  const state = reducer(base, { type: "REVEAL" });
  const ids = state.hands[0].slice(0, state.passCount).map(card => card.id);
  for (const cardIds of [null, [], ids.slice(1), [ids[0], ids[0], ids[1]], [...ids.slice(1), "missing"]]) {
    assert.equal(reducer(state, { type: "CONFIRM_PASS", cardIds }), state);
  }
});

test("local play and next-trick actions reject wrong phases and illegal follow suit", () => {
  const base = reducer({ phase: "setup" }, { type: "START_GAME", players });
  assert.equal(reducer(base, { type: "START_GAME", players }), base);
  assert.equal(reducer(base, { type: "RESTART_SAME" }), base);
  assert.equal(reducer(base, { type: "PLAY_CARD", cardId: base.hands[0][0].id }), base);
  assert.equal(reducer(base, { type: "CONTINUE_TRICK" }), base);
  assert.equal(reducer(base, { type: "NEXT_ROUND" }), base);
  const state = { ...base, phase: "playing", currentSeat: 0, trick: [{ seat: 3, card: { id: "lead", suit: "RED", value: 1 } }], hands: [[{ id: "red", suit: "RED", value: 3 }, { id: "blue", suit: "BLUE", value: 7 }], ...base.hands.slice(1)] };
  assert.equal(reducer(state, { type: "PLAY_CARD", cardId: "blue" }), state);
});

test("malformed setup payloads cannot escape the reducer into a dealing exception", () => {
  const setup = { phase: "setup" };
  for (const invalid of [undefined, null, [], players.slice(0, 2), [...players, ...players], [null, null, null]]) {
    assert.equal(reducer(setup, { type: "START_GAME", players: invalid }), setup);
  }
});

test("all local player counts finish repeated rounds and conserve the 60 cards", () => {
  for (const n of [3, 4, 5, 6]) {
    const crew = Array.from({ length: n }, (_, i) => ({ name: `Crew ${i}`, isBot: true }));
    let state = reducer({ phase: "setup" }, { type: "START_GAME", players: crew });
    for (let round = 0; round < 5; round++) {
      let actions = 0;
      while (state.phase !== "roundScores") {
        assert.ok(actions++ < 250, `no stuck state for ${n} players: ${state.phase}`);
        const owned = [...state.hands.flat(), ...state.piles.flat(), ...(state.phase === "trickEnd" ? [] : state.trick.map(entry => entry.card))];
        assert.equal(owned.length, 60);
        assert.equal(new Set(owned.map(card => card.id)).size, 60);
        if (state.phase === "passGate") state = reducer(state, { type: "CONFIRM_PASS", cardIds: botPass(state.hands[state.passSeat], state.passCount) });
        else if (state.phase === "playGate") state = reducer(state, { type: "REVEAL" });
        else if (state.phase === "playing") state = reducer(state, { type: "PLAY_CARD", cardId: botPlay(state.hands[state.currentSeat], state.trick) });
        else if (state.phase === "trickEnd") {
          state = reducer(state, { type: "CONTINUE_TRICK" });
          assert.equal(reducer(state, { type: "CONTINUE_TRICK" }), state);
        } else assert.fail(`unexpected phase: ${state.phase}`);
      }
      assert.equal(state.totalRounds, round + 1);
      assert.equal(state.hands.flat().length, 0);
      assert.equal(state.piles.flat().length, 60);
      // Keep testing pass cycles beyond the game-over threshold independently.
      state = reducer({ ...state, scores: Array(n).fill(0) }, { type: "NEXT_ROUND" });
    }
  }
});

// Small deterministic hook host: runs the actual hook with controlled promises,
// effect cleanup and timers, without a browser or changing CRA's module format.
class HookHost {
  slots = []; effects = []; intervals = new Set(); cursor = 0; dirty = false;
  useState(initial) {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = typeof initial === "function" ? initial() : initial;
    return [this.slots[index], next => { this.slots[index] = typeof next === "function" ? next(this.slots[index]) : next; this.dirty = true; }];
  }
  useRef(initial) { const index = this.cursor++; return this.slots[index] ||= { current: initial }; }
  useCallback(fn, deps) {
    const index = this.cursor++;
    const previous = this.slots[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) this.slots[index] = { deps, fn };
    return this.slots[index].fn;
  }
  useEffect(fn, deps) {
    const index = this.cursor++;
    const previous = this.slots[index];
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      this.effects.push(() => { previous?.cleanup?.(); this.slots[index] = { deps, cleanup: fn() }; });
    }
  }
  render(code, token) {
    this.args = [code, token];
    do {
      this.dirty = false; this.cursor = 0; globalThis.__onlineHooks = this;
      this.value = useOnlineGame(...this.args);
      this.effects.splice(0).forEach(fn => fn());
    } while (this.dirty);
    return this.value;
  }
  unmount() { this.slots.forEach(slot => slot?.cleanup?.()); }
}
const hookExports = moduleUrl('export const useState=(...a)=>globalThis.__onlineHooks.useState(...a);export const useRef=(...a)=>globalThis.__onlineHooks.useRef(...a);export const useCallback=(...a)=>globalThis.__onlineHooks.useCallback(...a);export const useEffect=(...a)=>globalThis.__onlineHooks.useEffect(...a);');
const apiExports = moduleUrl('export const roomApi=new Proxy({}, {get:(_,name)=>(...a)=>globalThis.__roomApi[name](...a)});export const onlineErrorMessage=(e)=>e?.response?.data?.detail || e.message;');
const onlineSource = (await source("game/useOnlineGame.js"))
  .replace('from "react"', `from "${hookExports}"`)
  .replace('from "./api"', `from "${apiExports}"`)
  .replaceAll("setInterval(", "globalThis.__onlineSetInterval(")
  .replaceAll("clearInterval(", "globalThis.__onlineClearInterval(");
const { useOnlineGame } = await import(moduleUrl(onlineSource));
globalThis.__onlineSetInterval = (fn) => { globalThis.__onlineHooks.intervals.add(fn); return fn; };
globalThis.__onlineClearInterval = (fn) => globalThis.__onlineHooks.intervals.delete(fn);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test("a pending response from another token cannot expose the old private hand", async () => {
  const pending = [];
  globalThis.__roomApi = { get: (_code, token) => { const request = deferred(); pending.push({ ...request, token }); return request.promise; } };
  const host = new HookHost();
  host.render("ROOM", "old-token");
  host.render("ROOM", "new-token");
  pending[0].resolve({ code: "ROOM", version: 10, yourHand: [{ id: "private-old" }] });
  await settle(); host.render("ROOM", "new-token");
  assert.equal(host.value.view, null);
  assert.equal(pending.at(-1).token, "new-token");
  host.unmount();
});

test("already-loaded private cards are hidden immediately on token change, before effects", async () => {
  globalThis.__roomApi = { get: async () => ({ code: "ROOM", version: 1, yourHand: [{ id: "private-old" }] }) };
  const host = new HookHost(); host.render("ROOM", "old"); await settle(); host.render("ROOM", "old");
  assert.equal(host.value.view.yourHand[0].id, "private-old");
  host.cursor = 0; globalThis.__onlineHooks = host;
  const beforeEffects = useOnlineGame("ROOM", "new");
  assert.equal(beforeEffects.view, null);
  host.unmount();
});

test("rapid repeated actions are serialized while failed actions are visible", async () => {
  const pending = deferred(); let calls = 0;
  globalThis.__roomApi = { get: async () => ({ code: "ROOM", version: 1 }), action: () => { calls++; return pending.promise; } };
  const host = new HookHost(); host.render("ROOM", "token"); await settle(); host.render("ROOM", "token");
  const first = host.value.pass(["A", "B"]);
  const second = host.value.pass(["A", "B"]);
  assert.equal(calls, 1);
  pending.reject(new Error("Invalid selection"));
  await Promise.all([first, second]); await settle(); host.render("ROOM", "token");
  assert.equal(host.value.actionError, "Invalid selection");
  assert.equal(host.value.error, null);
  host.unmount();
});

test("newer versions win over slow polls and errors from abandoned sessions", async () => {
  const poll = deferred();
  globalThis.__roomApi = { get: () => poll.promise, action: async () => ({ code: "ROOM", version: 3, phase: "playing" }) };
  const host = new HookHost(); host.render("ROOM", "token");
  await host.value.play("A");
  poll.resolve({ code: "ROOM", version: 2, phase: "passing" });
  await settle(); host.render("ROOM", "token");
  assert.equal(host.value.view.version, 3);
  host.unmount();
  assert.equal(host.intervals.size, 0);
});

test("abandoned poll failures and actions cannot replace a newly joined room", async () => {
  const oldPoll = deferred(); const oldAction = deferred();
  globalThis.__roomApi = { get: room => room === "OLD" ? oldPoll.promise : Promise.resolve({ code: "NEW", version: 0 }), action: () => oldAction.promise };
  const host = new HookHost(); host.render("OLD", "old");
  const submitted = host.value.play("A");
  host.render("NEW", "new"); await settle(); host.render("NEW", "new");
  oldPoll.reject(new Error("old offline"));
  oldAction.reject(new Error("old invalid"));
  await submitted; await settle(); host.render("NEW", "new");
  assert.equal(host.value.view.code, "NEW");
  assert.equal(host.value.error, null);
  assert.equal(host.value.actionError, null);
  assert.equal(host.value.busy, false);
  host.unmount();
});

test("unmount aborts the outstanding poll and late failures remain ignored", async () => {
  const pending = deferred(); let signal;
  globalThis.__roomApi = { get: (_room, _token, options) => { signal = options.signal; return pending.promise; } };
  const host = new HookHost(); host.render("ROOM", "token");
  host.unmount();
  assert.equal(signal.aborted, true);
  pending.reject(new Error("aborted")); await settle();
  assert.equal(host.value.error, null);
  assert.equal(host.intervals.size, 0);
});

test("closing last-trick review follows its pending open and never blocks play", async () => {
  const open = deferred(); const actions = [];
  globalThis.__roomApi = {
    get: async () => ({ code: "ROOM", version: 0 }),
    action: (_room, _token, payload) => {
      actions.push(payload);
      return payload.reviewing === true ? open.promise : Promise.resolve({ code: "ROOM", version: actions.length });
    },
  };
  const host = new HookHost(); host.render("ROOM", "token"); await settle();
  const reviewing = host.value.reviewLastTrick(true);
  host.value.reviewLastTrick(true); // coalesced heartbeat while the open is pending
  host.value.reviewLastTrick(false);
  await host.value.play("A");
  assert.equal(actions.filter(action => action.type === "play").length, 1);
  assert.equal(actions.filter(action => action.type === "reviewLastTrick").length, 1);
  open.resolve({ code: "ROOM", version: 1 }); await reviewing; await settle();
  assert.deepEqual(actions.filter(action => action.type === "reviewLastTrick").map(action => action.reviewing), [true, false]);
  host.unmount();
});
