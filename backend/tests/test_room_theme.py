"""A host-selected visual theme is shared, private-state safe and lobby-only."""
import asyncio
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

import server
from test_server_stability import AVATAR, MemoryCollection, api_client, lobby, player, playing


class RoomThemeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        server._locks.clear()
        self.rooms = MemoryCollection([lobby(players=[player(i) for i in range(3)])])
        self.results = MemoryCollection()
        self.db_patch = patch.object(server, "db", SimpleNamespace(rooms=self.rooms, game_results=self.results))
        self.db_patch.start()
        self.clock_patch = patch.object(server.time, "time", return_value=100.0)
        self.clock_patch.start()

    def tearDown(self):
        self.clock_patch.stop()
        self.db_patch.stop()

    async def select(self, theme="animal", token="player-0", code="STABLE"):
        return await server.room_action(code, server.ActionReq(token=token, type="setTheme", theme=theme))

    async def assert_http_error(self, status, request):
        with self.assertRaises(HTTPException) as raised:
            await request
        self.assertEqual(raised.exception.status_code, status)

    async def test_new_rooms_default_to_street_and_accept_explicit_visual_themes(self):
        for index, extra in enumerate(({}, {"theme": "street"}, {"theme": "animal"}, {"theme": "space"})):
            code = f"NEW0{index}"
            with patch.object(server, "_gen_code", return_value=code):
                session = await server.create_room(server.CreateRoom(name="Host", avatar=AVATAR, **extra))
            state = self.rooms.docs[code]
            self.assertEqual(state["theme"], extra.get("theme", "street"))
            for token in (session["token"], "watcher", ""):
                self.assertEqual(server._redact(state, token)["theme"], state["theme"])

    def test_create_and_action_models_only_accept_allowlisted_theme_strings(self):
        for invalid in ("", "Animal", "tokyo", "constructor", "<script>", 1, True, [], {}):
            with self.subTest(theme=invalid):
                with self.assertRaises(ValidationError):
                    server.CreateRoom(name="Host", avatar=AVATAR, theme=invalid)
                with self.assertRaises(ValidationError):
                    server.ActionReq(token="player-0", type="setTheme", theme=invalid)
        with self.assertRaises(ValidationError):
            server.CreateRoom(name="Host", avatar=AVATAR, theme=None)

    async def test_host_selection_is_shared_with_every_player_and_spectator(self):
        self.rooms.docs["STABLE"]["spectators"] = [{"name": "Watcher", "token": "spectator-secret"}]
        for theme in ("animal", "space", "street", "space", "animal"):
            selected = await self.select(theme)
            self.assertEqual(selected["theme"], theme)
            for token in ("player-0", "player-1", "player-2", "spectator-secret", "unknown", ""):
                view = await server.get_room("STABLE", token)
                self.assertEqual(view["theme"], theme)
                self.assertNotIn("host_token", view)
                self.assertNotIn("hands", view)
                self.assertFalse(any("token" in item for item in view["players"]))
                self.assertEqual(view["spectators"], ["Watcher"])

    async def test_other_players_spectators_unknown_tokens_and_bots_cannot_select(self):
        original = copy.deepcopy(self.rooms.docs["STABLE"])
        original["spectators"] = [{"name": "Watcher", "token": "spec-token"}]
        original["players"][2]["isBot"] = True
        for token in ("player-1", "player-2", "spec-token", "unknown", ""):
            with self.subTest(token=token):
                self.rooms.docs["STABLE"] = copy.deepcopy(original)
                await self.assert_http_error(403, self.select(token=token))
                self.assertEqual(self.rooms.docs["STABLE"], original)
        self.assertEqual(self.rooms.replace_calls, [])

    async def test_host_token_must_still_belong_to_an_actual_human_player(self):
        for mutation in ("missing", "bot"):
            state = lobby(players=[player(i) for i in range(3)])
            if mutation == "missing":
                state["host_token"] = "orphan-host-token"
                token = "orphan-host-token"
            else:
                state["players"][0]["isBot"] = True
                token = "player-0"
            self.rooms.docs["STABLE"] = copy.deepcopy(state)
            await self.assert_http_error(403, self.select(token=token))
            self.assertEqual(self.rooms.docs["STABLE"], state)

    async def test_missing_or_null_theme_is_rejected_without_changing_room(self):
        original = copy.deepcopy(self.rooms.docs["STABLE"])
        for extra in ({}, {"theme": None}):
            await self.assert_http_error(400, server.room_action("STABLE", server.ActionReq(
                token="player-0", type="setTheme", **extra)))
            self.assertEqual(self.rooms.docs["STABLE"], original)

    async def test_api_validation_rejects_unknown_themes_and_returns_safe_room_view(self):
        with api_client() as client:
            for theme in ("tokyo", 1, True, {}, ["animal"]):
                response = client.post("/api/rooms/STABLE/action", json={
                    "token": "player-0", "type": "setTheme", "theme": theme})
                self.assertEqual(response.status_code, 422)
            for extra in ({}, {"theme": None}):
                response = client.post("/api/rooms/STABLE/action", json={
                    "token": "player-0", "type": "setTheme", **extra})
                self.assertEqual(response.status_code, 400)
            self.assertEqual(self.rooms.docs["STABLE"]["version"], 0)
            response = client.post("/api/rooms/STABLE/action", json={
                "token": "player-0", "type": "setTheme", "theme": "animal"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["theme"], "animal")
            self.assertTrue(response.json()["isHost"])
            self.assertNotIn("host_token", response.json())

    async def test_only_lobby_allows_theme_changes_even_for_host(self):
        for phase in ("passing", "playing", "trickEnd", "roundScores", "gameOver"):
            with self.subTest(phase=phase):
                state = playing(phase=phase)
                state["theme"] = "street"
                if phase == "gameOver":
                    state["status"] = "gameOver"
                self.rooms.docs["STABLE"] = copy.deepcopy(state)
                await self.assert_http_error(409, self.select())
                self.assertEqual(self.rooms.docs["STABLE"], state)

    async def test_visual_selection_does_not_deal_or_advance_gameplay(self):
        before = copy.deepcopy(self.rooms.docs["STABLE"])
        with patch.object(server, "_advance_bots", side_effect=AssertionError("Theme advanced bots")), \
                patch.object(server, "_setup_passing", side_effect=AssertionError("Theme dealt cards")):
            view = await self.select()
        saved = self.rooms.docs["STABLE"]
        self.assertEqual(saved["version"], before["version"] + 1)
        self.assertEqual(view["phase"], "lobby")
        for key in before.keys() - {"version"}:
            self.assertEqual(saved[key], before[key], key)
        self.assertNotIn("hands", saved)
        self.assertEqual(self.rooms.replace_calls, [({"_id": "STABLE", "$or": [
            {"version": 0}, {"version": {"$exists": False}}]}, False)])

    async def assert_theme_survives_lifecycle(self, theme):
        self.rooms.docs["STABLE"] = lobby()
        await self.select(theme)
        for seat in (1, 2):
            await server.join_room("STABLE", server.JoinRoom(name=f"Crew {seat}", avatar=AVATAR))
        started = await server.start_room("STABLE", server.TokenReq(token="player-0"))
        self.assertEqual(started["theme"], theme)
        self.assertEqual(sum(started["handCounts"]), 60)
        joined_token = self.rooms.docs["STABLE"]["players"][1]["token"]
        rejoined = await server.join_room("STABLE", server.JoinRoom(
            name="Crew 1", avatar=AVATAR, token=joined_token))
        self.assertTrue(rejoined["rejoined"])
        self.assertEqual((await server.get_room("STABLE", joined_token))["theme"], theme)
        state = self.rooms.docs["STABLE"]
        state.update(phase="roundScores", readySeats=[False, True, True])
        next_round = await server.room_action("STABLE", server.ActionReq(
            token="player-0", type="nextRound", roundId=state["roundId"]))
        self.assertEqual(next_round["theme"], theme)
        self.assertEqual(next_round["roundIndex"], 1)
        self.rooms.docs["STABLE"].update(status="gameOver", phase="gameOver")
        rematch = await server.rematch_room("STABLE", server.TokenReq(token="player-0"))
        self.assertEqual(rematch["theme"], theme)
        self.assertEqual(rematch["roundIndex"], 0)
        self.assertEqual(sum(rematch["handCounts"]), 60)

    async def test_theme_survives_join_start_reconnect_next_round_and_rematch(self):
        for theme in ("animal", "space"):
            with self.subTest(theme=theme):
                await self.assert_theme_survives_lifecycle(theme)

    async def test_space_theme_keeps_host_and_lobby_permissions(self):
        before = copy.deepcopy(self.rooms.docs["STABLE"])
        await self.assert_http_error(403, self.select("space", token="player-1"))
        self.assertEqual(self.rooms.docs["STABLE"], before)
        for phase in ("passing", "playing", "trickEnd", "roundScores", "gameOver"):
            state = playing(phase=phase)
            state["theme"] = "animal"
            self.rooms.docs["STABLE"] = copy.deepcopy(state)
            await self.assert_http_error(409, self.select("space"))
            self.assertEqual(self.rooms.docs["STABLE"], state)

    def test_legacy_rooms_default_to_street_in_every_phase_without_mutation(self):
        for phase in ("lobby", "passing", "playing", "trickEnd", "roundScores", "gameOver"):
            state = lobby() if phase == "lobby" else playing(phase=phase)
            if phase == "gameOver":
                state["status"] = "gameOver"
            before = copy.deepcopy(state)
            for token in ("player-0", "player-1", "watcher", ""):
                self.assertEqual(server._redact(state, token)["theme"], "street")
            self.assertEqual(state, before)
            self.assertNotIn("theme", state)

    def test_unknown_persisted_theme_falls_back_to_street_without_public_echo(self):
        state = lobby()
        state["theme"] = "untrusted-arbitrary-value"
        self.assertEqual(server._redact(state, "watcher")["theme"], "street")
        self.assertEqual(state["theme"], "untrusted-arbitrary-value")

    async def test_concurrent_theme_and_chat_changes_preserve_both(self):
        selected, chatted = await asyncio.gather(self.select(), server.room_chat(
            "STABLE", server.ChatReq(token="player-1", text="Animal crew!")))
        saved = self.rooms.docs["STABLE"]
        self.assertEqual(saved["theme"], "animal")
        self.assertEqual(saved["chatMessages"][0]["text"], "Animal crew!")
        self.assertEqual(saved["version"], 2)
        self.assertEqual(selected["theme"], "animal")
        self.assertEqual(chatted["theme"], "animal")

    async def test_cross_process_theme_conflict_cannot_overwrite_a_started_game(self):
        replace_one = self.rooms.replace_one

        async def external_start_before_save(query, replacement, upsert=False):
            external = playing()
            external["version"] = 1
            external["theme"] = "street"
            self.rooms.docs["STABLE"] = copy.deepcopy(external)
            return await replace_one(query, replacement, upsert=upsert)

        with patch.object(self.rooms, "replace_one", side_effect=external_start_before_save):
            await self.assert_http_error(409, self.select())
        saved = self.rooms.docs["STABLE"]
        self.assertEqual(saved["status"], "playing")
        self.assertEqual(saved["theme"], "street")
        self.assertEqual(saved["version"], 1)
        self.assertEqual(sum(map(len, saved["hands"])), 60)

    async def test_missing_room_remains_not_found(self):
        await self.assert_http_error(404, self.select(code="NONE1"))


if __name__ == "__main__":
    unittest.main()
