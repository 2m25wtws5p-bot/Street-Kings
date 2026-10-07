import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const helperSource = await readFile(new URL("../src/game/exchangeHistory.js", import.meta.url), "utf8");
const { captureCardExchange, exchangeHistoryAvailable, localExchangeSeat } = await import(moduleUrl(helperSource));

const fixture = (n) => ({
  players: Array.from({ length: n }, (_, seat) => ({ name: `Crew ${seat}`, isBot: seat > 1 })),
  hands: Array.from({ length: n }, (_, seat) => Array.from({ length: 4 }, (_, value) => ({ id: `${seat}-${value}`, value, suit: "RED", special: null }))),
  pending: Array.from({ length: n }, (_, seat) => [`${seat}-0`, `${seat}-2`]),
});

test("sent and received snapshots match left, right and across deals for every player count", () => {
  for (const n of [3, 4, 5, 6]) {
    for (const dir of [1, -1, ...(n % 2 === 0 ? [n / 2] : [])]) {
      const { players, hands, pending } = fixture(n);
      const history = captureCardExchange(hands, pending, dir, players);
      for (let seat = 0; seat < n; seat += 1) {
        const source = (seat - dir + n) % n;
        const target = (seat + dir + n) % n;
        assert.deepEqual(history[seat].sent.map(card => card.id), pending[seat]);
        assert.deepEqual(history[seat].received.map(card => card.id), pending[source]);
        assert.equal(history[seat].sentTo, players[target].name);
        assert.equal(history[seat].receivedFrom, players[source].name);
      }
    }
  }
});

test("history stays intact after hand removal and never mutates original cards", () => {
  const { players, hands, pending } = fixture(4);
  const original = JSON.stringify(hands);
  const history = captureCardExchange(hands, pending, 1, players);
  assert.equal(JSON.stringify(hands), original);
  assert.notEqual(history[0].sent[0], hands[0][0]);
  assert.notEqual(history[0].received[0], hands[3][0]);
  hands[0].splice(0, 4);
  hands[3][0].value = 99;
  assert.deepEqual(history[0].sent.map(card => card.id), pending[0]);
  assert.equal(history[0].received[0].value, 0);
});

test("no-pass rounds create no deal history", () => {
  const { players, hands, pending } = fixture(4);
  assert.deepEqual(captureCardExchange(hands, pending, 0, players), [null, null, null, null]);
});

test("button is only available during the first three tricks, including completed tricks", () => {
  const exchange = { sent: [{ id: "RED-1" }], received: [] };
  for (const phase of ["playing", "trickEnd"]) {
    for (const number of [1, 2, 3]) assert.equal(exchangeHistoryAvailable(phase, number, exchange), true);
    for (const number of [0, 4, 15, undefined, "1"]) assert.equal(exchangeHistoryAvailable(phase, number, exchange), false);
  }
  for (const phase of ["setup", "passGate", "passing", "playGate", "roundScores", "gameOver"]) {
    assert.equal(exchangeHistoryAvailable(phase, 1, exchange), false);
  }
  assert.equal(exchangeHistoryAvailable("playing", 1, null), false);
  assert.equal(exchangeHistoryAvailable("playing", 1, { sent: [], received: [] }), false);
});

test("hot-seat gates hide all history; revealed humans see only their own deal", () => {
  const { players } = fixture(4);
  const state = { players, currentSeat: 1, phase: "playing" };
  assert.equal(localExchangeSeat(state, 0), 1);
  assert.equal(localExchangeSeat({ ...state, phase: "playGate" }, 0), null);
  assert.equal(localExchangeSeat({ ...state, phase: "passing" }, 0), null);
  assert.equal(localExchangeSeat({ ...state, phase: "playing", currentSeat: 2 }, 1), 1);
  assert.equal(localExchangeSeat({ ...state, phase: "trickEnd", currentSeat: 3 }, 1), 1);
  assert.equal(localExchangeSeat({ ...state, phase: "trickEnd" }, 2), null);
  assert.equal(localExchangeSeat({ ...state, phase: "trickEnd" }, null), null);
});

// Exercise the real reducer without changing CRA's module configuration or invoking hooks.
const constantsSource = await readFile(new URL("../src/game/constants.js", import.meta.url), "utf8");
const engineSource = (await readFile(new URL("../src/game/engine.js", import.meta.url), "utf8"))
  .replace('from "./constants"', `from "${moduleUrl(constantsSource)}"`);
const reducerSource = (await readFile(new URL("../src/game/useGame.js", import.meta.url), "utf8"))
  .replace('import { useReducer, useCallback } from "react";', "const useReducer = () => {}; const useCallback = () => {};")
  .replace('from "./exchangeHistory"', `from "${moduleUrl(helperSource)}"`)
  .replace('from "./engine"', `from "${moduleUrl(engineSource)}"`);
const { reducer } = await import(moduleUrl(`${reducerSource}\nexport { reducer };`));

test("local reducer records the exchange before moving cards and clears it in the next round", () => {
  const { players, hands, pending } = fixture(4);
  const initial = reducer({ phase: "setup" }, { type: "START_GAME", players });
  assert.deepEqual(initial.exchangeHistory, [null, null, null, null]);
  const waiting = { ...initial, hands, pendingSelections: pending.slice(0, 3), passSeat: 3, phase: "passing" };
  const dealt = reducer(waiting, { type: "CONFIRM_PASS", cardIds: pending[3] });
  assert.equal(dealt.phase, "playGate");
  assert.deepEqual(dealt.exchangeHistory[0].sent.map(card => card.id), pending[0]);
  assert.deepEqual(dealt.exchangeHistory[0].received.map(card => card.id), pending[3]);
  assert.ok(dealt.hands[0].every(card => !pending[0].includes(card.id)));
  assert.ok(pending[3].every(id => dealt.hands[0].some(card => card.id === id)));
  const nextRound = reducer({ ...dealt, phase: "roundScores" }, { type: "NEXT_ROUND" });
  assert.deepEqual(nextRound.exchangeHistory, [null, null, null, null]);
  assert.equal(nextRound.roundIndex, 1);
  const rematch = reducer(dealt, { type: "RESTART_SAME" });
  assert.deepEqual(rematch.exchangeHistory, [null, null, null, null]);
});

test("source patches are no longer rendered on cards", async () => {
  const source = await readFile(new URL("../src/components/CardView.jsx", import.meta.url), "utf8");
  assert.ok(!source.includes('className="card-source"'));
});
