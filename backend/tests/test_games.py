"""Backend tests for Coven of Witches game endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://spell-duel-arena-3.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


def test_summary_initial(session):
    r = session.get(f"{API}/games/summary")
    assert r.status_code == 200
    data = r.json()
    assert "total_games" in data
    assert isinstance(data["total_games"], int)


def test_save_game_and_verify(session):
    payload = {
        "players": 4,
        "rounds": 5,
        "scores": [
            {"name": "TEST_Alice", "score": 30},
            {"name": "TEST_Bob", "score": 45},
            {"name": "TEST_Cara", "score": 70},
            {"name": "TEST_Dan", "score": 60},
        ],
        "winners": ["TEST_Alice"],
    }
    before = session.get(f"{API}/games/summary").json()["total_games"]

    r = session.post(f"{API}/games", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data and isinstance(data["id"], str) and len(data["id"]) > 0
    assert "created_at" in data
    assert data["players"] == 4
    assert data["rounds"] == 5
    assert data["winners"] == ["TEST_Alice"]
    assert len(data["scores"]) == 4
    assert data["scores"][0]["name"] == "TEST_Alice"

    # Other parallel CI workers may also finish games between these reads.
    after = session.get(f"{API}/games/summary").json()["total_games"]
    assert after >= before + 1

    # recent should contain it, most recent first
    r2 = session.get(f"{API}/games/recent?limit=100")
    assert r2.status_code == 200
    recent = r2.json()
    assert isinstance(recent, list)
    assert len(recent) >= 1
    ids = [g["id"] for g in recent]
    assert ids.count(data["id"]) == 1
    saved = next(g for g in recent if g["id"] == data["id"])
    assert saved["scores"] == payload["scores"]
    # ensure _id excluded
    for g in recent:
        assert "_id" not in g


def test_recent_ordering(session):
    # Add two more games and verify ordering
    ids = []
    for i in range(2):
        payload = {
            "players": 3,
            "rounds": 1,
            "scores": [{"name": f"TEST_P{i}_{j}", "score": j * 10} for j in range(3)],
            "winners": [f"TEST_P{i}_0"],
        }
        r = session.post(f"{API}/games", json=payload)
        assert r.status_code == 200
        ids.append(r.json()["id"])

    r = session.get(f"{API}/games/recent?limit=100")
    assert r.status_code == 200
    recent = r.json()
    # last inserted should appear before earlier one
    positions = {g["id"]: idx for idx, g in enumerate(recent)}
    assert positions[ids[1]] < positions[ids[0]]


def test_invalid_payload(session):
    r = session.post(f"{API}/games", json={"players": 4})
    assert r.status_code == 422
