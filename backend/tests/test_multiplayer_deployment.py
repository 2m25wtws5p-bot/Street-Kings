"""Deployment and real-player-flow regression tests against a running test server."""
import os
import uuid
import requests
import witches_engine as eng

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
AVATAR = {"key": "boss", "label": "Boss", "color": "#C084FC"}


def call(method, path, expected=200, **kwargs):
    response = requests.request(method, API + path, timeout=10, **kwargs)
    assert response.status_code == expected, response.text
    return response.json()


def make_players():
    tag = uuid.uuid4().hex[:8]
    host = call("POST", "/rooms", json={"name": f"Host-{tag}", "avatar": AVATAR})
    code = host["code"]
    tokens = [host["token"]]
    for seat in (1, 2):
        player = call("POST", f"/rooms/{code}/join",
                      json={"name": f"Player{seat}-{tag}", "avatar": AVATAR})
        tokens.append(player["token"])
    return code, tokens


def view(code, token):
    return call("GET", f"/rooms/{code}", params={"token": token})


def test_database_readiness_and_pages_cors():
    assert call("GET", "/health")["status"] == "ok"
    response = requests.options(API + "/rooms", headers={
        "Origin": "https://2m25wtws5p-bot.github.io",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }, timeout=10)
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "https://2m25wtws5p-bot.github.io"


def test_duplicate_pass_cards_rejected_without_changing_hand():
    code, tokens = make_players()
    start = call("POST", f"/rooms/{code}/start", json={"token": tokens[0]})
    assert start["phase"] == "passing"
    card_id = start["yourHand"][0]["id"]
    call("POST", f"/rooms/{code}/action", expected=400,
         json={"token": tokens[0], "type": "pass", "cards": [card_id] * start["passCount"]})
    unchanged = view(code, tokens[0])
    assert unchanged["yourHand"] == start["yourHand"]
    assert not unchanged["iPassed"]


def test_three_independent_players_complete_round_with_private_hands():
    code, tokens = make_players()
    call("POST", f"/rooms/{code}/start", json={"token": tokens[0]})
    views = [view(code, token) for token in tokens]
    for seat, current in enumerate(views):
        assert current["yourSeat"] == seat
        assert not any(player["isBot"] for player in current["players"])
        assert "hands" not in current
        assert "allHands" not in current
        own_ids = {card["id"] for card in current["yourHand"]}
        for other in views[seat + 1:]:
            assert own_ids.isdisjoint({card["id"] for card in other["yourHand"]})
    for token, current in zip(tokens, views):
        call("POST", f"/rooms/{code}/action", json={
            "token": token, "type": "pass",
            "cards": [card["id"] for card in current["yourHand"][:current["passCount"]]],
        })

    for source, original in enumerate(views):
        target = original["passTarget"]
        passed_ids = {card["id"] for card in original["yourHand"][:original["passCount"]]}
        received = [card for card in view(code, tokens[target])["yourHand"] if card["id"] in passed_ids]
        assert len(received) == original["passCount"]
        assert all(card["receivedFrom"] == original["players"][source]["name"] for card in received)

    for _ in range(100):
        current = view(code, tokens[0])
        if current["phase"] == "roundScores":
            assert current["totalRounds"] == 1
            assert current["handCounts"] == [0, 0, 0]
            assert all(view(code, token)["scores"] == current["scores"] for token in tokens)
            break
        if current["phase"] == "trickEnd":
            call("POST", f"/rooms/{code}/action",
                 json={"token": tokens[current["lastWinner"]], "type": "continueTrick"})
            continued = view(code, tokens[0])
            assert continued["lastTrick"] == current["lastTrick"]
        else:
            assert current["phase"] == "playing"
            seat = current["currentSeat"]
            own = view(code, tokens[seat])
            legal = eng.legal_card_ids(own["yourHand"], own["trick"])
            other_seat = (seat + 1) % 3
            call("POST", f"/rooms/{code}/action", expected=409, json={
                "token": tokens[other_seat], "type": "play",
                "cardId": legal[0],
            })
            call("POST", f"/rooms/{code}/action", json={
                "token": tokens[seat], "type": "play", "cardId": legal[0],
            })
    else:
        raise AssertionError("Three-player round did not finish")

