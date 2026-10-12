import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const { HAND_PREFERENCE_KEY, readHandPreferences, saveHandPreferences, sortHand, canDropHandCard,
  reconcileManualHand, moveHandCard, handReorderTarget } = await import(moduleUrl(await source("game/handPreferences.js")));
const hand = [
  { id: "g-7", suit: "GREEN", value: 7 }, { id: "r-8", suit: "RED", value: 8 },
  { id: "b-2", suit: "BLUE", value: 2 }, { id: "y-3", suit: "YELLOW", value: 3 },
  { id: "r-1", suit: "RED", value: 1 }, { id: "runner", suit: null, value: 0 },
];

test("sorting is private, immutable and ascending for suits and values", () => {
  const original = JSON.stringify(hand);
  assert.deepEqual(sortHand(hand).map(card => card.id), ["r-1", "r-8", "y-3", "b-2", "g-7", "runner"]);
  assert.deepEqual(sortHand(hand, { mode: "value" }).map(card => card.value), [0, 1, 2, 3, 7, 8]);
  assert.equal(JSON.stringify(hand), original);
  assert.ok(sortHand(hand).every(card => hand.includes(card)), "No engine card object is rewritten");
});

test("chaos order stays stable through rerenders, plays, and incoming cards", () => {
  const preferences = { mode: "chaos", seed: 9127 };
  const order = sortHand(hand, preferences).map(card => card.id);
  assert.deepEqual(sortHand([...hand], preferences).map(card => card.id), order);
  const removed = hand[2].id;
  assert.deepEqual(sortHand(hand.filter(card => card.id !== removed), preferences).map(card => card.id), order.filter(id => id !== removed));
  const incoming = { id: "new-card", suit: "BLUE", value: 9 };
  assert.deepEqual(sortHand([...hand, incoming], preferences).filter(card => card.id !== incoming.id).map(card => card.id), order);
  assert.notDeepEqual(sortHand(hand, { ...preferences, seed: 748392 }).map(card => card.id), order);
});

test("manual chaos arrangement preserves identities without editing the hand", () => {
  const original = JSON.stringify(hand);
  const preferences = { mode: "chaos", seed: 9127 };
  const order = sortHand(hand, preferences).map(card => card.id);
  const moved = moveHandCard(order, order[0], order[3]);
  assert.equal(moved[3], order[0]);
  assert.deepEqual(order, sortHand(hand, preferences).map(card => card.id));
  const arranged = reconcileManualHand(hand, moved, preferences);
  assert.deepEqual(arranged.map(card => card.id), moved);
  assert.equal(JSON.stringify(hand), original);
  assert.ok(arranged.every(card => hand.includes(card)));
  assert.deepEqual(moveHandCard(order, "absent", order[2]), order);
  assert.deepEqual(moveHandCard(order, order[0], "absent"), order);
  assert.deepEqual(moveHandCard(order, order[0], order[0]), order);
});

test("manual chaos arrangement drops stale IDs and appends incoming cards predictably", () => {
  const preferences = { mode: "chaos", seed: 9127 };
  const order = [hand[3].id, hand[0].id, hand[2].id, "foreign", hand[3].id];
  const incoming = { id: "incoming", suit: "BLUE", value: 10 };
  const nextHand = [...hand.filter(card => card.id !== hand[2].id), incoming];
  const result = reconcileManualHand(nextHand, order, preferences).map(card => card.id);
  assert.deepEqual(result.slice(0, 2), [hand[3].id, hand[0].id]);
  assert.deepEqual(new Set(result), new Set(nextHand.map(card => card.id)));
  assert.equal(result.length, nextHand.length);
  assert.deepEqual(result.slice(2), sortHand(nextHand.filter(card => !order.includes(card.id)), preferences).map(card => card.id));
});

test("manual drag hit testing uses exposed hand strips and rejects outside points", () => {
  const slots = [
    { id: "a", left: 10, right: 30, top: 100, bottom: 200 },
    { id: "b", left: 30, right: 50, top: 100, bottom: 200 },
    { id: "c", left: 50, right: 120, top: 100, bottom: 200 },
    { id: "d", left: 10, right: 80, top: 230, bottom: 330 },
  ];
  assert.equal(handReorderTarget({ x: 20, y: 150 }, slots), "a");
  assert.equal(handReorderTarget({ x: 45, y: 150 }, slots), "b");
  assert.equal(handReorderTarget({ x: 110, y: 150 }, slots), "c");
  assert.equal(handReorderTarget({ x: 50, y: 300 }, slots), "d");
  for (const point of [{ x: 2, y: 150 }, { x: 50, y: 210 }, { x: 121, y: 150 }, { x: NaN, y: 150 }]) {
    assert.equal(handReorderTarget(point, slots), null);
  }
});

test("per-device preferences survive a remount and refused or malformed storage", () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  assert.deepEqual(readHandPreferences(storage), { mode: "suit", seed: 1729 });
  const saved = saveHandPreferences(storage, { mode: "chaos", seed: 54 });
  assert.deepEqual(readHandPreferences(storage), saved);
  assert.ok(memory.has(HAND_PREFERENCE_KEY));
  for (const value of ["malformed", "null", "{}", '{"mode":"foreign","seed":"bad"}']) {
    memory.set(HAND_PREFERENCE_KEY, value);
    assert.deepEqual(readHandPreferences(storage), { mode: "suit", seed: 1729 });
  }
  const refused = { getItem() { throw new Error("Unavailable"); }, setItem() { throw new Error("Unavailable"); } };
  assert.deepEqual(readHandPreferences(refused), { mode: "suit", seed: 1729 });
  assert.deepEqual(saveHandPreferences(refused, { mode: "value", seed: 2 }), { mode: "value", seed: 2 });
});

