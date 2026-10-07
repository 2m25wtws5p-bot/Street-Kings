"""Regression coverage for room identity, persistence, and action isolation.

These tests execute the actual API handlers and engine against a small Mongo-like
collection. Separate copies on reads and conditional write matching deliberately
model the database semantics that matter for stale requests and room collisions.
"""
import asyncio
import copy
import gc
import os
import uuid
from contextlib import contextmanager
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

import server


AVATAR = {"key": "boss", "label": "Boss", "color": "#C084FC"}


@contextmanager
def api_client():
    # API validation tests should not start/stop the application's global Mongo
    # client. The external integration server owns its own normal lifecycle.
    client = TestClient(server.app, raise_server_exceptions=False)
    try:
        yield client
    finally:
        client.close()


def player(seat, name=None, bot=False):
    return {"seat": seat, "name": name or f"Player {seat}", "avatar": AVATAR.copy(),
            "isBot": bot, "token": f"player-{seat}", "last_seen": 100.0}


def lobby(code="STABLE", players=None):
    return {"_id": code, "host_token": "player-0", "status": "lobby", "phase": "lobby",
            "players": players or [player(0)], "spectators": [], "version": 0,
            "created_at": "2026-10-07T00:00:00+00:00"}


def playing(code="STABLE", phase="playing"):
    state = lobby(code, [player(i) for i in range(3)])
    state.update(status="playing", phase=phase, n=3, roundIndex=0, trickNumber=1,
                 currentSeat=0, leader=0, trick=[], lastTrick=None, lastWinner=None,
                 scores=[0, 0, 0], piles=[[], [], []],
                 hands=server.eng.deal(server.eng.make_deck(), 3),
                 passCount=4, passDir=1, pendingSelections={})
    return state


def matches(doc, query):
    for key, value in query.items():
        if key == "$or":
            if not any(matches(doc, item) for item in value):
                return False
        elif key == "players.token":
            if not any(p["token"] == value for p in doc.get("players", [])):
                return False
        elif isinstance(value, dict) and "$exists" in value:
            if (key in doc) != value["$exists"]:
                return False
        elif doc.get(key) != value:
            return False
    return True


class MemoryCollection:
    def __init__(self, docs=()):
        self.docs = {doc["_id"]: copy.deepcopy(doc) for doc in docs}
        self.inserted = []
        self.replace_calls = []
        self.update_calls = []

    def find(self, query, projection=None):
        docs = [copy.deepcopy(doc) for doc in self.docs.values() if matches(doc, query)]
        if projection and projection.get("_id") == 0:
            for doc in docs:
                doc.pop("_id", None)
        return MemoryCursor(docs)

    async def find_one(self, query):
        # Let concurrent handlers interleave as they would around network I/O.
        await asyncio.sleep(0)
        return next((copy.deepcopy(doc) for doc in self.docs.values() if matches(doc, query)), None)

    async def insert_one(self, doc):
        await asyncio.sleep(0)
        doc = copy.deepcopy(doc)
        doc.setdefault("_id", f"generated-{len(self.docs)}")
        if doc["_id"] in self.docs:
            raise DuplicateKeyError("duplicate _id")
        self.docs[doc["_id"]] = copy.deepcopy(doc)
        self.inserted.append(copy.deepcopy(doc))
        return SimpleNamespace(inserted_id=doc["_id"])

    async def replace_one(self, query, replacement, upsert=False):
        self.replace_calls.append((copy.deepcopy(query), upsert))
        await asyncio.sleep(0)
        found = next((doc for doc in self.docs.values() if matches(doc, query)), None)
        if found is not None:
            self.docs[found["_id"]] = copy.deepcopy(replacement)
            return SimpleNamespace(matched_count=1)
        if upsert:
            if replacement["_id"] in self.docs:
                raise DuplicateKeyError("duplicate _id")
            self.docs[replacement["_id"]] = copy.deepcopy(replacement)
        return SimpleNamespace(matched_count=0)

    async def update_one(self, query, update, upsert=False):
        self.update_calls.append((copy.deepcopy(query), copy.deepcopy(update), upsert))
        await asyncio.sleep(0)
        found = next((doc for doc in self.docs.values() if matches(doc, query)), None)
        if found is None:
            if upsert:
                created = {**query, **copy.deepcopy(update.get("$setOnInsert", {}))}
                self.docs[created["_id"]] = created
            return SimpleNamespace(matched_count=0)
        for key, value in update.get("$set", {}).items():
            if key == "players.$.last_seen":
                for p in found["players"]:
                    if p["token"] == query["players.token"]:
                        p["last_seen"] = value
            else:
                found[key] = copy.deepcopy(value)
        return SimpleNamespace(matched_count=1)


class MemoryCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction):
        self.docs.sort(key=lambda doc: doc.get(key, ""), reverse=direction < 0)
        return self

    async def to_list(self, length):
        if length < 0:
            raise ValueError("length must be non-negative")
        return self.docs[:length]


class ServerStabilityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        server._locks.clear()
        self.rooms = MemoryCollection()
        self.results = MemoryCollection()
        self.db_patch = patch.object(server, "db", SimpleNamespace(rooms=self.rooms, game_results=self.results))
        self.db_patch.start()
        self.clock_patch = patch.object(server.time, "time", return_value=100.0)
        self.clock = self.clock_patch.start()

    def tearDown(self):
        self.clock_patch.stop()
        self.db_patch.stop()

    async def assert_http_error(self, status, action):
        with self.assertRaises(HTTPException) as raised:
            await action
        self.assertEqual(raised.exception.status_code, status)

    async def test_code_collision_exhaustion_never_overwrites_an_existing_room(self):
        original = lobby("TAKEN")
        self.rooms.docs["TAKEN"] = copy.deepcopy(original)
        with patch.object(server, "_gen_code", return_value="TAKEN"):
            await self.assert_http_error(503, server.create_room(server.CreateRoom(name="New", avatar=AVATAR)))
        self.assertEqual(self.rooms.docs["TAKEN"], original)

    async def test_concurrent_room_creation_cannot_replace_another_hosts_session(self):
        with patch.object(server, "_gen_code", return_value="RACE1"):
            outcomes = await asyncio.gather(
                server.create_room(server.CreateRoom(name="One", avatar=AVATAR)),
                server.create_room(server.CreateRoom(name="Two", avatar=AVATAR)),
                return_exceptions=True,
            )
        successes = [item for item in outcomes if isinstance(item, dict)]
        failures = [item for item in outcomes if isinstance(item, HTTPException)]
        self.assertEqual(len(successes), 1)
        self.assertEqual([item.status_code for item in failures], [503])
        self.assertEqual(self.rooms.docs["RACE1"]["host_token"], successes[0]["token"])

    async def test_new_rooms_have_idle_expiration_even_before_the_first_poll(self):
        result = await server.create_room(server.CreateRoom(name="Host", avatar=AVATAR))
        self.assertIn("expire_at", self.rooms.docs[result["code"]])

    async def test_disconnected_name_is_not_proof_of_player_or_host_identity(self):
        original = playing()
        self.rooms.docs["STABLE"] = copy.deepcopy(original)
        self.clock.return_value = 111.0
        await self.assert_http_error(409, server.join_room("STABLE", server.JoinRoom(name="Player 0", avatar=AVATAR)))
        self.assertEqual(self.rooms.docs["STABLE"], original)

    async def test_existing_token_reconnects_without_rotation_or_loss_of_host_rights(self):
        self.rooms.docs["STABLE"] = playing()
        self.clock.return_value = 111.0
        result = await server.join_room("STABLE", server.JoinRoom(name="Player 0", avatar=AVATAR, token="player-0"))
        self.assertEqual(result["token"], "player-0")
        self.assertTrue(result["rejoined"])
        view = await server.get_room("STABLE", "player-0")
        self.assertEqual(view["yourSeat"], 0)
        self.assertTrue(view["isHost"])
        self.assertEqual(len(view["yourHand"]), 20)

    async def test_wrong_reconnect_token_cannot_claim_a_named_seat(self):
        self.rooms.docs["STABLE"] = playing()
        self.clock.return_value = 111.0
        await self.assert_http_error(403, server.join_room("STABLE", server.JoinRoom(name="Player 0", avatar=AVATAR, token="wrong-token")))
        self.assertEqual(self.rooms.docs["STABLE"]["host_token"], "player-0")

    async def test_bot_removal_and_later_join_keep_all_lobby_seats_unique(self):
        self.rooms.docs["STABLE"] = lobby(players=[player(0), player(1, bot=True), player(2)])
        view = await server.manage_bots("STABLE", server.BotsReq(token="player-0", action="remove"))
        self.assertEqual([p["seat"] for p in view["players"]], [0, 1])
        joined = await server.join_room("STABLE", server.JoinRoom(name="New guest", avatar=AVATAR))
        self.assertEqual(joined["seat"], 2)
        self.assertEqual([p["seat"] for p in self.rooms.docs["STABLE"]["players"]], [0, 1, 2])
        guest = await server.get_room("STABLE", "player-2")
        self.assertEqual(guest["yourSeat"], 1)

    async def test_legacy_lobby_seat_gaps_are_repaired_before_any_start_action(self):
        state = lobby(players=[player(0), player(2)])
        state["hands"] = [[{"id": "old-unused-state"}]]
        self.rooms.docs["STABLE"] = copy.deepcopy(state)
        view = await server.get_room("STABLE", "player-2")
        self.assertEqual([p["seat"] for p in view["players"]], [0, 1])
        self.assertEqual(view["yourSeat"], 1)
        saved = self.rooms.docs["STABLE"]
        self.assertEqual(saved["host_token"], state["host_token"])
        self.assertEqual(saved["status"], "lobby")
        self.assertEqual(saved["hands"], state["hands"])
        self.assertEqual([p["token"] for p in saved["players"]], [p["token"] for p in state["players"]])
        self.assertEqual([p["name"] for p in saved["players"]], [p["name"] for p in state["players"]])
        self.assertGreater(saved["version"], 0)

    async def test_spectator_load_also_persists_legacy_lobby_seat_repair(self):
        self.rooms.docs["STABLE"] = lobby(players=[player(0), player(2)])
        view = await server.get_room("STABLE")
        self.assertTrue(view["isSpectator"])
        self.assertEqual([p["seat"] for p in view["players"]], [0, 1])
        self.assertEqual([p["seat"] for p in self.rooms.docs["STABLE"]["players"]], [0, 1])

    async def test_loading_running_games_never_reindexes_seats_or_changes_cards(self):
        state = playing()
        state["players"][1]["seat"] = 2
        state["players"][2]["seat"] = 3
        self.rooms.docs["STABLE"] = copy.deepcopy(state)
        loaded = await server._get_room("STABLE")
        self.assertEqual(loaded, state)
        self.assertEqual(self.rooms.docs["STABLE"], state)

    async def test_legacy_malformed_avatar_does_not_break_adding_bots(self):
        state = lobby()
        state["players"][0]["avatar"] = {"key": {"invalid": True}}
        self.rooms.docs["STABLE"] = state
        view = await server.manage_bots("STABLE", server.BotsReq(token="player-0", action="add"))
        self.assertEqual(len(view["players"]), 2)
        self.assertTrue(view["players"][1]["isBot"])

    async def test_stale_copy_cannot_overwrite_a_newer_saved_action(self):
        state = playing()
        self.rooms.docs["STABLE"] = copy.deepcopy(state)
        first, stale = copy.deepcopy(state), copy.deepcopy(state)
        first["trickNumber"] = 2
        await server._save_room(first)
        stale["trickNumber"] = 99
        await self.assert_http_error(409, server._save_room(stale))
        self.assertEqual(self.rooms.docs["STABLE"]["trickNumber"], 2)
        self.assertEqual(self.rooms.docs["STABLE"]["version"], 1)

    async def test_expired_room_cannot_be_resurrected_by_a_pending_write(self):
        state = playing()
        await self.assert_http_error(404, server._save_room(state))
        self.assertEqual(self.rooms.docs, {})

    async def test_room_documents_created_before_versions_can_still_be_saved(self):
        state = lobby()
        state.pop("version")
        self.rooms.docs["STABLE"] = copy.deepcopy(state)
        await server._save_room(state)
        self.assertEqual(self.rooms.docs["STABLE"]["version"], 1)

    async def test_poll_heartbeat_is_versioned_and_refreshes_idle_expiration(self):
        self.rooms.docs["STABLE"] = playing()
        self.clock.return_value = 105.0
        view = await server.get_room("STABLE", "player-0")
        self.assertEqual(view["version"], 1)
        self.assertEqual(self.rooms.docs["STABLE"]["players"][0]["last_seen"], 105.0)
        self.assertIn("expire_at", self.rooms.docs["STABLE"])

    async def test_duplicate_passes_are_serialized_and_apply_only_once(self):
        state = playing(phase="passing")
        self.rooms.docs["STABLE"] = state
        cards = [card["id"] for card in state["hands"][0][:4]]
        outcomes = await asyncio.gather(*[
            server.room_action("STABLE", server.ActionReq(token="player-0", type="pass", cards=cards))
            for _ in range(2)
        ], return_exceptions=True)
        self.assertEqual(sum(isinstance(item, dict) for item in outcomes), 1)
        self.assertEqual([item.status_code for item in outcomes if isinstance(item, HTTPException)], [409])
        self.assertEqual(self.rooms.docs["STABLE"]["pendingSelections"], {"0": cards})

    async def test_duplicate_play_requests_cannot_remove_two_cards(self):
        state = playing()
        self.rooms.docs["STABLE"] = state
        card_id = state["hands"][0][0]["id"]
        outcomes = await asyncio.gather(*[
            server.room_action("STABLE", server.ActionReq(token="player-0", type="play", cardId=card_id))
            for _ in range(2)
        ], return_exceptions=True)
        self.assertEqual(sum(isinstance(item, dict) for item in outcomes), 1)
        self.assertEqual([item.status_code for item in outcomes if isinstance(item, HTTPException)], [409])
        self.assertEqual(len(self.rooms.docs["STABLE"]["hands"][0]), 19)
        self.assertEqual(len(self.rooms.docs["STABLE"]["trick"]), 1)

    async def test_old_replaced_token_is_spectator_and_cannot_act(self):
        state = playing()
        state["players"][1].update(isBot=True, token="replacement-bot")
        self.rooms.docs["STABLE"] = state
        view = await server.get_room("STABLE", "player-1")
        self.assertTrue(view["isSpectator"])
        self.assertEqual(view["yourHand"], [])
        await self.assert_http_error(403, server.room_action("STABLE", server.ActionReq(token="player-1", type="play", cardId="RED-1")))

    async def test_bot_tokens_cannot_submit_human_actions(self):
        state = playing()
        state["players"][0]["isBot"] = True
        self.rooms.docs["STABLE"] = state
        await self.assert_http_error(403, server.room_action("STABLE", server.ActionReq(token="player-0", type="play", cardId=state["hands"][0][0]["id"])))

    async def test_finished_game_history_is_idempotent_after_room_save_retry(self):
        state = playing()
        state.update(status="gameOver", phase="gameOver", scores=[0, 70, 10], totalRounds=3)
        first, retry = copy.deepcopy(state), copy.deepcopy(state)
        await server._maybe_record(first)
        await server._maybe_record(retry)
        self.assertEqual(len(self.results.docs), 1)
        saved = next(iter(self.results.docs.values()))
        self.assertEqual(saved["winners"], ["Player 0"])
        self.assertTrue(first["recorded"])
        self.assertTrue(retry["recorded"])

    async def test_rematches_are_distinct_history_entries(self):
        state = playing()
        state.update(status="gameOver", phase="gameOver", scores=[0, 70, 10], totalRounds=3)
        await server._maybe_record(state)
        rematch = copy.deepcopy(state)
        rematch.update(recorded=False, rematches=1)
        await server._maybe_record(rematch)
        self.assertEqual(len(self.results.docs), 2)

    async def test_missing_rooms_return_404_for_reads_and_actions(self):
        await self.assert_http_error(404, server.get_room("GONE", "player-0"))
        await self.assert_http_error(404, server.room_action("GONE", server.ActionReq(token="player-0", type="nextRound")))

    async def test_unknown_room_requests_do_not_accumulate_locks_forever(self):
        for number in range(30):
            await self.assert_http_error(404, server.get_room(f"MISSING-{number}"))
        gc.collect()
        self.assertEqual(len(server._locks), 0)

    async def test_active_card_actions_refresh_player_presence(self):
        state = playing(phase="passing")
        self.rooms.docs["STABLE"] = state
        self.clock.return_value = 111.0
        cards = [card["id"] for card in state["hands"][0][:4]]
        view = await server.room_action("STABLE", server.ActionReq(token="player-0", type="pass", cards=cards))
        self.assertTrue(view["players"][0]["connected"])
        self.assertEqual(self.rooms.docs["STABLE"]["players"][0]["last_seen"], 111.0)

    async def test_result_recording_failure_remains_retryable(self):
        state = playing()
        state.update(status="gameOver", phase="gameOver", scores=[0, 70, 10], totalRounds=3)
        with patch.object(self.results, "update_one", side_effect=RuntimeError("temporary write failure")):
            with self.assertRaises(RuntimeError):
                await server._maybe_record(state)
        self.assertFalse(state.get("recorded", False))
        await server._maybe_record(state)
        self.assertEqual(len(self.results.docs), 1)

    async def test_public_views_never_expose_any_session_token(self):
        state = playing()
        self.rooms.docs["STABLE"] = state
        for token in ("player-0", "unknown", ""):
            view = await server.get_room("STABLE", token)
            serialized = str(view)
            self.assertNotIn("host_token", view)
            for secret in (p["token"] for p in state["players"]):
                self.assertNotIn(secret, serialized)


