"""Full online matches and rematches against the isolated local test API.

History assertions use the unique host name and recorded match IDs, never global
counts, so other CI workers can finish their own games concurrently.
"""
import os
import time
import uuid
from urllib.parse import urlparse

import pytest
import requests

import witches_engine as eng


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8871").rstrip("/")
parsed_url = urlparse(BASE_URL)
if parsed_url.scheme != "http" or parsed_url.hostname not in {"127.0.0.1", "localhost", "::1"}:
    pytest.skip("Lifecycle tests may only mutate an isolated loopback test API", allow_module_level=True)

API = f"{BASE_URL}/api"
AVATAR = {"key": "boss", "label": "Boss", "color": "#C084FC"}
DECK_IDS = {card["id"] for card in eng.make_deck()}


def request(session, method, path, expected=200, **kwargs):
    response = session.request(method, f"{API}{path}", timeout=10, **kwargs)
    assert response.status_code == expected, f"{method} {path}: {response.status_code} {response.text}"
    return response.json()


def assert_player_view(view, n, host_token):
    assert view["n"] == n
    assert len(view["players"]) == n
    assert [player["seat"] for player in view["players"]] == list(range(n))
    assert view["yourSeat"] == 0
    assert view["isHost"] is True
    assert view["isSpectator"] is False
    assert not any(key in view for key in ("hands", "allHands", "piles", "host_token", "pendingSelections", "exchangeHistory"))
    assert host_token not in str(view)
    assert all("token" not in player for player in view["players"])
    assert len(view["scores"]) == n
    assert len(view["handCounts"]) == n
    assert all(isinstance(count, int) and 0 <= count <= 60 // n for count in view["handCounts"])
    own_ids = [card["id"] for card in view["yourHand"]]
    assert len(own_ids) == view["handCounts"][0]
    assert len(set(own_ids)) == len(own_ids)
    assert set(own_ids).issubset(DECK_IDS)
    assert all(entry["card"]["id"] in DECK_IDS for entry in view["trick"])
    assert len({entry["seat"] for entry in view["trick"]}) == len(view["trick"])
    recap = view["yourExchange"]
    allowed_recap = view["phase"] in ("playing", "trickEnd") and view["trickNumber"] <= 3 and view["passDir"] != 0
    if allowed_recap:
        assert recap is not None
        assert len(recap["sent"]) == len(recap["received"]) == view["passCount"]
        assert {card["id"] for card in recap["sent"]}.issubset(DECK_IDS)
        assert {card["id"] for card in recap["received"]}.issubset(DECK_IDS)
    else:
        assert recap is None


def spectator_view(session, code, n):
    view = request(session, "GET", f"/rooms/{code}")
    assert view["isSpectator"] is True
    assert view["yourSeat"] is None
    assert view["isHost"] is False
    assert view["yourHand"] == []
    assert view["yourExchange"] is None
    assert view["n"] == n
    assert not any(key in view for key in ("hands", "allHands", "piles", "host_token", "pendingSelections", "exchangeHistory"))
    assert all("token" not in player for player in view["players"])
    return view


def own_history(session, host_name):
    recent = request(session, "GET", "/games/recent", params={"limit": 100})
    return [record for record in recent if any(score["name"] == host_name for score in record["scores"])]


def drive_match(session, code, token, n, view):
    deadline = time.monotonic() + 120
    completed_rounds = set()
    for move in range(2000):
        assert time.monotonic() < deadline, f"{n}-player match exceeded the 120-second test budget at move {move}"
        assert_player_view(view, n, token)
        if view["status"] == "gameOver":
            assert view["phase"] == "gameOver"
            assert view["handCounts"] == [0] * n
            assert any(score >= eng.WIN_THRESHOLD for score in view["scores"])
            assert all(isinstance(score, int) and score >= 0 for score in view["scores"])
            assert view["totalRounds"] == len(completed_rounds)
            assert completed_rounds
            return view

        phase = view["phase"]
        if phase == "passing":
            assert not view["iPassed"]
            cards = [card["id"] for card in view["yourHand"][:view["passCount"]]]
            payload = {"type": "pass", "cards": cards}
        elif phase == "playing":
            if view["currentSeat"] != 0:
                # The server's CI deadlines are zero, but explicitly polling is
                # still a supported progression path for pending bot actions.
                view = request(session, "GET", f"/rooms/{code}", params={"token": token})
                continue
            legal = eng.legal_card_ids(view["yourHand"], view["trick"])
            assert legal, "An active human turn must have at least one legal card"
            payload = {"type": "play", "cardId": legal[0]}
        elif phase == "trickEnd":
            assert len(view["trick"]) == n
            assert view["lastTrick"] == view["trick"]
            assert view["lastWinner"] == eng.resolve_trick(view["trick"])
            payload = {"type": "continueTrick"}
        elif phase == "roundScores":
            assert view["handCounts"] == [0] * n
            assert view["roundResult"] is not None
            assert len(view["roundResult"]["results"]) == n
            assert view["roundIndex"] not in completed_rounds
            completed_rounds.add(view["roundIndex"])
            assert view["totalRounds"] == len(completed_rounds)
            # Spectators cannot obtain card-exchange snapshots even at a round
            # transition, and polling does not run the round transition twice.
            spectator_view(session, code, n)
            payload = {"type": "nextRound"}
        else:
            pytest.fail(f"Unexpected online phase: {phase}")
        view = request(session, "POST", f"/rooms/{code}/action", json={"token": token, **payload})
    pytest.fail(f"{n}-player match did not finish within 2,000 moves")


def assert_record(record, finished_view, n):
    assert record["players"] == n
    assert record["rounds"] == finished_view["totalRounds"]
    assert [score["score"] for score in record["scores"]] == finished_view["scores"]
    assert [score["name"] for score in record["scores"]] == [player["name"] for player in finished_view["players"]]
    expected_winners = {finished_view["players"][seat]["name"] for seat in eng.lowest_seats(finished_view["scores"])}
    assert set(record["winners"]) == expected_winners
    assert record["id"]
    assert record["created_at"]


@pytest.mark.parametrize("n", [3, 4, 5, 6])
def test_complete_bot_match_and_rematch_have_private_consistent_unique_results(n):
    host_name = f"L{n}-{uuid.uuid4().hex[:10]}"
    with requests.Session() as session:
        created = request(session, "POST", "/rooms", json={"name": host_name, "avatar": AVATAR})
        code, token = created["code"], created["token"]
        for _ in range(n - 1):
            request(session, "POST", f"/rooms/{code}/bots", json={"token": token, "action": "add"})
        started = request(session, "POST", f"/rooms/{code}/start", json={"token": token})
        assert started["roundIndex"] == 0
        assert started["scores"] == [0] * n
        assert started["handCounts"] == [60 // n] * n
        assert sum(player["isBot"] for player in started["players"]) == n - 1
        spectator_view(session, code, n)
        first_end = drive_match(session, code, token, n, started)
        first_records = own_history(session, host_name)
        assert len(first_records) == 1
        assert_record(first_records[0], first_end, n)
        first_id = first_records[0]["id"]

        for _ in range(3):
            unchanged = request(session, "GET", f"/rooms/{code}", params={"token": token})
            assert unchanged["status"] == "gameOver"
            assert unchanged["scores"] == first_end["scores"]
            spectator_view(session, code, n)
        assert [record["id"] for record in own_history(session, host_name)] == [first_id]

        rematch = request(session, "POST", f"/rooms/{code}/rematch", json={"token": token})
        assert rematch["status"] == "playing"
        assert rematch["roundIndex"] == 0
        assert rematch["totalRounds"] == 0
        assert rematch["scores"] == [0] * n
        assert rematch["handCounts"] == [60 // n] * n
        assert rematch["lastTrick"] is None
        assert rematch["lastWinner"] is None
        assert rematch["roundResult"] is None
        assert rematch["yourExchange"] is None
        assert [record["id"] for record in own_history(session, host_name)] == [first_id]

        second_end = drive_match(session, code, token, n, rematch)
        both_records = own_history(session, host_name)
        assert len(both_records) == 2
        assert len({record["id"] for record in both_records}) == 2
        assert first_id in {record["id"] for record in both_records}
        second_record = next(record for record in both_records if record["id"] != first_id)
        assert_record(second_record, second_end, n)
        request(session, "GET", f"/rooms/{code}", params={"token": token})
        assert {record["id"] for record in own_history(session, host_name)} == {record["id"] for record in both_records}
