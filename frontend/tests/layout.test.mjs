import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Dependency-free component/style contracts run before the frontend install in CI.
// These checks do NOT simulate browser layout. Actual card/button intersections,
// hand coordinates and responsive dimensions are verified separately in a browser.
const source = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
const [cssSource, card, preview, local, online, passing, indicator, chatStyles] = await Promise.all([
  source("index.css"), source("components/CardView.jsx"), source("components/SelectedCards.jsx"),
  source("components/PlayTable.jsx"), source("components/OnlineTable.jsx"),
  source("components/PassingScreen.jsx"), source("components/LeadSuitIndicator.jsx"), source("components/chat.css"),
]);

// Read individual declarations independent of whitespace or property order.
// Splitting selector lists preserves commas inside :is() and attribute strings.
function selectors(text) {
  return text.split(/,(?![^()]*\))(?![^\[]*\])/).map(value => value.trim());
}
const rules = [...cssSource.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(([, selectorText, body]) => selectors(selectorText).map(selector => ({
    selector,
    properties: Object.fromEntries(body.split(";").flatMap(declaration => {
      const colon = declaration.indexOf(":");
      return colon < 0 ? [] : [[declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()]];
    })),
  })));
const clean = value => value?.replace(/\s*!important\s*$/, "").trim();
const declarations = selector => rules.filter(rule => rule.selector === selector);
const finalProperty = (selector, property) => clean(declarations(selector).map(rule => rule.properties[property]).filter(Boolean).at(-1));

test("all card sizes use width-only classes and a shared printed-card ratio", () => {
  const sizes = card.match(/const\s+SIZES\s*=\s*(\{[^;]+\});/);
  assert.ok(sizes, "Card sizes need an explicit sizing contract");
  const values = Object.values(Function(`return (${sizes[1]});`)());
  assert.equal(values.length, 4);
  for (const value of values) {
    assert.match(value, /\bw-/);
    assert.doesNotMatch(value, /\b(?:h-|min-h-|max-h-)/, "Fixed heights can distort responsive cards");
  }
  for (const selector of [".street-card", ".street-card-back"]) {
    assert.equal(finalProperty(selector, "aspect-ratio")?.replace(/\s+/g, ""), "20/29");
    assert.equal(finalProperty(selector, "height"), "auto");
  }
});

test("selecting a hand card cannot change its size or grid footprint", () => {
  const selected = rules.filter(({ selector }) => /\.compact-hand\s*>\s*(?:\.street-card)?\[data-selected[^\]]*\](?::(?:hover|focus-visible))?$/.test(selector));
  assert.ok(selected.length, "Selected-card styling must remain explicit");
  for (const { selector, properties } of selected) {
    for (const property of ["width", "height", "aspect-ratio", "margin", "margin-top", "margin-bottom", "padding", "top", "bottom", "grid-row", "grid-column"]) {
      assert.equal(properties[property], undefined, `${selector}: ${property} changes the hand footprint`);
    }
  }
  assert.doesNotMatch(card, /selected\s*\?[^\n]*\b(?:w-|h-|scale-)/, "Selection may lift/highlight but must not resize the card");
});

test("special cards have no automatic vertical hand offset", () => {
  for (const { selector, properties } of rules.filter(rule => rule.selector.includes(".compact-hand") && rule.selector.includes("[data-special"))) {
    assert.ok(!properties.top || /^(?:0(?:px)?|auto)$/.test(clean(properties.top)), `${selector} has an idle top offset`);
    assert.ok(!properties.transform || clean(properties.transform) === "none", `${selector} has an idle transform`);
  }
});

