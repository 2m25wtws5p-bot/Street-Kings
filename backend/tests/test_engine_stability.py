"""Original Witches PDF rule fixtures, seeded games, and Python/JS parity."""
import copy
import json
from pathlib import Path
import random
import shutil
import subprocess
import unittest

import witches_engine as eng


DECK = eng.make_deck()
BY_ID = {card["id"]: card for card in DECK}
DECK_IDS = sorted(BY_ID)


def seeded_deck(seed):
    """The same specified uint32 PRNG as the Node suite, not Python's RNG."""
    state = seed & 0xFFFFFFFF
    deck = eng.make_deck()
    for index in range(len(deck) - 1, 0, -1):
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        other = int(state / 4294967296 * (index + 1))
        deck[index], deck[other] = deck[other], deck[index]
    return deck


def assert_conservation(hands, piles, trick=()):
    cards = [card for group in [*hands, *piles] for card in group]
    cards += [entry["card"] for entry in trick]
    assert len(cards) == 60
    assert sorted(card["id"] for card in cards) == DECK_IDS


def expected_winner(trick):
    colored = next((entry for entry in trick if entry["card"]["suit"] is not None), None)
    if colored is None:
        return trick[0]["seat"]
    return max((entry for entry in trick if entry["card"]["suit"] == colored["card"]["suit"]),
               key=lambda entry: entry["card"]["value"])["seat"]


def pdf_takeover_fixtures():
    """Explicit PDF examples: ordinary spells, endgame exception, ties, zero.

    Scenario expectations are declared independently of score_round. Every
    fixture uses the complete physical deck, with blue/yellow witches at the
    shooter to verify that a takeover preserves its value and capture flags.
    """
    variants = [(["GREEN-11"], 20, "Takeover"),
                (["GREEN-12"], 25, "Patin-Takeover"),
                (["GREEN-11", "GREEN-12"], 30, "Großer Takeover")]
    for n in range(3, 7):
        for shooter in range(n):
            others = [seat for seat in range(n) if seat != shooter]
            for green_ids, spell, spell_name in variants:
                captured = {card["id"] for card in DECK if card["suit"] == "RED"}
                captured.update([*green_ids, "YELLOW-11", "BLUE-11"])
                piles = [[] for _ in range(n)]
                piles[shooter] = [card for card in DECK if card["id"] in captured]
                remaining = [card for card in DECK if card["id"] not in captured]
                for index, card in enumerate(remaining):
                    piles[others[index % len(others)]].append(card)
                scenarios = [
                    # name, shooter score, lowest opponent, threshold opponent,
                    # any additional opponents, expected withholding
                    ("ordinary", 10, 20, 25, 20, False),
                    ("projected69", 60, 0, 69 - spell, 0, False),
                    ("endingShooterWins", 5, 0, 70 - spell, 0, False),
                    ("endingOpponentWins", 60, 0, 70 - spell, 0, True),
                    ("endingTie", spell + 10, 10, 70 - spell, 20, True),
                    ("zeroFloor", spell, 0, 70 - spell, 10, True),
                ]
                for label, own, low, threshold, extra, withheld in scenarios:
                    scores = [extra] * n
                    scores[shooter] = own
                    scores[others[0]] = low
                    scores[others[1]] = threshold
                    deltas = [0 if withheld or seat == shooter else spell for seat in range(n)]
                    if withheld:
                        deltas[shooter] = -spell
                    yield {"label": f"{n}p-seat{shooter}-{spell}-{label}", "piles": piles,
                           "previousScores": scores, "shooter": shooter, "spell": spell,
                           "spellName": spell_name, "withheld": withheld, "deltas": deltas}


