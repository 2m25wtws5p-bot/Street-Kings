"""Tests for updated Street Kings rules, replace-with-bot and rematch endpoints."""
import os
import time
import uuid
import pytest
import requests

import sys
sys.path.insert(0, "/app/backend")
import street_kings_engine as eng

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

AV_A = {"key": "boss", "label": "Boss", "icon": "crown", "color": "#C084FC"}
AV_B = {"key": "dealer", "label": "Dealer", "icon": "banknote", "color": "#F472B6"}


# ---------- Engine unit tests ----------
def _by_id(deck, cid):
    return next(c for c in deck if c["id"] == cid)


def test_make_deck_specials_mapping():
    deck = eng.make_deck()
    assert _by_id(deck, "RED-11")["special"] == "kingpin"
    assert _by_id(deck, "GREEN-11")["special"] == "informant"
    assert _by_id(deck, "YELLOW-11")["special"] == "briber"
    assert _by_id(deck, "BLUE-11")["special"] == "fixer"
    assert _by_id(deck, "GREEN-12")["special"] == "godmother"
    runners = [c for c in deck if c["special"] == "runner"]
    assert len(runners) == 4
    assert all(w["value"] == 0 and w["suit"] is None for w in runners)


def test_pass_info_counts():
    assert eng.pass_info(3, 0)[0] == 4
    assert eng.pass_info(4, 0)[0] == 3
    assert eng.pass_info(5, 0)[0] == 3
    assert eng.pass_info(6, 0)[0] == 2


def _red_cards_all_14():
    d = eng.make_deck()
    return [c for c in d if c["suit"] == "RED"]


def _card(deck, cid):
    return _by_id(deck, cid)


def test_score_round_takeover_variants():
    deck = eng.make_deck()
    reds = _red_cards_all_14()
    informant = _card(deck, "GREEN-11")
    godmother = _card(deck, "GREEN-12")

    # No informant/patin -> NOT takeover. Just normal scoring:
    # shooter's pile: all 14 reds (kingpin special in it). red_pts = 13 (excl kingpin), kingpin doubles -> 26, capped 15.
    piles = [list(reds), [], []]
    res = eng.score_round(piles)
    assert res["shooter"] == -1
    assert res["results"][0]["total"] == 15
    assert res["results"][1]["total"] == 0

    # + informant only -> Takeover 20
    piles = [list(reds) + [informant], [], []]
    res = eng.score_round(piles)
    assert res["shooter"] == 0
    assert res["results"][0]["total"] == 0
    assert res["results"][1]["total"] == 20
    assert res["results"][2]["total"] == 20

    # + godmother only -> 25
    piles = [list(reds) + [godmother], [], []]
    res = eng.score_round(piles)
    assert res["shooter"] == 0
    assert res["results"][1]["total"] == 25

    # + both -> 30
    piles = [list(reds) + [informant, godmother], [], []]
    res = eng.score_round(piles)
    assert res["shooter"] == 0
    assert res["results"][1]["total"] == 30
    assert res["results"][0]["total"] == 0


def test_score_round_normal_scoring():
    deck = eng.make_deck()
    informant = _card(deck, "GREEN-11")
    godmother = _card(deck, "GREEN-12")
    briber = _card(deck, "YELLOW-11")
    fixer = _card(deck, "BLUE-11")
    kingpin = _card(deck, "RED-11")
    red2 = _card(deck, "RED-2")
    red3 = _card(deck, "RED-3")

    # informant +5, no fixer -> +5
    piles = [[informant], [], []]
    r = eng.score_round(piles)["results"]
    assert r[0]["total"] == 5

    # informant + fixer -> 0
    piles = [[informant, fixer], [], []]
    r = eng.score_round(piles)["results"]
    assert r[0]["total"] == 0

    # godmother +10, no fixer
    piles = [[godmother], [], []]
    assert eng.score_round(piles)["results"][0]["total"] == 10

    # godmother + fixer -> 0
    assert eng.score_round([[godmother, fixer], [], []])["results"][0]["total"] == 0

    # The blue special clears the complete pile, including red/kingpin points.
    assert eng.score_round([[red2, red3, fixer], [], []])["results"][0]["total"] == 0
    assert eng.score_round([[red2, red3, kingpin, informant, godmother, fixer], [], []])["results"][0]["total"] == 0

    # briber -5 min 0 (alone -> 0)
    assert eng.score_round([[briber], [], []])["results"][0]["total"] == 0

    # 2 red + briber -> 2 - 5 -> min 0
    assert eng.score_round([[red2, red3, briber], [], []])["results"][0]["total"] == 0

    # kingpin special doubles red pts capped 15: 2 red + kingpin => 2*2 = 4
    assert eng.score_round([[red2, red3, kingpin], [], []])["results"][0]["total"] == 4


def test_api_3player_pass_count_is_4():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/rooms", json={"name": "H", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["n"] == 3
    assert v["passCount"] == 4


