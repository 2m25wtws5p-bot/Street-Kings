"""Backend tests for online multiplayer rooms."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

AVATAR_A = {"key": "witch1", "label": "Wanda", "icon": "hat", "color": "#8B5CF6"}
AVATAR_B = {"key": "witch2", "label": "Willow", "icon": "moon", "color": "#EC4899"}
AVATAR_C = {"key": "witch3", "label": "Circe", "icon": "star", "color": "#10B981"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- room create / join ----------

def test_create_room(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(["code", "token", "seat"]).issubset(d.keys())
    assert isinstance(d["code"], str) and len(d["code"]) == 5
    assert d["seat"] == 0


def test_join_room_and_full(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code = r.json()["code"]
    tokens = [r.json()["token"]]
    # join 5 more to fill to 6
    for i in range(5):
        r = s.post(f"{API}/rooms/{code}/join", json={"name": f"TEST_P{i}", "avatar": AVATAR_B})
        assert r.status_code == 200, r.text
        assert r.json()["seat"] == i + 1
        tokens.append(r.json()["token"])
    # 7th should fail
    r = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P7", "avatar": AVATAR_B})
    assert r.status_code == 409


def test_bot_management_host_only(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code, host = r.json()["code"], r.json()["token"]
    # non-host token forbidden
    r2 = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P1", "avatar": AVATAR_B})
    other = r2.json()["token"]
    r = s.post(f"{API}/rooms/{code}/bots", json={"token": other, "action": "add"})
    assert r.status_code == 403
    # host add bot
    r = s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    assert r.status_code == 200
    assert len([p for p in r.json()["players"] if p["isBot"]]) == 1
    # remove bot
    r = s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "remove"})
    assert r.status_code == 200
    assert len([p for p in r.json()["players"] if p["isBot"]]) == 0


def test_start_requires_3_players(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code, host = r.json()["code"], r.json()["token"]
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 400
    # add 2 bots, then start
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["phase"] in ("passing", "playing")
    assert d["status"] == "playing"
    # start again should 409
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 409


def test_start_host_only(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code = r.json()["code"]
    r2 = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P1", "avatar": AVATAR_B})
    other = r2.json()["token"]
    r = s.post(f"{API}/rooms/{code}/start", json={"token": other})
    assert r.status_code == 403


def test_join_after_start_rejected(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200
    r = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_Late", "avatar": AVATAR_B})
    assert r.status_code == 409


# ---------- redaction ----------

def test_redaction_hides_other_hands(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code, host = r.json()["code"], r.json()["token"]
    r2 = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P1", "avatar": AVATAR_B})
    p1 = r2.json()["token"]
    r3 = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P2", "avatar": AVATAR_C})
    p2 = r3.json()["token"]
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200

    v_host = s.get(f"{API}/rooms/{code}?token={host}").json()
    v_p1 = s.get(f"{API}/rooms/{code}?token={p1}").json()
    v_p2 = s.get(f"{API}/rooms/{code}?token={p2}").json()

    assert v_host["yourSeat"] == 0
    assert v_p1["yourSeat"] == 1
    assert v_p2["yourSeat"] == 2
    # each sees their own hand
    assert len(v_host["yourHand"]) > 0
    assert len(v_p1["yourHand"]) > 0
    # handCounts publish; but never other players' cards leak in the view
    for v in (v_host, v_p1, v_p2):
        # no key exposing other hands
        keys = set(v.keys())
        for banned in ("hands", "allHands"):
            assert banned not in keys

    # unknown token
    v_none = s.get(f"{API}/rooms/{code}?token=doesnotexist").json()
    assert v_none["yourSeat"] is None
    assert v_none["yourHand"] == []


# ---------- action validation ----------

def test_action_out_of_turn_and_illegal(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code, host = r.json()["code"], r.json()["token"]
    r2 = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P1", "avatar": AVATAR_B})
    p1 = r2.json()["token"]
    r3 = s.post(f"{API}/rooms/{code}/join", json={"name": "TEST_P2", "avatar": AVATAR_C})
    p2 = r3.json()["token"]
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200
    view = r.json()

    if view["phase"] == "passing":
        # invalid pass count
        r = s.post(f"{API}/rooms/{code}/action",
                   json={"token": host, "type": "pass", "cards": ["bad"]})
        assert r.status_code == 400
        # play in passing phase invalid
        r = s.post(f"{API}/rooms/{code}/action",
                   json={"token": host, "type": "play", "cardId": "x"})
        assert r.status_code == 409
    # unknown player token
    r = s.post(f"{API}/rooms/{code}/action",
               json={"token": "nobody", "type": "pass", "cards": []})
    assert r.status_code == 403


# ---------- e2e host + bots full game to gameOver ----------

def test_full_game_host_plus_bots_completes(s):
    """Host + 2 bots. Human passes cards, then plays legal cards each turn.
    Bots auto-play. Continue tricks until round completes. Assert scoring updates."""
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AVATAR_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200
    view = r.json()

    # passing: host passes correct count
    if view["phase"] == "passing":
        pc = view["passCount"]
        cards = [c["id"] for c in view["yourHand"][:pc]]
        r = s.post(f"{API}/rooms/{code}/action",
                   json={"token": host, "type": "pass", "cards": cards})
        assert r.status_code == 200, r.text
        view = r.json()
        assert view["phase"] in ("playing", "trickEnd", "roundScores")

    safety = 400
    saw_round_end = False
    while safety > 0:
        safety -= 1
        phase = view["phase"]
        if phase == "playing":
            if view["currentSeat"] != view["yourSeat"]:
                # bots should have advanced; force refresh
                view = s.get(f"{API}/rooms/{code}?token={host}").json()
                continue
            # play first legal card following suit if possible
            hand = view["yourHand"]
            trick = view["trick"]
            if trick:
                # Laufjungen (value 0) do not establish the lead suit.
                lead = next((entry["card"]["suit"] for entry in trick
                             if entry["card"]["value"] != 0), None)
                follow = [c for c in hand if c["suit"] == lead]
                pick = follow[0] if follow else hand[0]
            else:
                pick = hand[0]
            r = s.post(f"{API}/rooms/{code}/action",
                       json={"token": host, "type": "play", "cardId": pick["id"]})
            assert r.status_code == 200, r.text
            view = r.json()
        elif phase == "trickEnd":
            # host may continue as host even if not winner
            r = s.post(f"{API}/rooms/{code}/action",
                       json={"token": host, "type": "continueTrick"})
            assert r.status_code == 200, r.text
            view = r.json()
        elif phase == "roundScores":
            saw_round_end = True
            assert "scores" in view and sum(view["scores"]) >= 0
            r = s.post(f"{API}/rooms/{code}/action",
                       json={"token": host, "type": "nextRound", "roundId": view["roundId"]})
            assert r.status_code == 200, r.text
            view = r.json()
            # sanity: after nextRound, should be back to passing/playing OR gameOver
            assert view["phase"] in ("passing", "playing", "trickEnd", "gameOver")
            break  # we only need to exercise one full round for this test
        elif phase == "passing":
            pc = view["passCount"]
            cards = [c["id"] for c in view["yourHand"][:pc]]
            r = s.post(f"{API}/rooms/{code}/action",
                       json={"token": host, "type": "pass", "cards": cards})
            assert r.status_code == 200, r.text
            view = r.json()
        elif phase == "gameOver":
            break
        else:
            break

    assert saw_round_end, "Round did not complete within safety budget"
