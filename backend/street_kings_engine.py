"""Server-authoritative rules and bot strategy for Street Kings."""
import random

SUIT_ORDER = ["RED", "YELLOW", "BLUE", "GREEN"]
WIN_THRESHOLD = 70


def make_deck():
    cards = []
    for suit in SUIT_ORDER:
        for v in range(1, 15):
            special = None
            if suit == "RED" and v == 11:
                special = "kingpin"
            elif suit == "GREEN" and v == 11:
                special = "informant"  # Informant (+5)
            elif suit == "YELLOW" and v == 11:
                special = "briber"  # Schmierer (-5)
            elif suit == "BLUE" and v == 11:
                special = "fixer"  # Fixer (neutralisiert)
            elif suit == "GREEN" and v == 12:
                special = "godmother"
            cards.append({"id": f"{suit}-{v}", "suit": suit, "value": v, "special": special})
    for i in range(1, 5):
        cards.append({"id": f"W{i}", "suit": None, "value": 0, "special": "runner"})
    return cards


def normalize_room_cards(room):
    """Upgrade card metadata on a database copy without changing ownership.

    Stable suit/rank identities, not old theme strings, define each special.
    Scores, actions, physical card IDs, tokens and persistence versions stay
    untouched. The caller's next normal authenticated save persists the upgrade.
    """
    identities = {(card["suit"], card["value"]): card["special"] for card in make_deck()}

    def cards_in(value):
        if isinstance(value, dict):
            if "suit" in value and "value" in value and "id" in value:
                identity = (value["suit"], value["value"])
                if type(value["value"]) is int and value["suit"] in (None, "RED", "YELLOW", "BLUE", "GREEN") and identity in identities:
                    value["special"] = identities[identity]
            else:
                for nested in value.values():
                    cards_in(nested)
        elif isinstance(value, list):
            for nested in value:
                cards_in(nested)

    for field in ("hands", "piles", "trick", "lastTrick", "exchangeHistory"):
        cards_in(room.get(field))

    result = room.get("roundResult")
    piles = room.get("piles")
    scores = room.get("scores")
    rows = result.get("results") if isinstance(result, dict) else None
    if (isinstance(rows, list) and rows and isinstance(rows[0], dict) and "heatCards" not in rows[0]
            and isinstance(piles, list) and isinstance(scores, list)
            and len(rows) == len(piles) == len(scores)
            and all(isinstance(pile, list) for pile in piles)
            and sum(len(pile) for pile in piles) == 60
            and all(isinstance(row, dict) and type(row.get("total")) in (int, float) for row in rows)
            and all(type(score) in (int, float) for score in scores)):
        previous = [score - row["total"] for score, row in zip(scores, rows)]
        rebuilt = score_round(piles, previous)
        # Even historical results scored by an older deployment remain exact.
        # Only explanatory metadata is rebuilt, never the awarded points.
        for row, awarded in zip(rebuilt["results"], rows):
            row["total"] = awarded["total"]
        room["roundResult"] = rebuilt
    return room


def shuffle(deck):
    d = list(deck)
    random.shuffle(d)
    return d


def _validate_player_count(n):
    # Never silently discard/over-deal cards for a corrupted saved setup.
    if type(n) is not int or not 3 <= n <= 6:
        raise ValueError("Player count must be an integer between 3 and 6")


def deal_count(n):
    _validate_player_count(n)
    return 60 // n


def _sort_key(c):
    order = {"RED": 0, "YELLOW": 1, "BLUE": 2, "GREEN": 3, None: 4}
    return (order.get(c["suit"], 4), c["value"])


def deal(deck, n):
    count = deal_count(n)
    if (not isinstance(deck, (list, tuple)) or len(deck) != 60
            or any(not isinstance(card, dict) or not isinstance(card.get("id"), str) for card in deck)
            or len({card["id"] for card in deck}) != 60):
        raise ValueError("A deal requires exactly 60 uniquely identified cards")
    hands = [[] for _ in range(n)]
    idx = 0
    for seat in range(n):
        for _ in range(count):
            hands[seat].append(deck[idx])
            idx += 1
    for h in hands:
        h.sort(key=_sort_key)
    return hands


