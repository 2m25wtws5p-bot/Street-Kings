"""Server-authoritative game logic for the Witches card game (Python port)."""
import random

SUIT_ORDER = ["RED", "YELLOW", "BLUE", "GREEN"]
WIN_THRESHOLD = 70


def make_deck():
    cards = []
    for suit in SUIT_ORDER:
        for v in range(1, 15):
            special = None
            if suit == "RED" and v == 11:
                special = "fire"
            elif suit == "GREEN" and v == 11:
                special = "water"  # Informant (+5)
            elif suit == "YELLOW" and v == 11:
                special = "earth"  # Schmierer (-5)
            elif suit == "BLUE" and v == 11:
                special = "air"  # Fixer (neutralisiert)
            elif suit == "GREEN" and v == 12:
                special = "pygmy"
            cards.append({"id": f"{suit}-{v}", "suit": suit, "value": v, "special": special})
    for i in range(1, 5):
        cards.append({"id": f"W{i}", "suit": None, "value": 0, "special": "wizard"})
    return cards


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
    counts = {3: 4, 4: 3, 5: 2, 6: 2}
    count = counts[n]
    if n in (3, 5):
        dirs = [1, -1]
    else:
        dirs = [1, -1, n // 2, 0]
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
    return [c["id"] for c in hand if c["suit"] == lead or c["special"] == "wizard"]


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


def score_round(piles):
    n = len(piles)
    results = [
        {"fireCards": 0, "fireWitch": False, "water": False, "pygmy": False, "earth": False, "air": False, "total": 0, "moon": False}
        for _ in range(n)
    ]
    shooter = -1
    for seat, pile in enumerate(piles):
        all_red = len([c for c in pile if c["suit"] == "RED"]) == 14
        green_special = any(c["special"] in ("water", "pygmy") for c in pile)
        if all_red and green_special:
            shooter = seat
    if shooter >= 0:
        s = piles[shooter]
        has_water = any(c["special"] == "water" for c in s)
        has_pygmy = any(c["special"] == "pygmy" for c in s)
        spell = 15 + (5 if has_water else 0) + (10 if has_pygmy else 0)  # 20 / 25 / 30
        if has_water and has_pygmy:
            name = "Großer Takeover"
        elif has_pygmy:
            name = "Patin-Takeover"
        else:
            name = "Takeover"
        for seat, pile in enumerate(piles):
            if seat == shooter:
                results[seat] = {"fireCards": 13, "fireWitch": True, "water": has_water, "pygmy": has_pygmy, "earth": False, "air": False, "total": 0, "moon": True}
            else:
                results[seat] = {"fireCards": 0, "fireWitch": False, "water": False, "pygmy": False, "earth": False, "air": False, "total": spell, "moon": False, "spellVictim": True}
        return {"results": results, "shooter": shooter, "spellName": name}

    for seat, pile in enumerate(piles):
        red_pts = len([c for c in pile if c["suit"] == "RED" and c["special"] != "fire"])
        fire_witch = any(c["special"] == "fire" for c in pile)
        air = any(c["special"] == "air" for c in pile)
        water = any(c["special"] == "water" for c in pile)
        pygmy = any(c["special"] == "pygmy" for c in pile)
        earth = any(c["special"] == "earth" for c in pile)
        base = red_pts
        if fire_witch:
            base = min(base * 2, 15)
        total = base
        if water and not air:
            total += 5
        if pygmy and not air:
            total += 10
        if earth:
            total = max(total - 5, 0)
        results[seat] = {"fireCards": red_pts, "fireWitch": fire_witch, "water": water, "pygmy": pygmy, "earth": earth, "air": air, "total": total, "moon": False}
    return {"results": results, "shooter": -1, "spellName": None}


def is_game_over(scores):
    return any(s >= WIN_THRESHOLD for s in scores)


def lowest_seats(scores):
    m = min(scores)
    return [i for i, s in enumerate(scores) if s == m]


# ---------- Bots ----------
def card_danger(c):
    sp = c["special"]
    if sp == "wizard":
        return -5
    if sp == "earth":
        return -25
    if sp == "air":
        return -15
    if sp == "pygmy":
        return 45
    if sp == "water":
        return 32
    if sp == "fire":
        return 27
    if c["suit"] == "RED":
        return 12 + c["value"]
    return c["value"] * 0.4


def bot_pass(hand, count):
    return [c["id"] for c in sorted(hand, key=card_danger, reverse=True)[:count]]


def _lead_pref(c):
    sp = c["special"]
    if sp == "wizard":
        return 3
    if sp == "pygmy":
        return 95
    if sp == "water":
        return 85
    if sp == "fire":
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
    trick_pen = any(t["card"]["suit"] == "RED" or t["card"]["special"] in ("water", "pygmy") for t in trick)
    if not has_lead:
        nonwiz = [c for c in legal if c["special"] != "wizard"]
        pool = nonwiz if nonwiz else legal
        return sorted(pool, key=card_danger, reverse=True)[0]["id"]
    lead_cards = [c for c in legal if c["suit"] == lead]
    cur_max = max(t["card"]["value"] for t in trick if t["card"]["suit"] == lead)
    safe = [c for c in lead_cards if c["value"] < cur_max]
    if safe:
        return sorted(safe, key=lambda c: c["value"], reverse=True)[0]["id"]
    wiz = next((c for c in legal if c["special"] == "wizard"), None)
    if trick_pen and wiz:
        return wiz["id"]
    return sorted(lead_cards, key=lambda c: c["value"])[0]["id"]
