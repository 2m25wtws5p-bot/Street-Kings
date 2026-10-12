// Pure game logic for the Street Kings (Street Kings) trick-taking card game.
import { SUIT_ORDER, WIN_THRESHOLD } from "./constants";

export function makeDeck() {
  const cards = [];
  for (const suit of SUIT_ORDER) {
    for (let v = 1; v <= 14; v++) {
      let special = null;
      if (suit === "RED" && v === 11) special = "kingpin";
      else if (suit === "GREEN" && v === 11) special = "informant"; // Informant (+5)
      else if (suit === "YELLOW" && v === 11) special = "briber"; // Schmierer (-5)
      else if (suit === "BLUE" && v === 11) special = "fixer"; // Fixer (neutralisiert)
      else if (suit === "GREEN" && v === 12) special = "godmother";
      cards.push({ id: `${suit}-${v}`, suit, value: v, special });
    }
  }
  for (let i = 1; i <= 4; i++) {
    cards.push({ id: `W${i}`, suit: null, value: 0, special: "runner" });
  }
  return cards;
}

export function shuffle(deck) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function validatePlayerCount(n) {
  // Never silently discard/over-deal cards for a corrupted saved setup.
  if (!Number.isInteger(n) || n < 3 || n > 6) {
    throw new RangeError("Player count must be an integer between 3 and 6");
  }
}

export function dealCount(n) {
  validatePlayerCount(n);
  return 60 / n; // 3->20, 4->15, 5->12, 6->10
}

export function deal(deck, n) {
  const count = dealCount(n);
  if (!Array.isArray(deck) || deck.length !== 60 ||
      deck.some(card => !card || typeof card.id !== "string") ||
      new Set(deck.map(card => card.id)).size !== 60) {
    throw new RangeError("A deal requires exactly 60 uniquely identified cards");
  }
  const hands = Array.from({ length: n }, () => []);
  let idx = 0;
  for (let seat = 0; seat < n; seat++) {
    for (let c = 0; c < count; c++) {
      hands[seat].push(deck[idx++]);
    }
  }
  hands.forEach((h) => h.sort(sortCards));
  return hands;
}

export function sortCards(a, b) {
  const order = { RED: 0, YELLOW: 1, BLUE: 2, GREEN: 3, null: 4 };
  const sa = order[a.suit] ?? 4;
  const sb = order[b.suit] ?? 4;
  if (sa !== sb) return sa - sb;
  return a.value - b.value;
}

// Passing configuration per player count and round.
export function passInfo(n, roundIndex) {
  validatePlayerCount(n);
  if (!Number.isInteger(roundIndex) || roundIndex < 0) {
    throw new RangeError("Round index must be a nonnegative integer");
  }
  const counts = { 3: 4, 4: 3, 5: 3, 6: 2 };
  const count = counts[n];
  let dirs;
  if (n === 3 || n === 5) dirs = [1, -1];
  else dirs = [1, -1, Math.floor(n / 2)]; // left, right, across; every round has a pass
  const dir = dirs[roundIndex % dirs.length];
  return { count, dir };
}

export function targetSeat(seat, dir, n) {
  return (((seat + dir) % n) + n) % n;
}

// The lead suit is set by the first non-runner card in the trick.
export function leadSuit(trick) {
  const e = trick.find((t) => t.card.suit != null);
  return e ? e.card.suit : null;
}

export function legalCardIds(hand, trick) {
  if (trick.length === 0) return hand.map((c) => c.id);
  const lead = leadSuit(trick);
  if (lead == null) return hand.map((c) => c.id); // only runners played so far
  const hasLead = hand.some((c) => c.suit === lead);
  if (!hasLead) return hand.map((c) => c.id);
  return hand
    .filter((c) => c.suit === lead || c.special === "runner")
    .map((c) => c.id);
}

// Returns the winning seat of a completed trick.
export function resolveTrick(trick) {
  if (!trick.length) throw new RangeError("Cannot resolve an empty trick");
  const leadEntry = trick.find((t) => t.card.suit != null);
  if (!leadEntry) return trick[0].seat; // all runners -> first played wins
  const lead = leadEntry.card.suit;
  let winner = null;
  for (const t of trick) {
    if (t.card.suit === lead) {
      if (!winner || t.card.value > winner.card.value) winner = t;
    }
  }
  return winner.seat;
}

