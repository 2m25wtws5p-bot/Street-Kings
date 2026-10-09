import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Dependency-free rule/ownership contracts. These checks do not simulate a
// browser: actual hand coordinates and intersections still need visual QA.
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const [helperSource, hook, online, localGame, localTable, status, css, sharedHand, sharedCss] = await Promise.all([
  source("game/handLayout.js"), source("game/useHandLayout.js"),
  source("components/OnlineTable.jsx"), source("components/LocalGame.jsx"),
  source("components/PlayTable.jsx"), source("components/TurnStatus.jsx"), source("index.css"),
  source("components/HandCards.jsx"), source("components/HandCards.css"),
]);
const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const { reservedHandHeight, handRowCounts, handRowGeometry } = await import(moduleUrl(helperSource));
const desktop = { initialCount: 20, width: 1024, cardWidth: 80, rowGap: 26, columnGap: 8, columns: 0 };
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .000001, `${message}: ${actual} != ${expected}`);

test("desktop reserves the original deal rows through waiting and completion", () => {
  for (const initialCount of [20, 15, 12]) {
    for (let remainingCount = initialCount; remainingCount >= 0; remainingCount--) {
      close(reservedHandHeight({ ...desktop, initialCount, remainingCount }), 258,
        `${initialCount}-card deal with ${remainingCount} remaining`);
    }
  }
  close(reservedHandHeight({ ...desktop, initialCount: 10 }), 116, "ten-card deal needs one desktop row");
});

test("desktop always reserves two ten-card rows even at former wrapping boundaries", () => {
  close(reservedHandHeight({ ...desktop, width: 640 }), 258, "20 cards overlap in two rows at 640px");
  close(reservedHandHeight({ ...desktop, width: 871 }), 258, "the original two rows remain reserved");
  close(reservedHandHeight({ ...desktop, width: 872 }), 258, "ten columns fit at their exact boundary");
  close(reservedHandHeight({ ...desktop, width: 960 }), 258, "eleven columns fit at their exact boundary");
  close(reservedHandHeight({ ...desktop, width: 1024 }), 258, "maximum desktop width reserves two rows");
  close(reservedHandHeight({ ...desktop, initialCount: 1, width: 40 }), 116, "narrow widths still reserve one card");
});

test("hands use balanced rows of at most ten and exactly ten plus ten for twenty", () => {
  assert.deepEqual(handRowCounts(20), [10, 10]);
  assert.deepEqual(handRowCounts(15), [8, 7]);
  assert.deepEqual(handRowCounts(12), [6, 6]);
  assert.deepEqual(handRowCounts(11), [6, 5]);
  assert.deepEqual(handRowCounts(10), [10]);
  assert.deepEqual(handRowCounts(0), []);
  for (let count = 1; count <= 20; count++) {
    const rows = handRowCounts(count);
    assert.equal(rows.reduce((sum, row) => sum + row, 0), count);
    assert.ok(Math.max(...rows) <= 10);
    assert.ok(Math.max(...rows) - Math.min(...rows) <= 1);
  }
});

test("row spread expands as cards leave and stops at full card visibility", () => {
  let previous = 0;
  for (let count = 10; count >= 2; count--) {
    const row = handRowGeometry({ count, width: 304, cardWidth: 64, columnGap: 8 });
    assert.ok(row.width <= 304);
    assert.ok(row.step >= previous);
    assert.ok(row.step <= 72);
    previous = row.step;
  }
  assert.deepEqual(handRowGeometry({ count: 4, width: 304, cardWidth: 64, columnGap: 8 }), { width: 280, step: 72 });
  assert.deepEqual(handRowGeometry({ count: 1, width: 304, cardWidth: 64, columnGap: 8 }), { width: 64, step: 0 });
});