const validDrop = { canDrag: true, legalIds: new Set(["r-1"]), cardId: "r-1", interactionKey: "turn-3", startedKey: "turn-3",
  point: { x: 150, y: 200 }, rectangle: { left: 100, right: 400, top: 100, bottom: 300, width: 300, height: 200 } };

test("only legal cards on the unchanged active turn can be dropped into the trick", () => {
  assert.equal(canDropHandCard(validDrop), true);
  for (const patch of [
    { canDrag: false }, { cardId: "r-8" }, { legalIds: new Set() }, { interactionKey: "turn-4" },
    { point: { x: 99, y: 200 } }, { point: { x: 401, y: 200 } }, { point: { x: 150, y: 99 } }, { point: { x: 150, y: 301 } },
    { point: { x: NaN, y: 200 } }, { rectangle: null }, { rectangle: { ...validDrop.rectangle, width: 0 } },
  ]) assert.equal(canDropHandCard({ ...validDrop, ...patch }), false, JSON.stringify(patch));
});

test("local drop callback rechecks legality and bypasses only two-tap confirmation", async () => {
  const component = await source("components/PlayTable.jsx");
  const start = component.indexOf("const dropCard =");
  const end = component.indexOf("\n  };", start);
  const callback = component.slice(start + "const dropCard =".length, end + 4);
  const played = [];
  const sounds = [];
  let armed = "r-8";
  const invoke = canPlay => {
    const scope = { canPlay, legal: new Set(["r-1"]), state: { roundIndex: 0 }, trickNumber: 1, currentSeat: 0,
      sfx: { playCard: card => sounds.push(card.id) }, rememberPlayedCard() {}, onPlay: id => played.push(id), setArmed: value => { armed = value; } };
    return Function(...Object.keys(scope), `return (${callback});`)(...Object.values(scope));
  };
  invoke(false)({ id: "r-1" });
  invoke(true)({ id: "r-8" });
  assert.deepEqual(played, []);
  assert.deepEqual(sounds, []);
  assert.equal(armed, "r-8");
  invoke(true)({ id: "r-1" });
  assert.deepEqual(played, ["r-1"]);
  assert.deepEqual(sounds, ["r-1"]);
  assert.equal(armed, null);
});

test("online drop rejects waiting, busy and illegal callbacks, and plays once when permitted", async () => {
  const component = await source("components/OnlineTable.jsx");
  const start = component.indexOf("const dropPlay =");
  const end = component.indexOf("\n  };", start);
  const callback = component.slice(start + "const dropPlay =".length, end + 4);
  const played = [];
  let armed = "r-8";
  const invoke = (yourTurn, busy) => {
    const scope = { yourTurn, legal: new Set(["r-1"]), rememberPlayedCard() {},
      actions: { busy, play: id => played.push(id) }, setArmed: value => { armed = value; } };
    return Function(...Object.keys(scope), `return (${callback});`)(...Object.values(scope));
  };
  invoke(false, false)({ id: "r-1" });
  invoke(true, true)({ id: "r-1" });
  invoke(true, false)({ id: "r-8" });
  assert.deepEqual(played, []);
  assert.equal(armed, "r-8");
  invoke(true, false)({ id: "r-1" });
  assert.deepEqual(played, ["r-1"]);
  assert.equal(armed, null);
});

test("pointer dragging has a movement threshold, cancellation and click suppression; keyboard remains available", async () => {
  const component = await source("components/HandCards.jsx");
  assert.match(component, /Math\.hypot\(dx, dy\) < 9/);
  assert.match(component, /onPointerCancel=\{draggable \? event => endPointer\(event, card, true\)/);
  assert.match(component, /if \(!cancelled && canDropHandCard/);
  assert.match(component, /event\.detail !== 0 && suppressClick\.current\?\.id === card\.id/);
  assert.match(component, /\[interactionKey, canDrag, faceDown, arranging, orderScope\]/);
  assert.match(component, /onCardClick\?\.\(card\)/);
});

test("confirmed local passes remain highlighted and reject editing while bots finish", async () => {
  const component = await source("components/PassingScreen.jsx");
  const selectedExpression = component.match(/const selected = ([^;]+);/)[1];
  const confirmed = ["r-1", "g-7"];
  const selected = Function("readOnly", "state", "passSeat", "draftSelected", `return (${selectedExpression});`)(true, { pendingSelections: [confirmed] }, 0, []);
  assert.deepEqual(selected, confirmed);
  const start = component.indexOf("const toggle =");
  const end = component.indexOf("\n  };", start);
  const callback = component.slice(start + "const toggle =".length, end + 4);
  const unexpected = () => assert.fail("Confirmed cards cannot be edited or produce sound");
  Function("readOnly", "setSelected", "sfx", `return (${callback});`)(true, unexpected, { select: unexpected })("r-1");
  assert.match(component, /onCardClick=\{readOnly \? undefined/);
  assert.match(component, /disabled=\{!done \|\| readOnly\}/);
  assert.match(component, /<div inert=\{readOnly \|\| undefined\}>/);
});

test("special functions have matching viewer-local translations and a reserved readable line", async () => {
  const { de, en } = await import(moduleUrl(await source("i18n/messages/cardsImprovements.js")));
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const special of ["kingpin", "informant", "briber", "fixer", "godmother", "runner"]) {
    assert.ok(de[`hand.effect.${special}`]);
    assert.ok(en[`hand.effect.${special}`]);
  }
  const component = await source("components/HandCards.jsx");
  const css = await source("components/HandCards.css");
  assert.match(component, /className="hand-card-detail" role="status" aria-live="polite"/);
  assert.match(css, /\.hand-card-detail \{[^}]*height:28px/);
  assert.match(css, /\.hand-card-detail \{ height:30px/);
});