// Scores a completed round. piles = array (per seat) of captured cards.
export function scoreRound(piles, previousScores = null) {
  const n = piles.length;
  const results = Array.from({ length: n }, () => ({
    heatCards: 0,
    kingpin: false,
    informant: false,
    godmother: false,
    briber: false,
    fixer: false,
    total: 0,
    moon: false,
  }));

  // Takeover: all 14 Hitze cards AND Informant and/or Patin
  let shooter = -1;
  piles.forEach((pile, seat) => {
    const allRed = pile.filter((c) => c.suit === "RED").length === 14;
    const greenSpecial = pile.some((c) => c.special === "informant" || c.special === "godmother");
    if (allRed && greenSpecial) shooter = seat;
  });

  if (shooter >= 0) {
    const s = piles[shooter];
    const hasInformant = s.some((c) => c.special === "informant");
    const hasGodmother = s.some((c) => c.special === "godmother");
    const takeover = 15 + (hasInformant ? 5 : 0) + (hasGodmother ? 10 : 0); // 20 / 25 / 30
    let takeoverName = "Takeover";
    if (hasInformant && hasGodmother) takeoverName = "Großer Takeover";
    else if (hasGodmother) takeoverName = "Patin-Takeover";
    // Endgame exception: a takeover must not hand the
    // victory to another player. Instead, deduct its value from the shooter.
    const projected = previousScores?.map((score, seat) => score + (seat === shooter ? 0 : takeover));
    const takeoverWithheld = !!projected && isGameOver(projected) && lowestSeats(projected).some(seat => seat !== shooter);
    piles.forEach((pile, seat) => {
      if (seat === shooter) {
        results[seat] = {
          heatCards: 13,
          kingpin: true,
          informant: hasInformant,
          godmother: hasGodmother,
          briber: pile.some(c => c.special === "briber"),
          fixer: pile.some(c => c.special === "fixer"),
          total: takeoverWithheld ? -Math.min(previousScores[seat], takeover) : 0,
          moon: true,
          takeoverVictim: false,
        };
      } else {
        results[seat] = {
          heatCards: pile.filter(c => c.suit === "RED" && c.special !== "kingpin").length,
          kingpin: pile.some(c => c.special === "kingpin"),
          informant: pile.some(c => c.special === "informant"),
          godmother: pile.some(c => c.special === "godmother"),
          briber: pile.some(c => c.special === "briber"),
          fixer: pile.some(c => c.special === "fixer"),
          total: takeoverWithheld ? 0 : takeover,
          moon: false,
          takeoverVictim: true,
        };
      }
    });
    return { results, shooter, takeoverName, takeoverPoints: takeover, takeoverWithheld };
  }

  piles.forEach((pile, seat) => {
    const redPts = pile.filter((c) => c.suit === "RED" && c.special !== "kingpin").length;
    const kingpin = pile.some((c) => c.special === "kingpin");
    const fixer = pile.some((c) => c.special === "fixer");
    const informant = pile.some((c) => c.special === "informant");
    const godmother = pile.some((c) => c.special === "godmother");
    const briber = pile.some((c) => c.special === "briber");
    let base = redPts;
    if (kingpin) base = Math.min(base * 2, 15);
    let total = base;
    if (informant) total += 5;
    if (godmother) total += 10;
    if (fixer) total = 0;
    if (briber) total = Math.max(total - 5, 0);
    results[seat] = { heatCards: redPts, kingpin, informant, godmother, briber, fixer, total, moon: false };
  });
  return { results, shooter: -1, takeoverName: null };
}

export function isGameOver(scores) {
  return scores.some((s) => s >= WIN_THRESHOLD);
}

export function lowestSeats(scores) {
  const min = Math.min(...scores);
  return scores.map((s, i) => (s === min ? i : -1)).filter((i) => i >= 0);
}

/* ---------------- AI opponents ---------------- */

// How badly a bot wants to get rid of a card (higher = dump it).
export function cardDanger(card) {
  if (card.special === "runner") return -5; // safe, keep for escapes
  if (card.special === "briber") return -25; // blessing, keep
  if (card.special === "fixer") return -15; // neutralizer, keep
  if (card.special === "godmother") return 45; // +10, dump
  if (card.special === "informant") return 32; // +5, dump
  if (card.special === "kingpin") return 27; // kingpin special, dangerous to hold
  if (card.suit === "RED") return 12 + card.value; // kingpin cards
  return card.value * 0.4; // non-kingpin, mild
}

// Choose `count` cards for a bot to pass away.
export function botPass(hand, count) {
  return [...hand]
    .sort((a, b) => cardDanger(b) - cardDanger(a))
    .slice(0, count)
    .map((c) => c.id);
}

function leadPref(card) {
  if (card.special === "runner") return 3; // leading a runner is safe (can't win)
  if (card.special === "godmother") return 95;
  if (card.special === "informant") return 85;
  if (card.special === "kingpin") return 55;
  if (card.suit === "RED") return 40 + card.value;
  return card.value; // low non-kingpin preferred
}

// Choose a legal card for a bot to play.
export function botPlay(hand, trick) {
  if (!hand.length) throw new RangeError("Cannot choose a card from an empty hand");
  const legalSet = new Set(legalCardIds(hand, trick));
  const legal = hand.filter((c) => legalSet.has(c.id));
  if (legal.length === 0) return hand[0].id;

  if (trick.length === 0) {
    return [...legal].sort((a, b) => leadPref(a) - leadPref(b))[0].id;
  }

  const lead = leadSuit(trick);
  const hasLead = hand.some((c) => c.suit === lead);
  const trickHasPenalty = trick.some(
    (t) => t.card.suit === "RED" || t.card.special === "informant" || t.card.special === "godmother"
  );

  if (!hasLead) {
    // void of the led colour — off-suit can never win, so dump the worst card
    const nonRunner = legal.filter((c) => c.special !== "runner");
    const pool = nonRunner.length ? nonRunner : legal;
    return [...pool].sort((a, b) => cardDanger(b) - cardDanger(a))[0].id;
  }

  const leadCards = legal.filter((c) => c.suit === lead);
  const curMax = Math.max(...trick.filter((t) => t.card.suit === lead).map((t) => t.card.value));
  const safe = leadCards.filter((c) => c.value < curMax);
  if (safe.length) {
    return safe.sort((a, b) => b.value - a.value)[0].id; // duck with highest safe card
  }
  // any lead card would currently win
  const runner = legal.find((c) => c.special === "runner");
  if (trickHasPenalty && runner) return runner.id; // escape a penalty trick
  return leadCards.sort((a, b) => a.value - b.value)[0].id;
}