test("mobile always reserves ten columns at every compact-card breakpoint", () => {
  const compactSizes = [
    { cardWidth: 42, rowGap: 12, twoRows: 133.8, oneRow: 60.9 },
    { cardWidth: 64, rowGap: 22, twoRows: 207.6, oneRow: 92.8 },
    { cardWidth: 54, rowGap: 16, twoRows: 172.6, oneRow: 78.3 },
    { cardWidth: 46, rowGap: 16, twoRows: 149.4, oneRow: 66.7 },
  ];
  for (const { cardWidth, rowGap, twoRows, oneRow } of compactSizes) {
    for (const width of [288, 304, 359, 386, 520]) {
      for (const initialCount of [20, 15, 12, 10]) {
        for (const remainingCount of [initialCount, 11, 10, 1, 0].filter(count => count <= initialCount)) {
          close(reservedHandHeight({ initialCount, remainingCount, width, cardWidth, rowGap, columnGap: 0, columns: 10 }),
            initialCount === 10 ? oneRow : twoRows,
            `${initialCount}-card mobile deal at ${width}px with ${cardWidth}px cards and ${remainingCount} left`);
        }
      }
    }
  }
});

test("invalid geometry cannot produce a negative or non-finite reserved height", () => {
  for (const patch of [
    { initialCount: 0 }, { initialCount: -1 }, { initialCount: 1.5 }, { initialCount: NaN }, { initialCount: Infinity },
    { width: 0 }, { width: -1 }, { width: NaN }, { width: Infinity }, { width: "1024" },
    { cardWidth: 0 }, { cardWidth: -1 }, { cardWidth: NaN }, { cardWidth: Infinity },
    { rowGap: -1 }, { rowGap: NaN }, { rowGap: Infinity },
    { columnGap: -1 }, { columnGap: NaN }, { columnGap: Infinity },
    { columns: -1 }, { columns: 1.5 }, { columns: NaN }, { columns: Infinity },
  ]) {
    assert.equal(reservedHandHeight({ ...desktop, ...patch }), 0, `Invalid geometry ${JSON.stringify(patch)}`);
  }
});

