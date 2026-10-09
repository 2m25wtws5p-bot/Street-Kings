"""All-human readiness, stale round requests and bounded chat sound contracts."""
import asyncio
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

import server
from test_server_stability import MemoryCollection, playing, lobby, player


class FlowSandbox(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        server._locks.clear()
        state = playing(phase="roundScores")
        state.update(roundId="first-round", readySeats=[False] * 3,
                     roundResult={"results": [{"total": 0}] * 3})
        self.rooms = MemoryCollection([state])
        self.results = MemoryCollection()
        self.db_patch = patch.object(server, "db", SimpleNamespace(rooms=self.rooms, game_results=self.results))
        self.db_patch.start()
        self.clock_patch = patch.object(server.time, "time", return_value=100.0)
        self.clock = self.clock_patch.start()

    def tearDown(self):
        self.clock_patch.stop()
        self.db_patch.stop()

    async def ready(self, seat, round_id="first-round"):
        return await server.room_action("STABLE", server.ActionReq(
            token=f"player-{seat}", type="nextRound", roundId=round_id))


class ReadinessTests(FlowSandbox):

    async def test_each_human_must_confirm_and_duplicates_do_not_advance(self):
        first = await self.ready(0)
        self.assertEqual(first["phase"], "roundScores")
        self.assertEqual(first["readySeats"], [True, False, False])
        self.assertTrue(first["iReady"])
        duplicate = await self.ready(0)
        self.assertEqual(duplicate["readySeats"], first["readySeats"])
        second = await self.ready(1)
        self.assertEqual(second["phase"], "roundScores")
        self.assertEqual(second["readySeats"], [True, True, False])
        last = await self.ready(2)
        self.assertEqual(last["roundIndex"], 1)
        self.assertNotEqual(last["roundId"], "first-round")
        self.assertEqual(last["readySeats"], [False, False, False])
        self.assertEqual(last["phase"], "passing")
        self.assertEqual(sum(last["handCounts"]), 60)

    async def test_concurrent_final_confirmations_deal_once_and_retries_never_ready_next_round(self):
        outcomes = await asyncio.gather(*(self.ready(seat) for seat in [0, 1, 2, 2, 1]))
        current = self.rooms.docs["STABLE"]
        self.assertEqual(current["roundIndex"], 1)
        self.assertEqual(current["readySeats"], [False] * 3)
        # Even a very late retry that arrives at the next scoring screen is stale.
        current["phase"] = "roundScores"
        for seat in range(3):
            stale = await self.ready(seat)
            self.assertEqual(stale["readySeats"], [False] * 3)
            self.assertEqual(stale["roundIndex"], 1)
        self.assertTrue(any(view["roundIndex"] == 1 for view in outcomes))

    async def test_disconnected_human_still_blocks_until_explicit_bot_replacement(self):
        state = self.rooms.docs["STABLE"]
        state["players"][2]["last_seen"] = 0
        await self.ready(0)
        waiting = await self.ready(1)
        self.assertEqual(waiting["phase"], "roundScores")
        self.assertFalse(waiting["players"][2]["connected"])
        for _ in range(3):
            waiting = await server.get_room("STABLE", "player-0")
            self.assertEqual(waiting["phase"], "roundScores")
        next_round = await server.replace_with_bot("STABLE", server.ReplaceReq(token="player-0", seat=2))
        self.assertEqual(next_round["roundIndex"], 1)
        self.assertEqual(next_round["readySeats"], [False, False, True])

    async def test_spectators_bots_and_missing_round_identity_cannot_confirm(self):
        self.rooms.docs["STABLE"]["players"][2]["isBot"] = True
        for token, status in [("watcher", 403), ("player-2", 403)]:
            with self.assertRaises(HTTPException) as error:
                await server.room_action("STABLE", server.ActionReq(token=token, type="nextRound", roundId="first-round"))
            self.assertEqual(error.exception.status_code, status)
        with self.assertRaises(HTTPException) as error:
            await server.room_action("STABLE", server.ActionReq(token="player-0", type="nextRound"))
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.rooms.docs["STABLE"]["readySeats"], [False] * 3)
        view = await server.get_room("STABLE", "watcher")
        self.assertEqual(view["readySeats"], [False, False, True])
        self.assertFalse(view["iReady"])
        self.assertNotIn("hands", view)

    async def test_bots_auto_ready_and_rematch_resets_round_identity_and_readiness(self):
        self.rooms.docs["STABLE"]["players"][2]["isBot"] = True
        await self.ready(0)
        view = await self.ready(1)
        self.assertEqual(view["roundIndex"], 1)
        state = self.rooms.docs["STABLE"]
        state.update(status="gameOver", phase="gameOver", readySeats=[True] * 3)
        rematch = await server.rematch_room("STABLE", server.TokenReq(token="player-0"))
        self.assertEqual(rematch["roundIndex"], 0)
        self.assertNotEqual(rematch["roundId"], view["roundId"])
        self.assertEqual(rematch["readySeats"], [False, False, True])
        self.rooms.docs["STABLE"]["phase"] = "roundScores"
        stale = await self.ready(0, view["roundId"])
        self.assertEqual(stale["readySeats"], [False, False, True])

    async def test_match_finishing_confirmation_does_not_wait_for_next_round(self):
        self.rooms.docs["STABLE"]["scores"] = [70, 1, 2]
        finished = await self.ready(1)
        self.assertEqual(finished["status"], "gameOver")
        self.assertEqual(len(self.results.docs), 1)

    async def test_confirmed_pass_cards_are_visible_only_to_their_owner(self):
        state = self.rooms.docs["STABLE"]
        state["phase"] = "passing"
        chosen = [card["id"] for card in state["hands"][0][:4]]
        state["pendingSelections"] = {"0": chosen}
        own = server._redact(state, "player-0")
        self.assertEqual([card["id"] for card in own["yourPassedCards"]], chosen)
        self.assertEqual(server._redact(state, "player-1")["yourPassedCards"], [])
        self.assertEqual(server._redact(state, "watcher")["yourPassedCards"], [])


