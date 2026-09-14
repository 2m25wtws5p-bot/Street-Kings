"""New tests for Street Kings reskin: German API, spectator mode, reconnect-by-name, bot names."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

AV_A = {"key": "boss", "label": "Boss", "icon": "crown", "color": "#C084FC"}
AV_B = {"key": "dealer", "label": "Dealer", "icon": "banknote", "color": "#F472B6"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---- German API root ----
def test_api_root_is_street_kings(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "Street Kings API"


# ---- Spectator mode ----
def test_watch_room_returns_spec_token(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AV_A})
    code = r.json()["code"]
    r = s.post(f"{API}/rooms/{code}/watch", json={"name": "TEST_Watcher"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["spectator"] is True
    assert d["token"].startswith("spec-")
    assert d["seat"] is None


def test_spectator_view_hides_hand_and_lists_in_spectators(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    r = s.post(f"{API}/rooms/{code}/watch", json={"name": "TEST_Watcher"})
    spec_tok = r.json()["token"]
    r = s.post(f"{API}/rooms/{code}/start", json={"token": host})
    assert r.status_code == 200
    v = s.get(f"{API}/rooms/{code}?token={spec_tok}").json()
    assert v["isSpectator"] is True
    assert v["yourSeat"] is None
    assert v["yourHand"] == []
    assert "TEST_Watcher" in v["spectators"]
    # players list has 'connected'
    for p in v["players"]:
        assert "connected" in p


def test_spectator_cannot_post_action(s):
    r = s.post(f"{API}/rooms", json={"name": "TEST_Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    spec = s.post(f"{API}/rooms/{code}/watch", json={"name": "Spy"}).json()["token"]
    s.post(f"{API}/rooms/{code}/start", json={"token": host})
    r = s.post(f"{API}/rooms/{code}/action",
               json={"token": spec, "type": "pass", "cards": []})
    assert r.status_code == 403


# ---- Reconnect by name ----
def test_duplicate_name_while_connected_returns_409_german(s):
    r = s.post(f"{API}/rooms", json={"name": "Luca", "avatar": AV_A})
    code = r.json()["code"]
    r = s.post(f"{API}/rooms/{code}/join", json={"name": "LUCA", "avatar": AV_B})
    assert r.status_code == 409
    assert "vergeben" in r.json().get("detail", "").lower() or "vergeben" in r.text.lower()


def test_reconnect_by_name_after_offline_takes_seat_and_hand(s):
    # Host + Luca + bot -> start. Then Luca stops polling; wait >10s; rejoin as luca.
    r = s.post(f"{API}/rooms", json={"name": "Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    r = s.post(f"{API}/rooms/{code}/join", json={"name": "Luca", "avatar": AV_B})
    luca_old_tok = r.json()["token"]
    luca_seat = r.json()["seat"]
    s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    s.post(f"{API}/rooms/{code}/start", json={"token": host})
    # capture luca's hand
    v_before = s.get(f"{API}/rooms/{code}?token={luca_old_tok}").json()
    hand_before = [c["id"] for c in v_before["yourHand"]]
    assert hand_before, "Luca should have a hand after start"

    # Wait for Luca to be considered offline (>10s)
    time.sleep(11.5)
    # Host polls should NOT touch Luca's last_seen (host only refreshes own)
    hv = s.get(f"{API}/rooms/{code}?token={host}").json()
    luca_pub = next(p for p in hv["players"] if p["name"].lower() == "luca")
    assert luca_pub["connected"] is False, "Luca should show offline"

    # Rejoin with case-insensitive name
    r = s.post(f"{API}/rooms/{code}/join", json={"name": "luca", "avatar": AV_B})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("rejoined") is True
    assert d["seat"] == luca_seat
    new_tok = d["token"]
    v_after = s.get(f"{API}/rooms/{code}?token={new_tok}").json()
    hand_after = [c["id"] for c in v_after["yourHand"]]
    assert set(hand_after) == set(hand_before), "Rejoined hand must match original"

    # Old token becomes spectator (no longer a player)
    v_old = s.get(f"{API}/rooms/{code}?token={luca_old_tok}").json()
    assert v_old["isSpectator"] is True
    assert v_old["yourHand"] == []


def test_new_name_after_start_rejected_409(s):
    r = s.post(f"{API}/rooms", json={"name": "Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    for _ in range(2):
        s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
    s.post(f"{API}/rooms/{code}/start", json={"token": host})
    r = s.post(f"{API}/rooms/{code}/join", json={"name": "Newbie", "avatar": AV_B})
    assert r.status_code == 409


# ---- Bots have German gangster names/avatars ----
def test_bots_use_german_gangster_avatars(s):
    r = s.post(f"{API}/rooms", json={"name": "Host", "avatar": AV_A})
    code, host = r.json()["code"], r.json()["token"]
    allowed_keys = {"boss", "dealer", "driver", "smuggler", "hacker", "lawyer"}
    german_names = {"Vito", "Ronny", "Kalle", "Shorty", "Dragan", "Nadja", "Ivo", "Mischa"}
    for _ in range(3):
        r = s.post(f"{API}/rooms/{code}/bots", json={"token": host, "action": "add"})
        assert r.status_code == 200
    view = r.json()
    bots = [p for p in view["players"] if p["isBot"]]
    assert len(bots) == 3
    for b in bots:
        assert b["avatar"]["key"] in allowed_keys, b["avatar"]
        assert b["name"] in german_names, b["name"]