def simulate_round(n, seed, round_index, previous_scores=None):
    hands = eng.deal(seeded_deck(seed), n)
    piles = [[] for _ in range(n)]
    count, direction = eng.pass_info(n, round_index)
    if direction:
        selected = [eng.bot_pass(hand, count) for hand in hands]
        outgoing = [[card for card in hand if card["id"] in selected[seat]]
                    for seat, hand in enumerate(hands)]
        incoming = [[] for _ in range(n)]
        for seat in range(n):
            assert len(selected[seat]) == count
            assert len(set(selected[seat])) == count
            incoming[eng.target_seat(seat, direction, n)].extend(outgoing[seat])
        hands = [sorted([card for card in hand if card["id"] not in selected[seat]] + incoming[seat],
                        key=eng._sort_key) for seat, hand in enumerate(hands)]
    assert_conservation(hands, piles)
    assert all(len(hand) == 60 // n for hand in hands)
    leader = round_index % n
    winners, plays = [], []
    for _ in range(60 // n):
        trick = []
        for offset in range(n):
            seat = (leader + offset) % n
            before = copy.deepcopy(hands[seat])
            legal = eng.legal_card_ids(hands[seat], trick)
            card_id = eng.bot_play(hands[seat], trick)
            assert hands[seat] == before, "bot choice mutated its hand"
            assert card_id in legal, f"illegal bot play {card_id}"
            assert len(set(legal)) == len(legal)
            index = next(index for index, card in enumerate(hands[seat]) if card["id"] == card_id)
            card = hands[seat].pop(index)
            trick.append({"seat": seat, "card": card})
            plays.append(card_id)
            assert_conservation(hands, piles, trick)
        leader = eng.resolve_trick(trick)
        assert leader == expected_winner(trick)
        winners.append(leader)
        piles[leader].extend(entry["card"] for entry in trick)
        assert_conservation(hands, piles)
    assert not any(hands)
    score = eng.score_round(piles, previous_scores)
    assert all(isinstance(row["total"], int) and -30 <= row["total"] <= 30 for row in score["results"])
    if previous_scores is not None:
        assert all(old + row["total"] >= 0 for old, row in zip(previous_scores, score["results"]))
    return {"plays": plays, "winners": winners, "score": score}


class EngineStabilityTests(unittest.TestCase):
    def test_deck_complete_unique_and_special_mapping(self):
        self.assertEqual(len(DECK), 60)
        self.assertEqual(len(BY_ID), 60)
        for suit in eng.SUIT_ORDER:
            self.assertEqual([c["value"] for c in DECK if c["suit"] == suit], list(range(1, 15)))
        self.assertEqual({c["special"]: c["id"] for c in DECK if c["special"] not in (None, "wizard")}, {
            "fire": "RED-11", "earth": "YELLOW-11", "air": "BLUE-11", "water": "GREEN-11", "pygmy": "GREEN-12",
        })
        self.assertEqual(sum(c["special"] == "wizard" and c["value"] == 0 and c["suit"] is None for c in DECK), 4)

    def test_shuffle_nonmutating_permutation(self):
        old_state = random.getstate()
        try:
            for seed in range(40):
                random.seed(seed)
                deck = eng.make_deck()
                before = copy.deepcopy(deck)
                result = eng.shuffle(deck)
                self.assertIsNot(result, deck)
                self.assertEqual(deck, before)
                self.assertEqual(sorted(c["id"] for c in result), DECK_IDS)
        finally:
            random.setstate(old_state)

    def test_dealing_passing_cycles_and_inverse_mapping(self):
        cycles = {3: [1, -1], 4: [1, -1, 2], 5: [1, -1], 6: [1, -1, 3]}
        for n, directions in cycles.items():
            deck = seeded_deck(n)
            before = copy.deepcopy(deck)
            hands = eng.deal(deck, n)
            self.assertEqual(deck, before)
            self.assertTrue(all(len(hand) == eng.deal_count(n) for hand in hands))
            assert_conservation(hands, [])
            for round_index in range(16):
                count, direction = eng.pass_info(n, round_index)
                self.assertEqual(count, {3: 4, 4: 3, 5: 3, 6: 2}[n])
                self.assertEqual(direction, directions[round_index % len(directions)])
                self.assertEqual(len({eng.target_seat(seat, direction, n) for seat in range(n)}), n)
                for seat in range(n):
                    self.assertEqual(eng.target_seat(eng.target_seat(seat, direction, n), -direction, n), seat)

    def test_zero_lead_follow_suit_and_winners(self):
        hand = [BY_ID["RED-3"], BY_ID["BLUE-14"], BY_ID["W2"]]
        ids = [card["id"] for card in hand]
        self.assertEqual(eng.legal_card_ids(hand, []), ids)
        self.assertEqual(eng.legal_card_ids(hand, [{"seat": 0, "card": BY_ID["W1"]}]), ids)
        self.assertEqual(eng.legal_card_ids(hand, [{"seat": 0, "card": BY_ID["RED-1"]}]), ["RED-3", "W2"])
        self.assertEqual(eng.legal_card_ids(hand, [{"seat": 0, "card": BY_ID["GREEN-1"]}]), ids)
        for suit in eng.SUIT_ORDER:
            for value in range(1, 14):
                other = "GREEN" if suit == "BLUE" else "BLUE"
                trick = [{"seat": 2, "card": BY_ID["W1"]}, {"seat": 0, "card": BY_ID[f"{suit}-{value}"]},
                         {"seat": 1, "card": BY_ID[f"{other}-14"]}, {"seat": 3, "card": BY_ID[f"{suit}-{value + 1}"]}]
                self.assertEqual(eng.lead_suit(trick), suit)
                self.assertEqual(eng.resolve_trick(trick), 3)
        for first in range(4):
            self.assertEqual(eng.resolve_trick([{"seat": (first + i) % 4, "card": BY_ID[f"W{i + 1}"]}
                                               for i in range(4)]), first)
        self.assertEqual(eng.legal_card_ids([], []), [])

    def test_all_448_scoring_combinations(self):
        reds = [card for card in DECK if card["suit"] == "RED" and card["special"] != "fire"]
        specials = [BY_ID[card_id] for card_id in ("RED-11", "GREEN-11", "GREEN-12", "YELLOW-11", "BLUE-11")]
        for count in range(14):
            for mask in range(32):
                with self.subTest(red_count=count, special_mask=mask):
                    flags = [bool(mask & (1 << i)) for i in range(5)]
                    fire, water, pygmy, earth, air = flags
                    pile = reds[:count] + [card for i, card in enumerate(specials) if flags[i]]
                    before = copy.deepcopy(pile)
                    result = eng.score_round([[], pile, []])
                    self.assertEqual(pile, before)
                    if count == 13 and fire and (water or pygmy):
                        spell = 15 + (5 if water else 0) + (10 if pygmy else 0)
                        self.assertEqual(result["shooter"], 1)
                        self.assertEqual([row["total"] for row in result["results"]], [spell, 0, spell])
                        self.assertTrue(result["results"][1]["moon"])
                    else:
                        expected = min(15, count * 2) if fire else count
                        expected += (5 if water else 0) + (10 if pygmy else 0)
                        if air:
                            expected = 0
                        if earth:
                            expected = max(0, expected - 5)
                        self.assertEqual(result["shooter"], -1)
                        self.assertEqual(result["results"][1]["total"], expected)
                        self.assertEqual(result["results"][1]["fireCards"], count)
                        self.assertFalse(result["results"][1]["moon"])

    def test_pdf_takeover_endgame_exception_ties_floor_and_capture_flags(self):
        for fixture in pdf_takeover_fixtures():
            with self.subTest(case=fixture["label"]):
                before = copy.deepcopy(fixture)
                result = eng.score_round(fixture["piles"], fixture["previousScores"])
                self.assertEqual(fixture, before)
                assert_conservation([], fixture["piles"])
                self.assertEqual(result["shooter"], fixture["shooter"])
                self.assertEqual(result["spellName"], fixture["spellName"])
                self.assertEqual(result["spellPoints"], fixture["spell"])
                self.assertEqual(result["spellWithheld"], fixture["withheld"])
                self.assertEqual([row["total"] for row in result["results"]], fixture["deltas"])
                totals = [old + delta for old, delta in zip(fixture["previousScores"], fixture["deltas"])]
                self.assertTrue(all(total >= 0 for total in totals))
                if fixture["label"].endswith("zeroFloor"):
                    self.assertEqual(totals[fixture["shooter"]], 0)
                for seat, row in enumerate(result["results"]):
                    pile = fixture["piles"][seat]
                    self.assertEqual(row["fireCards"], sum(c["suit"] == "RED" and c["special"] != "fire" for c in pile))
                    for flag, special in (("fireWitch", "fire"), ("water", "water"),
                                          ("pygmy", "pygmy"), ("earth", "earth"), ("air", "air")):
                        self.assertEqual(row[flag], any(c["special"] == special for c in pile))
                    self.assertEqual(row["moon"], seat == fixture["shooter"])
                    self.assertEqual(row["spellVictim"], seat != fixture["shooter"])

    def test_threshold_and_tied_winners(self):
        self.assertFalse(eng.is_game_over([0, 69, 20]))
        self.assertTrue(eng.is_game_over([0, 70, 20]))
        self.assertTrue(eng.is_game_over([80, 0, 20]))
        self.assertEqual(eng.lowest_seats([8, 3, 3, 9]), [1, 2])
        self.assertEqual(eng.lowest_seats([0, 0, 0]), [0, 1, 2])

    def test_160_seeded_rounds_conserve_cards_and_bots_only_play_legal_cards(self):
        for n in range(3, 7):
            for seed in range(40):
                with self.subTest(players=n, seed=seed):
                    simulate_round(n, seed + n * 1000, seed)

    def test_32_seeded_complete_games_terminate(self):
        for n in range(3, 7):
            for seed in range(8):
                with self.subTest(players=n, seed=seed):
                    scores = [0] * n
                    round_index = 0
                    while not eng.is_game_over(scores) and round_index < 200:
                        result = simulate_round(n, n * 100000 + seed * 1000 + round_index, round_index, scores)
                        scores = [old + row["total"] for old, row in zip(scores, result["score"]["results"])]
                        round_index += 1
                    self.assertLess(round_index, 200)
                    self.assertTrue(eng.is_game_over(scores))
                    self.assertTrue(all(scores[seat] == min(scores) for seat in eng.lowest_seats(scores)))

    def test_malformed_configuration_and_decks_are_explicitly_rejected(self):
        for n in (0, 1, 2, 7, -1, 3.5, "4", None, True):
            with self.subTest(players=n):
                for action in (lambda: eng.deal_count(n), lambda: eng.deal(eng.make_deck(), n), lambda: eng.pass_info(n, 0)):
                    with self.assertRaises(ValueError):
                        action()
        for round_index in (-1, 0.5, "1", None, True):
            with self.assertRaises(ValueError):
                eng.pass_info(4, round_index)
        for deck in (eng.make_deck()[1:], eng.make_deck() + [BY_ID["W1"]], [BY_ID["W1"]] * 60):
            with self.assertRaises(ValueError):
                eng.deal(deck, 4)
        with self.assertRaises(ValueError):
            eng.resolve_trick([])
        with self.assertRaises(ValueError):
            eng.bot_play([], [])

    @unittest.skipUnless(shutil.which("node"), "Cross-engine parity requires Node.js")
    def test_python_javascript_cross_engine_parity(self):
        rng = random.Random(981731)
        corpus = {"passing": [], "tricks": [], "choices": [], "piles": [], "rounds": [],
                  "scoreHistories": [{"piles": fixture["piles"], "previousScores": fixture["previousScores"]}
                                     for fixture in pdf_takeover_fixtures()]}
        for n in range(3, 7):
            corpus["passing"].extend([[n, round_index] for round_index in range(16)])
            corpus["rounds"].extend([[n, n * 1000 + seed, seed] for seed in range(8)])
        corpus["tricks"].append([{"seat": i, "card": BY_ID[f"W{i + 1}"]} for i in range(4)])
        for _ in range(240):
            n = rng.randint(3, 6)
            cards = rng.sample(DECK, n)
            corpus["tricks"].append([{"seat": seat, "card": card} for seat, card in enumerate(cards)])
            remainder = [card for card in DECK if card not in cards]
            corpus["choices"].append({"hand": rng.sample(remainder, rng.randint(1, 20)),
                                      "trick": corpus["tricks"][-1][:rng.randint(0, n - 1)], "count": 2})
            shuffled = rng.sample(DECK, 60)
            corpus["piles"].append([shuffled[seat::n] for seat in range(n)])
        # Include every special combination as well as normally rare takeover piles.
        reds = [card for card in DECK if card["suit"] == "RED" and card["special"] != "fire"]
        specials = [BY_ID[card_id] for card_id in ("RED-11", "GREEN-11", "GREEN-12", "YELLOW-11", "BLUE-11")]
        for count in range(14):
            for mask in range(32):
                corpus["piles"].append([reds[:count] + [card for i, card in enumerate(specials) if mask & (1 << i)], [], []])
        expected = {
            "deck": eng.make_deck(),
            "passing": [{"count": eng.pass_info(n, round_index)[0], "dir": eng.pass_info(n, round_index)[1]}
                        for n, round_index in corpus["passing"]],
            "tricks": [{"lead": eng.lead_suit(trick), "winner": eng.resolve_trick(trick)} for trick in corpus["tricks"]],
            "choices": [{"legal": eng.legal_card_ids(row["hand"], row["trick"]), "play": eng.bot_play(row["hand"], row["trick"]),
                         "pass": eng.bot_pass(row["hand"], row["count"])} for row in corpus["choices"]],
            "scoring": [eng.score_round(piles) for piles in corpus["piles"]],
            "scoringWithHistory": [eng.score_round(row["piles"], row["previousScores"])
                                   for row in corpus["scoreHistories"]],
            "rounds": [simulate_round(n, seed, round_index) for n, seed, round_index in corpus["rounds"]],
        }
        script = Path(__file__).resolve().parents[2] / "frontend" / "tests" / "engine-stability.test.mjs"
        process = subprocess.run([shutil.which("node"), str(script), "--parity"], input=json.dumps(corpus),
                                 capture_output=True, text=True, encoding="utf-8", timeout=60, check=False)
        self.assertEqual(process.returncode, 0, process.stderr)
        actual = json.loads(process.stdout)
        for section in expected:
            self.assertEqual(actual[section], expected[section], f"cross-engine mismatch in {section}")


if __name__ == "__main__":
    unittest.main()