class InputValidationTests(unittest.TestCase):
    def test_nested_avatar_keys_are_rejected_before_bot_management_can_crash(self):
        with self.assertRaises(ValidationError):
            server.CreateRoom(name="Host", avatar={"key": {"invalid": True}})

    def test_replacement_seat_is_bounded_to_supported_players(self):
        for seat in (-1, 6):
            with self.subTest(seat=seat), self.assertRaises(ValidationError):
                server.ReplaceReq(token="player-0", seat=seat)

    def test_recent_games_endpoint_rejects_unbounded_or_negative_limits(self):
        results = MemoryCollection()
        with patch.object(server, "db", SimpleNamespace(game_results=results)), api_client() as client:
            for limit in ("-1", "0", "101", "abc"):
                with self.subTest(limit=limit):
                    self.assertEqual(client.get(f"/api/games/recent?limit={limit}").status_code, 422)
            self.assertEqual(client.get("/api/games/recent?limit=1").status_code, 200)

    def test_invalid_avatar_request_fails_at_api_boundary_without_creating_a_room(self):
        rooms = MemoryCollection()
        with patch.object(server, "db", SimpleNamespace(rooms=rooms)), api_client() as client:
            response = client.post("/api/rooms", json={"name": "Host", "avatar": {"key": {"invalid": True}}})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(rooms.docs, {})

    def test_malformed_finished_game_payloads_cannot_pollute_public_history(self):
        valid = {"players": 3, "rounds": 1,
                 "scores": [{"name": "A", "score": -5}, {"name": "B", "score": 10}, {"name": "C", "score": 20}],
                 "winners": ["A"]}
        invalid = [
            {**valid, "players": 0}, {**valid, "players": 7},
            {**valid, "rounds": 0}, {**valid, "rounds": -1},
            {**valid, "scores": valid["scores"][:2]},
            {**valid, "scores": [{"name": "   ", "score": 0}, *valid["scores"][1:]]},
            {**valid, "scores": [{"name": "A" * 65, "score": 0}, *valid["scores"][1:]]},
            {**valid, "winners": []}, {**valid, "winners": ["Not in this game"]},
        ]
        results = MemoryCollection()
        with patch.object(server, "db", SimpleNamespace(game_results=results)), api_client() as client:
            for index, payload in enumerate(invalid):
                with self.subTest(payload=index):
                    self.assertEqual(client.post("/api/games", json=payload).status_code, 422)
            self.assertEqual(results.docs, {})
            response = client.post("/api/games", json=valid)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["scores"][0]["score"], -5)

    def test_duplicate_local_player_names_remain_supported_in_game_results(self):
        payload = {"players": 3, "rounds": 2,
                   "scores": [{"name": "Alex", "score": score} for score in (-5, 10, 20)],
                   "winners": ["Alex"]}
        result = server.GameResultCreate(**payload)
        self.assertEqual(len(result.scores), 3)
        self.assertEqual(result.winners, ["Alex"])

    def test_legacy_game_history_remains_readable_without_new_input_name_bounds(self):
        legacy = {"_id": "legacy", "id": "legacy", "created_at": "2026-09-01T00:00:00+00:00",
                  "players": 3, "rounds": 1,
                  "scores": [{"name": "", "score": 0}, {"name": "A" * 65, "score": 10}, {"name": "C", "score": 20}],
                  "winners": [""]}
        results = MemoryCollection([legacy])
        with patch.object(server, "db", SimpleNamespace(game_results=results)), api_client() as client:
            response = client.get("/api/games/recent")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["scores"], legacy["scores"])