test("the measurement hook reserves the deal size and remeasures height-only viewport changes", () => {
  assert.match(hook, /reservedHandHeight\(\s*\{\s*initialCount\s*,/);
  assert.doesNotMatch(hook, /\b(?:hand|yourHand|cards)\.length/);
  assert.match(hook, /new ResizeObserver\(measure\)/);
  assert.match(hook, /window\.addEventListener\("resize",\s*measure\)/);
  assert.match(hook, /window\.removeEventListener\("resize",\s*measure\)/);
  assert.match(hook, /observer\?\.disconnect\(\)/);
  assert.match(hook, /\[initialCount,\s*node\]/);
  assert.match(hook, /minHeight:\s*`\$\{height\}px`/);
  assert.match(hook, /ref:\s*setNode/);
});

function expression(component, name, scope) {
  const declaration = component.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+);`));
  assert.ok(declaration, `Missing ${name} ownership expression`);
  return Function(...Object.keys(scope), `return (${declaration[1]});`)(...Object.values(scope));
}

function soloSeat(players, currentSeat = 0) {
  const state = { players, currentSeat };
  const humanSeats = expression(localGame, "humanSeats", { state });
  return expression(localGame, "soloHumanSeat", { humanSeats });
}

test("a persistent local hand belongs only to a sole human at any seat", () => {
  assert.equal(soloSeat(undefined), null);
  assert.equal(soloSeat([]), null);
  for (const n of [3, 4, 5, 6]) {
    assert.equal(soloSeat(Array.from({ length: n }, () => ({ isBot: true }))), null);
    for (let seat = 0; seat < n; seat++) {
      const players = Array.from({ length: n }, (_, index) => ({ isBot: index !== seat }));
      for (let currentSeat = 0; currentSeat < n; currentSeat++) assert.equal(soloSeat(players, currentSeat), seat);
      for (let other = 0; other < n; other++) {
        if (other !== seat) assert.equal(soloSeat(players.map((player, index) => index === other ? { isBot: false } : player)), null);
      }
    }
  }
  // An omitted bot flag is also a human, not a second persistent owner.
  assert.equal(soloSeat([{ isBot: false }, {}, { isBot: true }]), null);
});

test("local handover gates remain in place for games with multiple humans", () => {
  assert.match(localGame, /state\.phase === "playGate"\s*&&\s*!state\.players\[state\.currentSeat\]\?\.isBot\s*&&\s*soloHumanSeat == null\s*&&\s*\(\s*<PassGate/);
  assert.match(localGame, /<PlayTable\b[^>]*displaySeat=\{soloHumanSeat\}/);
  assert.match(localGame, /state\.phase === "playGate"\s*&&\s*state\.currentSeat === soloHumanSeat\)\s*(?:actions\.)?reveal\(\)/);
  assert.doesNotMatch(localGame, /<PlayTable\b[^>]*displaySeat=\{(?:state\.)?currentSeat\}/);
});

test("local play access follows the hand owner and phase rather than visibility", () => {
  for (const fixture of [
    { displaySeat: 0, currentSeat: 0, phase: "playing", hideHand: false, canPlay: true, faceDown: false },
    { displaySeat: 0, currentSeat: 1, phase: "playing", hideHand: true, canPlay: false, faceDown: false },
    { displaySeat: 0, currentSeat: 1, phase: "playGate", hideHand: true, canPlay: false, faceDown: false },
    { displaySeat: 0, currentSeat: 0, phase: "playGate", hideHand: false, canPlay: false, faceDown: false },
    { displaySeat: 0, currentSeat: 1, phase: "trickEnd", hideHand: true, canPlay: false, faceDown: false },
    { displaySeat: null, currentSeat: 1, phase: "playing", hideHand: true, canPlay: false, faceDown: true },
    { displaySeat: null, currentSeat: 0, phase: "trickEnd", hideHand: false, canPlay: false, faceDown: true },
    { displaySeat: null, currentSeat: 0, phase: "playing", hideHand: false, canPlay: true, faceDown: false },
  ]) {
    const persistentHand = expression(localTable, "persistentHand", fixture);
    const handSeat = expression(localTable, "handSeat", { ...fixture, persistentHand });
    assert.equal(handSeat, fixture.displaySeat ?? fixture.currentSeat);
    assert.equal(expression(localTable, "canPlay", { ...fixture, handSeat }), fixture.canPlay);
    assert.equal(expression(localTable, "faceDown", { ...fixture, persistentHand, isTrickEnd: fixture.phase === "trickEnd" }), fixture.faceDown);
  }
  assert.match(localTable, /useTurnReminder\(\s*\{\s*enabled:\s*canPlay\s*,/);
  assert.match(localTable, /onCardClick=\{canPlay\s*\?\s*clickCard\s*:\s*undefined\}/);
  assert.match(localTable, /canDrag=\{canPlay\}/);
});

test("a stale local card callback cannot select, sound or play while waiting", () => {
  const start = localTable.indexOf("const clickCard =");
  const end = localTable.indexOf("\n  };", start);
  assert.ok(start >= 0 && end > start);
  const callback = localTable.slice(start + "const clickCard =".length, end + 4);
  const unexpected = () => assert.fail("Waiting hands cannot produce play or selection side effects");
  const scope = { canPlay: false, legal: new Set(["A"]), armed: "A", state: { roundIndex: 0 }, trickNumber: 1,
    currentSeat: 0, sfx: { playCard: unexpected, select: unexpected }, onPlay: unexpected, setArmed: unexpected };
  Function(...Object.keys(scope), `return (${callback});`)(...Object.values(scope))({ id: "A" });
});

test("online phases share one persistent medium-card hand component", () => {
  assert.equal([...online.matchAll(/<HandCards\b/g)].length, 1);
  assert.match(online, /<HandCards\b[^>]*cards=\{yourHand\}/);
  assert.match(sharedHand, /<CardView\b[^>]*card=\{card\} size="md"/);
  assert.doesNotMatch(online, /<Waiting\b|function Waiting\b/);
  assert.match(online, /initialCount=\{dealCount\(n\)\}/);
  assert.match(online, /onCardClick=\{phase === "passing"\s*&&\s*!iPassed\s*&&\s*!actions\.busy\s*\?[^\n]+:\s*yourTurn\s*&&\s*!actions\.busy\s*\?[^\n]+:\s*undefined\}/);
  assert.match(online, /canDrag=\{yourTurn\s*&&\s*!actions\.busy\}/);
  assert.match(online, /const yourTurn = !spectator\s*&&\s*phase === "playing"\s*&&\s*currentSeat === yourSeat;/);
});

test("both tables keep the same measured hand and reserved confirmation hint", () => {
  for (const component of [online, localTable]) {
    assert.equal([...component.matchAll(/<HandCards\b/g)].length, 1);
    assert.match(component, /className="turn-action-slot"/);
    assert.match(component, /state=\{(?:phase === "trickEnd"|isTrickEnd)\s*\?\s*"complete"\s*:\s*(?:yourTurn|canPlay)\s*\?\s*"active"\s*:\s*"waiting"\}/);
    const hint = component.match(/<span\b[^>]*data-testid="game-play-confirmation-hint"[^>]*>/);
    assert.ok(hint);
    assert.match(hint[0], /game-play-hint/);
    assert.match(hint[0], /invisible/);
    assert.match(hint[0], /aria-hidden=/);
    assert.doesNotMatch(component, /armed\s*&&\s*<span[^>]*game-play-hint/);
  }
  assert.match(localTable, /initialCount=\{totalTricks\}/);
  assert.match(sharedHand, /ref=\{layout\.ref\} style=\{layout\.style\}/);
  assert.match(sharedHand, /data-initial-count=\{initialCount\} data-testid="own-hand-grid"/);
  assert.match(sharedHand, /useHandLayout\(initialCount\)/);
});

// Preserve media contexts so a mobile override cannot masquerade as a desktop
// contract. This is a small stylesheet reader, not a layout engine.
function stylesheetRules(text, media = []) {
  const result = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("{", cursor);
    if (open < 0) break;
    const header = text.slice(cursor, open).trim().split(";").at(-1).trim();
    let depth = 1;
    let close = open + 1;
    while (close < text.length && depth) {
      if (text[close] === "{") depth++;
      if (text[close] === "}") depth--;
      close++;
    }
    const body = text.slice(open + 1, close - 1);
    if (header.startsWith("@media")) result.push(...stylesheetRules(body, [...media, header.replace(/\s+/g, "")]));
    else if (header.startsWith("@layer")) result.push(...stylesheetRules(body, media));
    else if (!header.startsWith("@")) {
      const properties = Object.fromEntries(body.split(";").flatMap(declaration => {
        const colon = declaration.indexOf(":");
        return colon < 0 ? [] : [[declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim().replace(/\s*!important$/, "")]];
      }));
      for (const selector of header.split(/,(?![^()]*\))(?![^\[]*\])/)) result.push({ selector: selector.trim(), media, properties });
    }
    cursor = close;
  }
  return result;
}
const rules = stylesheetRules(`${css}\n${sharedCss}`.replace(/\/\*[\s\S]*?\*\//g, ""));
const properties = (selector, media = []) => Object.assign({}, ...rules
  .filter(rule => rule.selector === selector && JSON.stringify(rule.media) === JSON.stringify(media)).map(rule => rule.properties));
const mobile = ["@media(max-width:639px)"];
const shortMobile = ["@media(max-width:639px)and(max-height:600px)"];

test("status slots and hand margins stay fixed across playing, waiting and completed tricks", () => {
  const desktopSlot = properties(".turn-action-slot");
  const mobileSlot = properties(".turn-action-slot", mobile);
  const shortSlot = properties(".turn-action-slot", shortMobile);
  assert.equal(desktopSlot.height, "132px");
  assert.equal(mobileSlot.height, "118px");
  assert.equal(shortSlot.height, "90px");
  assert.equal(shortSlot["padding-bottom"], "4px");
  assert.equal(properties(".game-table > div.turn-hand-zone", shortMobile)["padding-bottom"], "6px");
  assert.equal(desktopSlot["box-sizing"], "border-box");
  assert.equal(properties(".game-table > div.turn-hand-zone").flex, "0 0 auto");
  assert.equal(properties(".game-table > div.turn-hand-zone")["margin-top"], "0");
  assert.equal(properties(".game-table > div.turn-hand-zone").animation, "none");
  assert.equal(properties(".game-table > div.turn-hand-zone", mobile)["margin-top"], "0");
  assert.equal(properties(".turn-status-details").height, "48px");
  assert.equal(properties(".turn-status-details", mobile).height, "44px");
  assert.equal(properties(".turn-status-details", shortMobile).height, "36px");
  assert.equal(properties(".turn-status-card", shortMobile).padding, "3px 8px");
  assert.equal(properties(".turn-status-details .game-action-button", shortMobile)["min-height"], "34px");
  // Passing has its own compact prompt, but a player's turn, wait and completed
  // trick all inherit the same slot at each viewport size.
  const geometry = ["height", "min-height", "max-height", "padding", "padding-top", "padding-bottom", "margin", "margin-top", "margin-bottom"];
  for (const rule of rules.filter(rule => /data-phase=["'](?:playing|waiting|trickEnd)["']/.test(rule.selector) && /turn-(?:action-slot|hand-zone|hand-grid|status-details)/.test(rule.selector))) {
    for (const name of geometry) assert.equal(rule.properties[name], undefined, `${rule.selector} changes ${name} by phase`);
  }
  for (const rule of rules.filter(rule => /turn-status-card\[data-state=["'](?:active|waiting|complete)["']\]$/.test(rule.selector))) {
    for (const name of geometry) assert.equal(rule.properties[name], undefined, `${rule.selector} changes ${name} by turn status`);
  }
  assert.equal(properties(".turn-status-details .trick-action-panel").margin, "0");
  assert.ok(Number.parseFloat(properties(".game-play-hint")["min-height"]) > 0);
});

test("responsive CSS uses the same card dimensions that drive row reservation", () => {
  const base = properties(".turn-hand-grid.compact-hand");
  assert.equal(base["max-width"], "1024px");
  assert.equal(base["--hand-card-width"], "80px");
  assert.equal(base["--hand-row-gap"], "26px");
  assert.equal(base["--hand-column-gap"], "8px");
  assert.equal(base["--hand-columns"], "0");
  const compact = properties(".turn-hand-grid.compact-hand", mobile);
  assert.equal(compact["--hand-card-width"], "64px");
  assert.equal(compact["--hand-row-gap"], "22px");
  assert.equal(compact["--hand-column-gap"], "0px");
  assert.equal(compact["--hand-columns"], "10");
  assert.equal(compact.display, "grid");
  assert.equal(compact["grid-template-columns"], "repeat(9,minmax(0,1fr)) var(--hand-card-width)");
  assert.equal(compact["align-content"], "start");
  assert.equal(compact["align-items"], "start");
  const spread = properties(".hand-cards-shell .turn-hand-grid.compact-hand.spread-hand");
  assert.equal(spread.display, "flex");
  assert.equal(spread["flex-direction"], "column");
  assert.equal(spread["grid-template-columns"], "none");
  const spreadRow = properties(".hand-cards-shell .turn-hand-grid.compact-hand.spread-hand > .spread-hand-row");
  assert.equal(spreadRow.height, "calc(var(--hand-card-width) * 1.45)");
  assert.equal(spreadRow.transform, "none");
  assert.equal(properties(".turn-hand-grid.compact-hand", ["@media(max-width:639px)and(max-height:700px)"])["--hand-card-width"], "54px");
  assert.equal(properties(".turn-hand-grid.compact-hand", shortMobile)["--hand-card-width"], "46px");
  assert.equal(properties('.turn-hand-grid.compact-hand > .street-card:not([data-selected="true"]):hover').transform, "none");
  for (const rule of rules.filter(rule => /compact-hand\s*>/.test(rule.selector) && rule.properties.transform && rule.properties.transform !== "none")) {
    assert.match(rule.selector, /\[data-selected="true"\]/, "Only selected cards may lift out of the hand row");
  }
});

test("reminder pulses never change layout and reduced motion retains a static cue", () => {
  const pulse = properties(".turn-reminder-pulse");
  assert.equal(pulse.position, "absolute");
  assert.equal(pulse["pointer-events"], "none");
  assert.match(pulse.animation, /turn-reminder-pulse/);
  const reduced = properties(".turn-reminder-pulse", ["@media(prefers-reduced-motion:reduce)"]);
  assert.equal(reduced.animation, "none");
  assert.equal(reduced.opacity, "1");
  assert.ok(reduced["box-shadow"]);
  assert.match(status, /const remind = state === "active"\s*&&\s*reminderCount > 0;/);
  assert.match(status, /className="turn-reminder-announcement"\s+role="status"\s+aria-live="polite"/);
});
