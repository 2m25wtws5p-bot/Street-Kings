import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const constants = moduleUrl(await readFile(new URL("../src/game/constants.js", import.meta.url), "utf8"));
const engineSource = (await readFile(new URL("../src/game/engine.js", import.meta.url), "utf8")).replace('from "./constants"', `from "${constants}"`);
const { scoreRound, makeDeck } = await import(moduleUrl(engineSource));
const catalogueUrl = moduleUrl(await readFile(new URL("../src/i18n/messages/rules.js", import.meta.url), "utf8"));
const { de, en } = await import(catalogueUrl);
const explanationSource = (await readFile(new URL("../src/game/scoreExplanation.js", import.meta.url), "utf8")).replace('from "../i18n/messages/rules"', `from "${catalogueUrl}"`);
const { explainRoundScore, getScoreCardMeta, SCORE_CARD_META, signedScore } = await import(moduleUrl(explanationSource));
const translate = catalogue => (key, params = {}) => {
  let message = catalogue[key];
  assert.ok(message, `Missing translation: ${key}`);
  if (typeof message === "object") message = message[params.count === 1 ? "one" : "other"];
  return message.replace(/\{(\w+)\}/g, (_, param) => String(params[param] ?? `{${param}}`));
};
const tEn = translate(en);
const deck = makeDeck();
const cards = ids => ids.map(id => deck.find(card => card.id === id));
const step = (explanation, id) => explanation.steps.find(item => item.id === id);
function explanationFor(pile, previous = 12) {
  const result = scoreRound([pile, [], []]);
  return explainRoundScore(result.results[0], { score: previous + result.results[0].total, roundResult: result });
}

test("red11 is not a base point; its doubling shows the fifteen-point cap", () => {
  const normal = explanationFor(cards(["RED-1", "RED-2", "RED-3", "RED-4", "RED-11"]));
  assert.equal(step(normal, "red").math, "4 × 1 = 4");
  assert.equal(step(normal, "kingpin").math, "4 × 2 = 8");
  assert.equal(normal.total, 8);
  assert.equal(normal.ledger, "12 + 8 = 20");
  const capped = explanationFor(deck.filter(card => card.suit === "RED" && card.value <= 11));
  assert.equal(step(capped, "kingpin").math, "10 × 2 → 15");
  assert.equal(step(capped, "kingpin").status, "Maximum 15");
  assert.equal(capped.total, 15);
});

test("blue11 clears ordinary red, doubled red and both green penalties before yellow", () => {
  const result = explanationFor(cards(["RED-1", "RED-2", "RED-11", "GREEN-11", "GREEN-12", "BLUE-11", "YELLOW-11"]));
  assert.equal(step(result, "informant").math, "+5");
  assert.equal(step(result, "godmother").math, "+10");
  assert.equal(step(result, "fixer").math, "−19 → 0");
  assert.equal(step(result, "briber").math, "−0 → 0");
  assert.equal(step(result, "briber").status, "Keine Hitze übrig");
  assert.equal(result.total, 0);
  assert.deepEqual(result.steps.map(item => item.id), ["red", "kingpin", "informant", "godmother", "fixer", "briber"]);
});

test("yellow11 deducts actual available points with no carry to previous total", () => {
  const floored = explanationFor(cards(["RED-1", "RED-2", "RED-3", "YELLOW-11"]), 31);
  assert.equal(step(floored, "briber").math, "−3 → 0");
  assert.equal(floored.ledger, "31 + 0 = 31");
  const reduced = explanationFor(cards(["RED-1", "RED-2", "GREEN-11", "GREEN-12", "YELLOW-11"]));
  assert.equal(step(reduced, "briber").math, "−5 → 12");
  assert.equal(reduced.total, 12);
});

test("takeovers replace normal scoring and preserve inactive colored card labels", () => {
  for (const [greens, takeover] of [[["GREEN-11"], 20], [["GREEN-12"], 25], [["GREEN-11", "GREEN-12"], 30]]) {
    const piles = [[...deck.filter(card => card.suit === "RED"), ...cards(greens)], cards(["BLUE-11", "YELLOW-11"]), []];
    const result = scoreRound(piles, [5, 12, 22]);
    const shooter = explainRoundScore(result.results[0], { score: 5, roundResult: result });
    assert.equal(shooter.total, 0);
    assert.equal(shooter.takeover, takeover);
    assert.match(step(shooter, "takeover").math, new RegExp(`= ${takeover}$`));
    const victim = explainRoundScore(result.results[1], { score: 12 + takeover, roundResult: result });
    assert.equal(victim.total, takeover);
    assert.equal(step(victim, "inactive-fixer").status, "Takeover: inaktiv");
    assert.equal(step(victim, "inactive-briber").status, "Takeover: inaktiv");
    assert.equal(step(victim, "takeover").math, `+${takeover}`);
  }
});

test("endgame exception shows actual negative deduction and unchanged opponents", () => {
  const piles = [[...deck.filter(card => card.suit === "RED"), ...cards(["GREEN-12"])], cards(["BLUE-11", "YELLOW-11", "GREEN-11"]), []];
  const result = scoreRound(piles, [40, 0, 60]);
  assert.equal(result.takeoverWithheld, true);
  const shooter = explainRoundScore(result.results[0], { score: 15, roundResult: result });
  assert.equal(shooter.total, -25);
  assert.equal(shooter.takeover, 25);
  assert.equal(shooter.ledger, "40 − 25 = 15");
  assert.equal(step(shooter, "takeover").status, "Ende verhindert");
  const victim = explainRoundScore(result.results[1], { score: 0, roundResult: result });
  assert.equal(victim.ledger, "0 + 0 = 0");
  assert.equal(step(victim, "inactive-informant").status, "Takeover: inaktiv");
});