test("short online exchange screens prioritize cards and actions over the empty table", () => {
  assert.match(online, /data-phase=\{phase\}/);
  assert.match(cssSource, /@media\s*\(max-width:639px\)\s*and\s*\(max-height:600px\)\s*\{[^}]*\.game-table\[data-phase="passing"\]\s+\.game-center\s*\{\s*display:none;/);
  assert.equal(finalProperty('.game-table[data-phase="passing"] .game-center', "display"), "none");
  assert.equal(finalProperty('.game-table[data-phase="playing"] .game-center', "display"), undefined);
});

test("local exchange uses the responsive fan without a full-height readiness row", () => {
  assert.match(passing, /<HandCards cards=\{hand\} initialCount=\{dealCount\(n\)\}/);
  assert.match(passing, /selectedIds=\{selected\}/);
  assert.match(passing, /onCardClick=\{readOnly \? undefined : card => toggle\(card\.id\)\}/);
  assert.match(chatStyles, /\.passing-progress\s*\{\s*flex:0 0 auto;/);
  assert.match(chatStyles, /\.game-table-status\s*>\s*\.passing-progress\s*\{\s*flex-basis:100%;/);
});

test("larger desktop cards require both a wide and a tall viewport", () => {
  assert.match(cssSource, /@media\(min-width:1280px\) and \(min-height:800px\)\s*\{\s*\.turn-hand-grid\.compact-hand\s*\{\s*--hand-card-width:96px;/);
  assert.match(cssSource, /@media\(min-width:1440px\) and \(min-height:950px\)\s*\{\s*\.turn-hand-grid\.compact-hand\s*\{\s*--hand-card-width:104px;/);
  assert.match(cssSource, /@media\(min-width:640px\) and \(max-height:650px\)[\s\S]*?--trick-card-max-width:42px;/);
});

test("playing has no conditional preview row and keeps its confirmation hint mounted", () => {
  assert.doesNotMatch(local, /<SelectedCards\b/);
  // Online still uses one preview in the exchange phase, not below an armed card.
  assert.equal([...online.matchAll(/<SelectedCards\b/g)].length, 1);
  for (const component of [local, online]) {
    assert.doesNotMatch(component, /armed\s*&&\s*<SelectedCards\b/);
    const hint = component.match(/<span\b[^>]*data-testid="game-play-confirmation-hint"[^>]*>/);
    assert.ok(hint, "Both table modes reserve the same confirmation-hint line");
    assert.match(hint[0], /game-play-hint/);
    assert.match(hint[0], /invisible/);
    assert.match(hint[0], /aria-hidden=\{!armed\}/);
    assert.doesNotMatch(component, /armed\s*&&\s*<span[^>]*game-play-hint/);
  }
});

test("exchange previews reserve a slot for every required card, even before selection", () => {
  assert.match(preview, /Array\.from\(\s*\{\s*length:\s*count\s*\}/);
  assert.match(preview, /selected-card-slot/);
  assert.match(preview, /selected-card-placeholder/);
  assert.doesNotMatch(preview, /selected\.map\(/, "Preview height must not depend on selected count");
  assert.equal(finalProperty(".selected-cards-row", "flex-wrap"), "nowrap");
  assert.equal(finalProperty(".selected-card-slot", "aspect-ratio")?.replace(/\s+/g, ""), "20/29");
  // Inline buttons add baseline descent below a filled slot; reserving an empty
  // slot is not enough unless its card is block-level too (browser regression).
  assert.equal(finalProperty(".selected-card-slot > .street-card", "display"), "block");
});

test("local and online deal/collect controls share the action-button presentation", () => {
  for (const [name, component] of [["local table", local], ["online table", online], ["local deal", passing]]) {
    const buttons = [...component.matchAll(/<button\b[\s\S]*?data-testid="(?:btn-confirm-card-pass|btn-continue-trick)"[\s\S]*?>/g)];
    assert.ok(buttons.length, `${name} exposes its tested game action`);
    for (const [button] of buttons) assert.match(button, /className="game-action-button"/);
  }
  assert.match(local, /trick-action-panel/);
  assert.match(online, /trick-action-panel/);
  assert.match(passing, /game-hand-actions/);
  assert.match(online, /game-hand-actions/);
  assert.ok(Number.parseFloat(finalProperty(".game-hand-actions", "gap")) > 0, "Preview and confirmation button require explicit separation");
});

test("the compact room code is a single unshadowed non-wrapping text label", () => {
  const roomCode = online.match(/<button\b(?:(?!<\/button>)[\s\S])*?data-testid="btn-copy-room-code"[\s\S]*?<\/button>/);
  assert.ok(roomCode);
  assert.doesNotMatch(roomCode[0], /\bgold-text\b/);
  assert.match(roomCode[0], /room-code-text/);
  assert.equal(finalProperty(".room-code-text", "text-shadow"), "none");
  assert.equal(finalProperty(".room-code-text", "white-space") || finalProperty(".room-code-button", "white-space"), "nowrap");
});

test("local and online tables use one opaque, suit-labelled lead indicator", () => {
  for (const component of [local, online]) {
    assert.match(component, /<LeadSuitIndicator\s+suit=\{lead\}/);
    assert.doesNotMatch(component, /SUITS\[lead\]\.primary\}22/);
  }
  assert.match(indicator, /if\s*\(!definition\)\s*return\s+null/);
  assert.match(indicator, /aria-label=\{t\("game\.ledSuit",\s*\{ suit: definition\.people \}\)\}/);
  assert.match(indicator, /useGameLabels\(\)/, "Lead labels must use the viewer's language, not the room's language");
  const background = finalProperty(".lead-suit-indicator", "background");
  assert.ok(background, "Lead marker has an explicit printed surface");
  assert.doesNotMatch(background, /transparent|rgba\(/i);
  for (const [hex] of background.matchAll(/#[0-9a-f]{8}\b/gi)) assert.equal(hex.slice(-2).toLowerCase(), "ff", "Lead marker must not use a translucent fill");
});

test("gameplay translations keep complete matching keys, placeholders and plural forms", async () => {
  const messages = await source("i18n/messages/game.js");
  const { de, en } = await import(`data:text/javascript;base64,${Buffer.from(messages).toString("base64")}`);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
  const placeholders = text => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(de)) {
    if (typeof de[key] === "string") {
      assert.equal(typeof en[key], "string", key);
      assert.ok(de[key].trim() && en[key].trim(), `${key} must not render an empty label`);
      assert.deepEqual(placeholders(en[key]), placeholders(de[key]), key);
    } else {
      assert.deepEqual(Object.keys(de[key]).sort(), ["one", "other"]);
      assert.deepEqual(Object.keys(en[key]).sort(), ["one", "other"]);
      for (const form of ["one", "other"]) {
        assert.ok(de[key][form].trim() && en[key][form].trim(), `${key}.${form}`);
        assert.deepEqual(placeholders(en[key][form]), placeholders(de[key][form]), `${key}.${form}`);
      }
    }
  }
  assert.equal(en["game.cardCount"].one, "{count} card");
  assert.equal(en["game.cardCount"].other, "{count} cards");
  assert.notEqual(en["game.reminderAnnouncement"], de["game.reminderAnnouncement"]);
});

test("shared gameplay screens and accessible announcements resolve existing viewer-local keys", async () => {
  const messages = await source("i18n/messages/game.js");
  const { de, en } = await import(`data:text/javascript;base64,${Buffer.from(messages).toString("base64")}`);
  for (const file of ["PlayTable", "PassingScreen", "PassGate", "GameHeaderButtons", "LastTrickButton", "ExchangeHistoryButton", "SelectedCards", "PlayerIdentity", "TrickCards", "TurnStatus", "PassingProgress", "LeadSuitIndicator", "HostCrown", "Avatar"]) {
    const component = await source(`components/${file}.jsx`);
    assert.match(component, /useI18n\(\)/, `${file} must use the viewer's language`);
    for (const [, key] of component.matchAll(/\bt\("(game\.[^"]+)"/g)) {
      assert.ok(Object.hasOwn(de, key) && Object.hasOwn(en, key), `${file}: missing ${key}`);
    }
  }
  const status = await source("components/TurnStatus.jsx");
  assert.match(status, /t\("game\.reminderAnnouncement"\)/);
  assert.match(status, /aria-live="polite" aria-atomic="true"/);
});

// Execute the actual table event handlers too: appearance changes must preserve
// selection limits, deselection and the existing deliberate two-tap play flow.
function callback(component, name, scope) {
  const start = component.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `Missing ${name} callback`);
  const end = component.indexOf("\n  };", start);
  assert.ok(end > start);
  const expression = component.slice(start + `const ${name} =`.length, end + 4);
  return Function(...Object.keys(scope), `return (${expression});`)(...Object.values(scope));
}

test("the local deal still toggles cards and refuses selection beyond its limit", () => {
  let selected = [];
  let cues = 0;
  const toggle = callback(passing, "toggle", { readOnly: false, passCount: 4, sfx: { select: () => cues++ }, setSelected: update => { selected = update(selected); } });
  for (const id of ["A", "B", "C", "D", "E"]) toggle(id);
  assert.deepEqual(selected, ["A", "B", "C", "D"]);
  toggle("B");
  toggle("E");
  assert.deepEqual(selected, ["A", "C", "D", "E"]);
  assert.equal(cues, 5);
});

test("the online deal respects both the limit and a pending action", () => {
  let selected = [];
  const actions = { busy: false };
  const toggle = callback(online, "toggleSelect", { actions, view: { passCount: 3 }, sfx: { select() {} }, setSelected: update => { selected = update(selected); } });
  for (const id of ["A", "B", "C", "D"]) toggle(id);
  assert.deepEqual(selected, ["A", "B", "C"]);
  actions.busy = true;
  toggle("A");
  assert.deepEqual(selected, ["A", "B", "C"]);
  actions.busy = false;
  toggle("A");
  assert.deepEqual(selected, ["B", "C"]);
});

test("local play still arms on first tap, ignores illegal cards and plays on second tap", () => {
  let armed = null;
  const played = [];
  const click = () => callback(local, "clickCard", { canPlay: true, armed, legal: new Set(["A", "B"]), state: { roundIndex: 0 }, trickNumber: 1, currentSeat: 0, sfx: { select() {}, playCard() {} }, rememberPlayedCard() {}, onPlay: id => played.push(id), setArmed: id => { armed = id; } });
  click()({ id: "A" });
  assert.equal(armed, "A");
  assert.deepEqual(played, []);
  click()({ id: "ILLEGAL" });
  assert.equal(armed, "A");
  click()({ id: "B" });
  assert.equal(armed, "B");
  click()({ id: "B" });
  assert.deepEqual(played, ["B"]);
  assert.equal(armed, null);
});

test("online play preserves two-tap confirmation and cannot play while busy", () => {
  let armed = null;
  const played = [];
  const actions = { busy: false, play: id => played.push(id) };
  const click = () => callback(online, "clickPlay", { armed, actions, legal: new Set(["A"]), sfx: { select() {} }, rememberPlayedCard() {}, setArmed: id => { armed = id; } });
  click()({ id: "A" });
  assert.equal(armed, "A");
  actions.busy = true;
  click()({ id: "A" });
  assert.deepEqual(played, []);
  actions.busy = false;
  click()({ id: "A" });
  assert.deepEqual(played, ["A"]);
  assert.equal(armed, null);
});