class ChatSoundTests(FlowSandbox):
    async def test_only_allowlisted_structured_sound_messages_are_public(self):
        for index, sound in enumerate(sorted(server.CHAT_SOUND_IDS)):
            self.clock.return_value = 100 + index * 2
            view = await server.room_chat("STABLE", server.ChatReq(token="player-0", sound=sound))
            message = view["chatMessages"][-1]
            self.assertEqual(message["sound"], sound)
            self.assertEqual(message["text"], "")
            self.assertEqual(set(message), {"id", "seat", "name", "text", "sound", "createdAt"})
        public = server._redact(self.rooms.docs["STABLE"], "watcher")
        self.assertEqual(public["chatMessages"], view["chatMessages"])
        self.assertEqual(public["yourHand"], [])

    async def test_invalid_sound_ids_mixed_payloads_and_external_audio_are_rejected(self):
        client = TestClient(server.app, raise_server_exceptions=False)
        try:
            for payload, expected in [
                ({"sound": "https://example.test/voice.mp3"}, 400),
                ({"sound": "data:audio/mp3;base64,YQ=="}, 400),
                ({"sound": "<audio autoplay>"}, 400),
                ({"sound": "constructor"}, 400),
                ({"sound": "siren", "text": "hello"}, 400),
                ({"sound": "siren", "url": "https://example.test"}, 422),
                ({"sound": "siren", "audio": "payload"}, 422),
            ]:
                response = client.post("/api/rooms/STABLE/chat", json={"token": "player-0", **payload})
                self.assertEqual(response.status_code, expected, payload)
            self.assertNotIn("chatMessages", self.rooms.docs["STABLE"])
        finally:
            client.close()

    async def test_sound_and_text_share_cooldown_retention_and_never_advance_gameplay(self):
        original = copy.deepcopy(self.rooms.docs["STABLE"])
        await server.room_chat("STABLE", server.ChatReq(token="player-0", sound="siren"))
        with self.assertRaises(HTTPException) as error:
            await server.room_chat("STABLE", server.ChatReq(token="player-0", text="Soon"))
        self.assertEqual(error.exception.status_code, 429)
        for index in range(34):
            self.clock.return_value = 102 + index * 2
            await server.room_chat("STABLE", server.ChatReq(token="player-0", sound="scratch"))
        saved = self.rooms.docs["STABLE"]
        self.assertEqual(len(saved["chatMessages"]), 30)
        for key in ("phase", "hands", "roundIndex", "trick", "readySeats"):
            self.assertEqual(saved[key], original[key])

    async def test_spectators_and_bots_cannot_send_sound_messages(self):
        self.rooms.docs["STABLE"]["players"][2]["isBot"] = True
        for token in ("watcher", "player-2"):
            with self.assertRaises(HTTPException) as error:
                await server.room_chat("STABLE", server.ChatReq(token=token, sound="siren"))
            self.assertEqual(error.exception.status_code, 403)