test("metadata preserves rank and suit identity, including green12 Patin", () => {
  assert.equal(SCORE_CARD_META.godmother.suit, "GREEN");
  assert.equal(SCORE_CARD_META.godmother.rank, 12);
  assert.equal(SCORE_CARD_META.godmother.ink, SCORE_CARD_META.informant.ink);
  assert.equal(SCORE_CARD_META.fixer.rank, 11);
  assert.equal(SCORE_CARD_META.runner.rank, 0);
  assert.equal(signedScore(-18), "−18");
  assert.equal(signedScore(0), "0");
  assert.equal(signedScore(25), "+25");
});

test("explanation uses the authoritative delta and does not mutate its inputs", () => {
  const result = Object.freeze({ heatCards: 0, total: -5, moon: true, informant: true });
  const roundResult = Object.freeze({ takeoverPoints: 20, takeoverWithheld: true });
  const explanation = explainRoundScore(result, { score: 0, roundResult, pile: cards(["YELLOW-11"]) });
  assert.equal(explanation.total, -5);
  assert.equal(explanation.ledger, "5 − 5 = 0");
  assert.equal(step(explanation, "inactive-briber").cardKey, "briber");
  assert.equal(result.briber, undefined);
});

test("rules, scoring and stats catalogues cover identical keys and placeholders", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(de)) {
    assert.equal(typeof de[key], typeof en[key], key);
    if (typeof de[key] === "object") {
      assert.deepEqual(Object.keys(de[key]).sort(), ["one", "other"]);
      assert.deepEqual(Object.keys(de[key]).sort(), Object.keys(en[key]).sort());
      for (const form of ["one", "other"]) assert.deepEqual(placeholders(de[key][form]), placeholders(en[key][form]), `${key}.${form}`);
    } else {
      assert.equal(typeof en[key], "string");
      assert.ok(en[key].trim().length > 0, key);
      assert.deepEqual(placeholders(de[key]), placeholders(en[key]), key);
    }
  }
  assert.equal(tEn("rules.passing.cards", { count: 1 }), "1 card");
  assert.equal(tEn("rules.passing.cards", { count: 3 }), "3 cards");
  assert.match(tEn("rules.goal.text", { threshold: 70 }), /70 Heat or more/);
  assert.match(en["rules.goal.text"], /share the win/);
  assert.match(en["rules.takeover.exception"], /40 to 15/);
  assert.match(en["rules.online.variant"], /previous total remains unchanged/);
});

test("English card presentation preserves every suit, rank and score color", () => {
  const cardsEn = getScoreCardMeta(tEn);
  assert.equal(cardsEn.godmother.name, "Godmother");
  assert.equal(cardsEn.briber.name, "Briber");
  assert.equal(cardsEn.runner.name, "Runner");
  assert.equal(cardsEn.informant.colorName, "Green");
  assert.equal(cardsEn.fixer.role, "Reduces Heat");
  for (const key of Object.keys(SCORE_CARD_META)) {
    for (const field of ["suit", "rank", "ink", "paper", "roleKey"]) assert.equal(cardsEn[key][field], SCORE_CARD_META[key][field], `${key}.${field}`);
  }
  assert.equal(SCORE_CARD_META.godmother.name, "Patin", "An English viewer must not mutate German defaults");
});

test("German and English viewers explain the same ordinary round without changing points", () => {
  const pile = cards(["RED-1", "RED-2", "RED-11", "GREEN-11", "GREEN-12", "BLUE-11", "YELLOW-11"]);
  const roundResult = scoreRound([pile, [], []]);
  const result = Object.freeze({ ...roundResult.results[0] });
  const options = { score: 31, roundResult, pile };
  const german = explainRoundScore(result, options);
  const english = explainRoundScore(result, { ...options, t: tEn });
  for (const field of ["total", "previous", "score", "takeover", "takeoverWithheld", "isTakeover", "ledger"]) assert.equal(english[field], german[field], field);
  assert.deepEqual(english.steps.map(({ id, math, cardKey, suit }) => ({ id, math, cardKey, suit })), german.steps.map(({ id, math, cardKey, suit }) => ({ id, math, cardKey, suit })));
  assert.equal(step(english, "godmother").title, "Godmother");
  assert.equal(step(english, "briber").status, "No Heat left");
  assert.equal(step(german, "briber").status, "Keine Hitze übrig");
  assert.match(step(english, "fixer").note, /red and green Heat/);
});

test("English takeover explanations preserve each penalty and endgame exception", () => {
  for (const [greens, points] of [[["GREEN-11"], 20], [["GREEN-12"], 25], [["GREEN-11", "GREEN-12"], 30]]) {
    for (const previous of [[5, 12, 22], [40, 0, 60]]) {
      const piles = [[...deck.filter(card => card.suit === "RED"), ...cards(greens)], cards(["BLUE-11", "YELLOW-11"]), []];
      const roundResult = scoreRound(piles, previous);
      const shooter = explainRoundScore(roundResult.results[0], { score: previous[0] + roundResult.results[0].total, roundResult, t: tEn });
      const victim = explainRoundScore(roundResult.results[1], { score: previous[1] + roundResult.results[1].total, roundResult, t: tEn });
      assert.equal(shooter.takeover, points);
      assert.equal(step(victim, "inactive-fixer").math, "no effect");
      assert.equal(step(victim, "inactive-briber").status, "Takeover: inactive");
      if (roundResult.takeoverWithheld) {
        assert.equal(step(shooter, "takeover").status, "Game end prevented");
        assert.match(step(shooter, "takeover").note, /minimum of 0/);
        assert.equal(victim.total, 0);
      } else {
        assert.match(step(shooter, "takeover").note, new RegExp(`${points} Heat`));
        assert.equal(victim.total, points);
      }
    }
  }
});