# ---------- Replace-with-bot ----------
@pytest.fixture
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _create_started_room_with_luca(s):
    r = s.post(f"{API}/rooms", json={"name": "Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    rj = s.post(f"{API}/rooms/{code}/join", json={"name": "Luca", "avatar": AV_B}).json()
    luca_tok, luca_seat = rj["token"], rj["seat"]
    s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200
    return code, host, luca_tok, luca_seat


def test_replace_while_connected_returns_409(s):
    code, host, luca_tok, luca_seat = _create_started_room_with_luca(s)
    # Luca just joined -> still connected
    r = s.post(f"{API}/rooms/{code}/replace", json={"token": host, "seat": luca_seat})
    assert r.status_code == 409, r.text


def test_replace_non_host_forbidden(s):
    code, host, luca_tok, luca_seat = _create_started_room_with_luca(s)
    time.sleep(11.5)
    # Do NOT poll with Luca -> she is offline. But non-host tries to replace her:
    r = s.post(f"{API}/rooms/{code}/replace", json={"token": luca_tok, "seat": luca_seat})
    assert r.status_code == 403, r.text


def test_replace_offline_luca_success(s):
    code, host, luca_tok, luca_seat = _create_started_room_with_luca(s)
    time.sleep(11.5)
    r = s.post(f"{API}/rooms/{code}/replace", json={"token": host, "seat": luca_seat})
    assert r.status_code == 200, r.text
    v = r.json()
    p = next(pp for pp in v["players"] if pp["seat"] == luca_seat)
    assert p["isBot"] is True
    assert p["name"].endswith("(KI)"), p["name"]
    # bot should have auto-passed if still in passing phase
    if v["phase"] == "passing":
        assert v["passedSeats"][luca_seat] is True


def test_replace_bot_seat_400(s):
    code, host, _, _ = _create_started_room_with_luca(s)
    # seat 2 is the bot we added
    r = s.post(f"{API}/rooms/{code}/replace", json={"token": host, "seat": 2})
    assert r.status_code == 400, r.text


def test_replace_self_seat_400(s):
    code, host, _, _ = _create_started_room_with_luca(s)
    r = s.post(f"{API}/rooms/{code}/replace", json={"token": host, "seat": 0})
    assert r.status_code == 400, r.text


# ---------- Rematch ----------
def test_rematch_before_game_over_409(s):
    code, host, _, _ = _create_started_room_with_luca(s)
    r = s.post(f"{API}/rooms/{code}/rematch", json={"token": host})
    assert r.status_code == 409


def test_rematch_non_host_403(s):
    # create finished game with only bots so we can push to gameOver by host acting.
    r = s.post(f"{API}/rooms", json={"name": "Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r2 = s.post(f"{API}/rooms/{code}/join", json={"name": "Guest", "avatar": AV_B})
    guest = r2.json()["token"]
    # too many players now (4). Remove a bot.
    s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "remove"})
    s.post(f"{API}/rooms/{code}/start", json={"token": host})
    # game running (not gameOver) -> rematch should 409 regardless, but for non-host still 403:
    r = s.post(f"{API}/rooms/{code}/rematch", json={"token": guest})
    assert r.status_code == 403


def _drive_to_game_over(s, code, host_tok):
    """Loop host actions with bots doing rest until phase=gameOver."""
    for _ in range(2000):
        v = s.get(f"{API}/rooms/{code}?token={host_tok}").json()
        phase = v["phase"]
        if v["status"] == "gameOver":
            return v
        if phase == "passing" and not v.get("iPassed"):
            hand_ids = [c["id"] for c in v["yourHand"]]
            r = s.post(f"{API}/rooms/{code}/action", json={"token": host_tok, "type": "pass", "cards": hand_ids[: v["passCount"]]})
            assert r.status_code == 200, r.text
        elif phase == "playing" and v["currentSeat"] == v["yourSeat"]:
            # play first legal-looking card: just try each until 200
            for cid in [c["id"] for c in v["yourHand"]]:
                r = s.post(f"{API}/rooms/{code}/action", json={"token": host_tok, "type": "play", "cardId": cid})
                if r.status_code == 200:
                    break
            else:
                raise AssertionError("No legal card found")
        elif phase == "trickEnd":
            r = s.post(f"{API}/rooms/{code}/action", json={"token": host_tok, "type": "continueTrick"})
            assert r.status_code in (200, 403)
            if r.status_code == 403:
                # not the winner - try continueTrick with host (allowed) - already host token. Weird.
                pass
        elif phase == "roundScores":
            r = s.post(f"{API}/rooms/{code}/action", json={"token": host_tok, "type": "nextRound", "roundId": v["roundId"]})
            assert r.status_code == 200, r.text
        else:
            # possibly bot turn - just poll again
            time.sleep(0.05)
    raise AssertionError("Did not reach gameOver in time")


def test_rematch_after_game_over(s):
    # only-bots game (host + 2 bots) so bots auto-play everything -> we just poll & call nextRound.
    host_name = f"Rematch-{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/rooms", json={"name": host_name, "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    s.post(f"{API}/rooms/{code}/start", json={"token": host})
    v = _drive_to_game_over(s, code, host)
    assert v["status"] == "gameOver"

    # Inspect only this match; global counts can grow in parallel CI workers.
    def own_results():
        response = s.get(f"{API}/games/recent?limit=100")
        assert response.status_code == 200, response.text
        return [game for game in response.json()
                if any(score["name"] == host_name for score in game["scores"])]

    recorded = own_results()
    assert len(recorded) == 1
    recorded_id = recorded[0]["id"]

    # rematch
    r = s.post(f"{API}/rooms/{code}/rematch", json={"token": host})
    assert r.status_code == 200, r.text
    v2 = r.json()
    assert v2["status"] == "playing"
    assert v2["phase"] in ("passing", "playing")
    assert v2["roundIndex"] == 0
    assert all(sc == 0 for sc in v2["scores"])
    # hands dealt
    assert len(v2["yourHand"]) > 0

    # Should not double-record
    assert [game["id"] for game in own_results()] == [recorded_id]
