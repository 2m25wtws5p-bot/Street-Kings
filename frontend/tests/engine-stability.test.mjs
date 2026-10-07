import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Import the actual CRA modules without changing the app's module configuration.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const constantsSource = await readFile(new URL("../src/game/constants.js", import.meta.url), "utf8");
const engineSource = (await readFile(new URL("../src/game/engine.js", import.meta.url), "utf8"))
  .replace('from "./constants"', `from "${moduleUrl(constantsSource)}"`);
const eng = await import(moduleUrl(engineSource));
const byId = Object.fromEntries(eng.makeDeck().map(card => [card.id, card]));
const deckIds = eng.makeDeck().map(card => card.id).sort();

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function seededDeck(seed) {
  const random = randomSource(seed);
  const deck = eng.makeDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

function assertConservation(hands, piles, trick = []) {
  const cards = [...hands.flat(), ...piles.flat(), ...trick.map(entry => entry.card)];
  assert.equal(cards.length, 60);
  assert.deepEqual(cards.map(card => card.id).sort(), deckIds);
}

function expectedWinner(trick) {
  const firstColored = trick.find(entry => entry.card.suit !== null);
  if (!firstColored) return trick[0].seat;
  return trick.filter(entry => entry.card.suit === firstColored.card.suit)
    .reduce((best, entry) => entry.card.value > best.card.value ? entry : best).seat;
}

// Pure-engine simulations test every move, not just the eventual score.
export function simulateRound(n, seed, roundIndex) {
  let hands = eng.deal(seededDeck(seed), n);
  const piles = Array.from({ length: n }, () => []);
  const { count, dir } = eng.passInfo(n, roundIndex);
  if (dir !== 0) {
    const selected = hands.map(hand => eng.botPass(hand, count));
    const outgoing = hands.map((hand, seat) => hand.filter(card => selected[seat].includes(card.id)));
    const incoming = Array.from({ length: n }, () => []);
    for (let seat = 0; seat < n; seat += 1) {
      assert.equal(selected[seat].length, count);
      assert.equal(new Set(selected[seat]).size, count);
      incoming[eng.targetSeat(seat, dir, n)].push(...outgoing[seat]);
    }
    hands = hands.map((hand, seat) => [
      ...hand.filter(card => !selected[seat].includes(card.id)), ...incoming[seat],
    ].sort(eng.sortCards));
  }
  assertConservation(hands, piles);
  assert.ok(hands.every(hand => hand.length === 60 / n));
  let leader = roundIndex % n;
  const winners = [];
  const plays = [];
  for (let number = 0; number < 60 / n; number += 1) {
    const trick = [];
    for (let offset = 0; offset < n; offset += 1) {
      const seat = (leader + offset) % n;
      const before = JSON.stringify(hands[seat]);
      const legal = eng.legalCardIds(hands[seat], trick);
      const id = eng.botPlay(hands[seat], trick);
      assert.equal(JSON.stringify(hands[seat]), before, "bot choice must not mutate hand");
      assert.ok(legal.includes(id), `illegal bot play ${id}`);
      assert.equal(new Set(legal).size, legal.length);
      const index = hands[seat].findIndex(card => card.id === id);
      assert.ok(index >= 0);
      const [card] = hands[seat].splice(index, 1);
      trick.push({ seat, card });
      plays.push(id);
      assertConservation(hands, piles, trick);
    }
    leader = eng.resolveTrick(trick);
    assert.equal(leader, expectedWinner(trick));
    winners.push(leader);
    piles[leader].push(...trick.map(entry => entry.card));
    assertConservation(hands, piles);
  }
  assert.ok(hands.every(hand => hand.length === 0));
  const score = eng.scoreRound(piles);
  assert.ok(score.results.every(result => Number.isInteger(result.total) && result.total >= 0 && result.total <= 30));
  return { plays, winners, score };
}

// The Python suite calls this mode to compare both real engines against the same corpus.
if (process.argv.includes("--parity")) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const corpus = JSON.parse(input);
  const result = {
    deck: eng.makeDeck(),
    passing: corpus.passing.map(([n, round]) => eng.passInfo(n, round)),
    tricks: corpus.tricks.map(trick => ({ lead: eng.leadSuit(trick), winner: eng.resolveTrick(trick) })),
    choices: corpus.choices.map(({ hand, trick, count }) => ({
      legal: eng.legalCardIds(hand, trick), play: eng.botPlay(hand, trick), pass: eng.botPass(hand, count),
    })),
    scoring: corpus.piles.map(piles => eng.scoreRound(piles)),
    rounds: corpus.rounds.map(([n, seed, round]) => simulateRound(n, seed, round)),
  };
  process.stdout.write(JSON.stringify(result));
} else {
  test("deck has 60 unique cards with the five special mappings and four zero cards", () => {
    const deck = eng.makeDeck();
    assert.equal(deck.length, 60);
    assert.equal(new Set(deck.map(card => card.id)).size, 60);
    for (const suit of ["RED", "YELLOW", "BLUE", "GREEN"]) {
      assert.deepEqual(deck.filter(card => card.suit === suit).map(card => card.value), Array.from({ length: 14 }, (_, i) => i + 1));
    }
    assert.deepEqual(Object.fromEntries(deck.filter(card => card.special && card.special !== "wizard").map(card => [card.special, card.id])), {
      fire: "RED-11", earth: "YELLOW-11", air: "BLUE-11", water: "GREEN-11", pygmy: "GREEN-12",
    });
    assert.equal(deck.filter(card => card.suit === null && card.value === 0 && card.special === "wizard").length, 4);
  });

  test("shuffle is a nonmutating permutation across 40 seeded random sources", () => {
    const originalRandom = Math.random;
    try {
      for (let seed = 0; seed < 40; seed += 1) {
        Math.random = randomSource(seed);
        const deck = eng.makeDeck();
        const before = JSON.stringify(deck);
        const result = eng.shuffle(deck);
        assert.notEqual(result, deck);
        assert.equal(JSON.stringify(deck), before);
        assert.deepEqual(result.map(card => card.id).sort(), deckIds);
      }
    } finally {
      Math.random = originalRandom;
    }
  });

  test("all deal sizes and passing cycles preserve the deck and inverse seat mappings", () => {
    const directions = { 3: [1, -1], 4: [1, -1, 2, 0], 5: [1, -1], 6: [1, -1, 3, 0] };
    for (const n of [3, 4, 5, 6]) {
      const deck = seededDeck(n);
      const before = JSON.stringify(deck);
      const hands = eng.deal(deck, n);
      assert.equal(JSON.stringify(deck), before);
      assert.equal(hands.length, n);
      assert.ok(hands.every(hand => hand.length === eng.dealCount(n)));
      assertConservation(hands, []);
      for (let round = 0; round < 16; round += 1) {
        const { count, dir } = eng.passInfo(n, round);
        assert.equal(count, { 3: 4, 4: 3, 5: 2, 6: 2 }[n]);
        assert.equal(dir, directions[n][round % directions[n].length]);
        assert.equal(new Set(hands.map((_, seat) => eng.targetSeat(seat, dir, n))).size, n);
        for (let seat = 0; seat < n; seat += 1) {
          assert.equal(eng.targetSeat(eng.targetSeat(seat, dir, n), -dir, n), seat);
        }
      }
    }
  });

  test("zero-card lead and follow-suit exceptions are legal; off-suit high cards never win", () => {
    const hand = [byId["RED-3"], byId["BLUE-14"], byId.W2];
    assert.deepEqual(eng.legalCardIds(hand, []), hand.map(card => card.id));
    assert.deepEqual(eng.legalCardIds(hand, [{ seat: 0, card: byId.W1 }]), hand.map(card => card.id));
    assert.deepEqual(eng.legalCardIds(hand, [{ seat: 0, card: byId["RED-1"] }]), ["RED-3", "W2"]);
    assert.deepEqual(eng.legalCardIds(hand, [{ seat: 0, card: byId["GREEN-1"] }]), hand.map(card => card.id));
    for (const suit of ["RED", "YELLOW", "BLUE", "GREEN"]) {
      for (let value = 1; value <= 13; value += 1) {
        const otherSuit = suit === "BLUE" ? "GREEN" : "BLUE";
        const trick = [{ seat: 2, card: byId.W1 }, { seat: 0, card: byId[`${suit}-${value}`] },
          { seat: 1, card: byId[`${otherSuit}-14`] }, { seat: 3, card: byId[`${suit}-${value + 1}`] }];
        assert.equal(eng.leadSuit(trick), suit);
        assert.equal(eng.resolveTrick(trick), 3);
      }
    }
    for (let first = 0; first < 4; first += 1) {
      assert.equal(eng.resolveTrick(Array.from({ length: 4 }, (_, i) => ({ seat: (first + i) % 4, card: byId[`W${i + 1}`] }))), first);
    }
    assert.deepEqual(eng.legalCardIds([], []), []);
  });

  test("448 red-count and special-card combinations respect caps, neutralization and takeovers", () => {
    const reds = eng.makeDeck().filter(card => card.suit === "RED" && card.special !== "fire");
    const specials = ["RED-11", "GREEN-11", "GREEN-12", "YELLOW-11", "BLUE-11"].map(id => byId[id]);
    for (let count = 0; count <= 13; count += 1) {
      for (let mask = 0; mask < 32; mask += 1) {
        const flags = specials.map((_, i) => Boolean(mask & (1 << i)));
        const [fire, water, pygmy, earth, air] = flags;
        const pile = [...reds.slice(0, count), ...specials.filter((_, i) => flags[i])];
        const before = JSON.stringify(pile);
        const result = eng.scoreRound([[], pile, []]);
        assert.equal(JSON.stringify(pile), before);
        if (count === 13 && fire && (water || pygmy)) {
          const spell = 15 + (water ? 5 : 0) + (pygmy ? 10 : 0);
          assert.equal(result.shooter, 1);
          assert.deepEqual(result.results.map(row => row.total), [spell, 0, spell]);
          assert.equal(result.results[1].moon, true);
        } else {
          let expected = fire ? Math.min(15, count * 2) : count;
          if (!air) expected += (water ? 5 : 0) + (pygmy ? 10 : 0);
          if (earth) expected = Math.max(0, expected - 5);
          assert.equal(result.shooter, -1);
          assert.equal(result.results[1].total, expected);
          assert.equal(result.results[1].fireCards, count);
          assert.equal(result.results[1].moon, false);
        }
      }
    }
  });

  test("threshold includes exactly 70 points and lowest-seat ties are preserved", () => {
    assert.equal(eng.isGameOver([0, 69, 20]), false);
    assert.equal(eng.isGameOver([0, 70, 20]), true);
    assert.equal(eng.isGameOver([80, 0, 20]), true);
    assert.deepEqual(eng.lowestSeats([8, 3, 3, 9]), [1, 2]);
    assert.deepEqual(eng.lowestSeats([0, 0, 0]), [0, 1, 2]);
  });

  test("160 seeded rounds for 3–6 players conserve every card after every legal bot move", () => {
    for (const n of [3, 4, 5, 6]) {
      for (let seed = 0; seed < 40; seed += 1) simulateRound(n, seed + n * 1000, seed);
    }
  });

  test("32 seeded full bot games reach the threshold with nondecreasing scores", () => {
    for (const n of [3, 4, 5, 6]) {
      for (let seed = 0; seed < 8; seed += 1) {
        const scores = Array(n).fill(0);
        let round = 0;
        while (!eng.isGameOver(scores) && round < 200) {
          const result = simulateRound(n, n * 100000 + seed * 1000 + round, round);
          result.score.results.forEach((row, seat) => { scores[seat] += row.total; });
          round += 1;
        }
        assert.ok(round < 200, `game did not terminate: players=${n}, seed=${seed}`);
        assert.ok(eng.isGameOver(scores));
        assert.ok(eng.lowestSeats(scores).every(seat => scores[seat] === Math.min(...scores)));
      }
    }
  });

  test("malformed deal configuration and incomplete decks fail explicitly before losing cards", () => {
    for (const n of [0, 1, 2, 7, -1, 3.5, "4", null, true]) {
      assert.throws(() => eng.dealCount(n), RangeError);
      assert.throws(() => eng.deal(eng.makeDeck(), n), RangeError);
      assert.throws(() => eng.passInfo(n, 0), RangeError);
    }
    for (const round of [-1, 0.5, "1", null, NaN]) assert.throws(() => eng.passInfo(4, round), RangeError);
    for (const deck of [eng.makeDeck().slice(1), [...eng.makeDeck(), byId.W1], Array(60).fill(byId.W1)]) {
      assert.throws(() => eng.deal(deck, 4), RangeError);
    }
    assert.throws(() => eng.resolveTrick([]), RangeError);
    assert.throws(() => eng.botPlay([], []), RangeError);
  });
}