class CompleteMatchTests(FlowSandbox):
    async def test_three_to_six_player_matches_and_rematches_require_every_human(self):
        with patch.object(server, "BOT_PLAY_DELAY", 0), patch.object(server, "TRICK_HOLD_SECONDS", 0):
            for n in range(3, 7):
                with self.subTest(n=n):
                    crew = [player(seat, bot=seat >= 2) for seat in range(n)]
                    self.rooms.docs["STABLE"] = lobby(players=crew)
                    self.results.docs.clear()
                    view = await server.start_room("STABLE", server.TokenReq(token="player-0"))
                    first_round_id = view["roundId"]
                    completed = 0
                    for _ in range(8000):
                        if view["status"] == "gameOver":
                            break
                        state = self.rooms.docs["STABLE"]
                        if view["phase"] == "passing":
                            seat = next(seat for seat in (0, 1) if str(seat) not in state["pendingSelections"])
                            payload = dict(type="pass", cards=[card["id"] for card in state["hands"][seat][:state["passCount"]]])
                        elif view["phase"] == "playing":
                            seat = state["currentSeat"]
                            self.assertLess(seat, 2, "Due bot turns must advance to the next human")
                            payload = dict(type="play", cardId=server.eng.legal_card_ids(state["hands"][seat], state["trick"])[0])
                        elif view["phase"] == "trickEnd":
                            seat = 0
                            payload = dict(type="continueTrick")
                        elif view["phase"] == "roundScores":
                            completed += 1
                            round_id = view["roundId"]
                            first_ready = await self.ready(0, round_id)
                            if not server.eng.is_game_over(view["scores"]):
                                self.assertEqual(first_ready["phase"], "roundScores")
                                self.assertEqual(first_ready["roundIndex"], view["roundIndex"])
                                self.assertEqual(first_ready["readySeats"], [True, False] + [True] * (n - 2))
                                view = await self.ready(1, round_id)
                                self.assertEqual(view["readySeats"], [False, False] + [True] * (n - 2))
                            else:
                                view = first_ready
                            continue
                        else:
                            self.fail(f"Unexpected phase {view['phase']}")
                        view = await server.room_action("STABLE", server.ActionReq(token=f"player-{seat}", **payload))
                        public = server._redact(self.rooms.docs["STABLE"], "watcher")
                        self.assertEqual(public["yourHand"], [])
                        self.assertFalse(public["iReady"])
                        self.assertNotIn("hands", public)
                    else:
                        self.fail(f"{n}-seat match did not finish")
                    self.assertGreater(completed, 0)
                    self.assertEqual(view["totalRounds"], completed)
                    self.assertEqual(len(self.results.docs), 1)
                    rematch = await server.rematch_room("STABLE", server.TokenReq(token="player-0"))
                    self.assertEqual(rematch["roundIndex"], 0)
                    self.assertEqual(rematch["scores"], [0] * n)
                    self.assertEqual(rematch["readySeats"], [False, False] + [True] * (n - 2))
                    self.assertNotEqual(rematch["roundId"], first_round_id)
                    self.assertEqual(sum(rematch["handCounts"]), 60)