def pass_info(n, round_index):
    _validate_player_count(n)
    if type(round_index) is not int or round_index < 0:
        raise ValueError("Round index must be a nonnegative integer")
    counts = {3: 4, 4: 3, 5: 3, 6: 2}
    count = counts[n]
    if n in (3, 5):
        dirs = [1, -1]
    else:
        dirs = [1, -1, n // 2]
    d = dirs[round_index % len(dirs)]
    return count, d


def target_seat(seat, d, n):
    return (seat + d) % n


def lead_suit(trick):
    for t in trick:
        if t["card"]["suit"] is not None:
            return t["card"]["suit"]
    return None


def legal_card_ids(hand, trick):
    if not trick:
        return [c["id"] for c in hand]
    lead = lead_suit(trick)
    if lead is None:
        return [c["id"] for c in hand]
    has_lead = any(c["suit"] == lead for c in hand)
    if not has_lead:
        return [c["id"] for c in hand]
    return [c["id"] for c in hand if c["suit"] == lead or c["special"] == "runner"]


def resolve_trick(trick):
    if not trick:
        raise ValueError("Cannot resolve an empty trick")
    lead_entry = next((t for t in trick if t["card"]["suit"] is not None), None)
    if lead_entry is None:
        return trick[0]["seat"]
    lead = lead_entry["card"]["suit"]
    winner = None
    for t in trick:
        if t["card"]["suit"] == lead:
            if winner is None or t["card"]["value"] > winner["card"]["value"]:
                winner = t
    return winner["seat"]


def score_round(piles, previous_scores=None):
    n = len(piles)
    results = [
        {"heatCards": 0, "kingpin": False, "informant": False, "godmother": False, "briber": False, "fixer": False, "total": 0, "moon": False}
        for _ in range(n)
    ]
    shooter = -1
    for seat, pile in enumerate(piles):
        all_red = len([c for c in pile if c["suit"] == "RED"]) == 14
        green_special = any(c["special"] in ("informant", "godmother") for c in pile)
        if all_red and green_special:
            shooter = seat
    if shooter >= 0:
        s = piles[shooter]
        has_informant = any(c["special"] == "informant" for c in s)
        has_godmother = any(c["special"] == "godmother" for c in s)
        takeover = 15 + (5 if has_informant else 0) + (10 if has_godmother else 0)  # 20 / 25 / 30
        if has_informant and has_godmother:
            name = "Großer Takeover"
        elif has_godmother:
            name = "Patin-Takeover"
        else:
            name = "Takeover"
        projected = None if previous_scores is None else [score + (0 if seat == shooter else takeover) for seat, score in enumerate(previous_scores)]
        takeover_withheld = projected is not None and is_game_over(projected) and any(seat != shooter for seat in lowest_seats(projected))
        for seat, pile in enumerate(piles):
            results[seat] = {
                "heatCards": sum(c["suit"] == "RED" and c["special"] != "kingpin" for c in pile),
                "kingpin": any(c["special"] == "kingpin" for c in pile),
                "informant": any(c["special"] == "informant" for c in pile),
                "godmother": any(c["special"] == "godmother" for c in pile),
                "briber": any(c["special"] == "briber" for c in pile),
                "fixer": any(c["special"] == "fixer" for c in pile),
                "total": (-min(previous_scores[seat], takeover) if seat == shooter else 0) if takeover_withheld else (0 if seat == shooter else takeover),
                "moon": seat == shooter,
                "takeoverVictim": seat != shooter,
            }
        return {"results": results, "shooter": shooter, "takeoverName": name, "takeoverPoints": takeover, "takeoverWithheld": takeover_withheld}

    for seat, pile in enumerate(piles):
        red_pts = len([c for c in pile if c["suit"] == "RED" and c["special"] != "kingpin"])
        kingpin = any(c["special"] == "kingpin" for c in pile)
        fixer = any(c["special"] == "fixer" for c in pile)
        informant = any(c["special"] == "informant" for c in pile)
        godmother = any(c["special"] == "godmother" for c in pile)
        briber = any(c["special"] == "briber" for c in pile)
        base = red_pts
        if kingpin:
            base = min(base * 2, 15)
        total = base
        if informant:
            total += 5
        if godmother:
            total += 10
        if fixer:
            total = 0
        if briber:
            total = max(total - 5, 0)
        results[seat] = {"heatCards": red_pts, "kingpin": kingpin, "informant": informant, "godmother": godmother, "briber": briber, "fixer": fixer, "total": total, "moon": False}
    return {"results": results, "shooter": -1, "takeoverName": None}


def is_game_over(scores):
    return any(s >= WIN_THRESHOLD for s in scores)


def lowest_seats(scores):
    m = min(scores)
    return [i for i, s in enumerate(scores) if s == m]


# ---------- Bots ----------
def card_danger(c):
    sp = c["special"]
    if sp == "runner":
        return -5
    if sp == "briber":
        return -25
    if sp == "fixer":
        return -15
    if sp == "godmother":
        return 45
    if sp == "informant":
        return 32
    if sp == "kingpin":
        return 27
    if c["suit"] == "RED":
        return 12 + c["value"]
    return c["value"] * 0.4


def bot_pass(hand, count):
    return [c["id"] for c in sorted(hand, key=card_danger, reverse=True)[:count]]


def _lead_pref(c):
    sp = c["special"]
    if sp == "runner":
        return 3
    if sp == "godmother":
        return 95
    if sp == "informant":
        return 85
    if sp == "kingpin":
        return 55
    if c["suit"] == "RED":
        return 40 + c["value"]
    return c["value"]


def bot_play(hand, trick):
    if not hand:
        raise ValueError("Cannot choose a card from an empty hand")
    legal_set = set(legal_card_ids(hand, trick))
    legal = [c for c in hand if c["id"] in legal_set]
    if not legal:
        return hand[0]["id"]
    if not trick:
        return sorted(legal, key=_lead_pref)[0]["id"]
    lead = lead_suit(trick)
    has_lead = any(c["suit"] == lead for c in hand)
    trick_pen = any(t["card"]["suit"] == "RED" or t["card"]["special"] in ("informant", "godmother") for t in trick)
    if not has_lead:
        non_runner = [c for c in legal if c["special"] != "runner"]
        pool = non_runner if non_runner else legal
        return sorted(pool, key=card_danger, reverse=True)[0]["id"]
    lead_cards = [c for c in legal if c["suit"] == lead]
    cur_max = max(t["card"]["value"] for t in trick if t["card"]["suit"] == lead)
    safe = [c for c in lead_cards if c["value"] < cur_max]
    if safe:
        return sorted(safe, key=lambda c: c["value"], reverse=True)[0]["id"]
    runner = next((c for c in legal if c["special"] == "runner"), None)
    if trick_pen and runner:
        return runner["id"]
    return sorted(lead_cards, key=lambda c: c["value"])[0]["id"]