LOCAL_TEST_DATABASE = (
    server.mongo_url.startswith(("mongodb://127.0.0.1:", "mongodb://localhost:"))
    and os.environ.get("DB_NAME", "").endswith(("_ci", "_audit"))
)


@unittest.skipUnless(LOCAL_TEST_DATABASE, "Mongo persistence tests require an isolated loopback _ci/_audit database")
class MongoPersistenceTests(unittest.IsolatedAsyncioTestCase):
    """Check the same critical write semantics against the real local Mongo DB.

    A fresh client per test keeps event loops isolated; cleanup only removes the
    exact UUID-namespaced documents generated by this test, never a collection.
    """

    async def asyncSetUp(self):
        self.client = server.AsyncIOMotorClient(server.mongo_url, serverSelectionTimeoutMS=5000)
        # Keep transient match-history records away from the API suite's global
        # summary counts when CI runs different test modules in parallel.
        database_name = f"{os.environ['DB_NAME']}_persistence_{uuid.uuid4().hex}"
        self.database = self.client[database_name]
        await self.client.admin.command("ping")
        self.code = f"REG-{uuid.uuid4().hex}"
        self.state = playing(self.code)
        self.record_id = str(uuid.uuid5(uuid.NAMESPACE_URL,
            f"street-kings:{self.code}:{self.state['created_at']}:0"))
        self.db_patch = patch.object(server, "db", self.database)
        self.db_patch.start()

    async def asyncTearDown(self):
        try:
            await self.database.rooms.delete_one({"_id": self.code})
            await self.database.game_results.delete_one({"_id": self.record_id})
        finally:
            self.db_patch.stop()
            self.client.close()

    async def test_real_mongo_cas_accepts_exactly_one_concurrent_game_write(self):
        await self.database.rooms.insert_one(copy.deepcopy(self.state))
        first, second = copy.deepcopy(self.state), copy.deepcopy(self.state)
        first["trickNumber"], second["trickNumber"] = 2, 3
        outcomes = await asyncio.gather(server._save_room(first), server._save_room(second), return_exceptions=True)
        self.assertEqual(sum(item is None for item in outcomes), 1)
        self.assertEqual([item.status_code for item in outcomes if isinstance(item, HTTPException)], [409])
        saved = await self.database.rooms.find_one({"_id": self.code})
        self.assertEqual(saved["version"], 1)
        self.assertIn(saved["trickNumber"], (2, 3))

    async def test_real_mongo_missing_room_is_not_upserted_by_pending_save(self):
        with self.assertRaises(HTTPException) as raised:
            await server._save_room(self.state)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIsNone(await self.database.rooms.find_one({"_id": self.code}))

    async def test_real_mongo_old_room_without_version_migrates_on_save(self):
        self.state.pop("version")
        await self.database.rooms.insert_one(copy.deepcopy(self.state))
        await server._save_room(self.state)
        self.assertEqual((await self.database.rooms.find_one({"_id": self.code}))["version"], 1)

    async def test_real_mongo_atomic_room_allocation_has_one_owner(self):
        with patch.object(server, "_gen_code", return_value=self.code):
            outcomes = await asyncio.gather(
                server.create_room(server.CreateRoom(name="One", avatar=AVATAR)),
                server.create_room(server.CreateRoom(name="Two", avatar=AVATAR)), return_exceptions=True,
            )
        success = [item for item in outcomes if isinstance(item, dict)]
        self.assertEqual(len(success), 1)
        self.assertEqual([item.status_code for item in outcomes if isinstance(item, HTTPException)], [503])
        saved = await self.database.rooms.find_one({"_id": self.code})
        self.assertEqual(saved["host_token"], success[0]["token"])

    async def test_real_mongo_completed_match_is_recorded_once_under_concurrency(self):
        self.state.update(status="gameOver", phase="gameOver", scores=[0, 70, 10], totalRounds=3)
        first, second = copy.deepcopy(self.state), copy.deepcopy(self.state)
        await asyncio.gather(server._maybe_record(first), server._maybe_record(second))
        self.assertTrue(first["recorded"])
        self.assertTrue(second["recorded"])
        self.assertEqual(await self.database.game_results.count_documents({"_id": self.record_id}), 1)
        record = await self.database.game_results.find_one({"_id": self.record_id})
        self.assertEqual(record["winners"], ["Player 0"])


if __name__ == "__main__":
    unittest.main()
