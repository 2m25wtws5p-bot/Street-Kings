"""Production presentation deadlines and public last-trick presence."""
import copy
import unittest
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
import server


def room():
    return {
        "_id": "TIMING", "host_token": "human", "status": "playing",
        "phase": "playing", "n": 3, "roundIndex": 0, "trickNumber": 1,
        "currentSeat": 0, "scores": [0, 0, 0], "piles": [[], [], []],
        "trick": [], "lastTrick": None, "lastWinner": None,
        "players": [{"seat": i, "name": f"P{i}", "avatar": {},
                     "isBot": i != 0, "token": "human" if i == 0 else f"bot{i}"}
                    for i in range(3)],
        "hands": [[{"id": f"RED-{i+1}", "suit": "RED", "value": i+1, "special": None},
                   {"id": f"BLUE-{i+1}", "suit": "BLUE", "value": i+1, "special": None}]
                  for i in range(3)],
    }


class TimingTests(unittest.TestCase):
    def test_bot_cards_are_individually_visible_and_full_trick_is_held(self):
        state = room()
        with patch.object(server, "BOT_PLAY_DELAY", .95), patch.object(server, "TRICK_HOLD_SECONDS", 2), patch.object(server.time, "time", return_value=100) as clock:
            server._apply_play(state, "RED-1")
            server._advance_bots(state)
            self.assertEqual(len(state["trick"]), 1)
            clock.return_value = 101
            server._advance_bots(state)
            self.assertEqual(len(state["trick"]), 2)
            # Other players polling at the same instant cannot accelerate bots.
            server._advance_bots(state)
            self.assertEqual(len(state["trick"]), 2)
            clock.return_value = 102
            server._advance_bots(state)
            self.assertEqual(state["phase"], "trickEnd")
            self.assertEqual(len(state["trick"]), 3)
            completed = copy.deepcopy(state["trick"])
            clock.return_value = 103.9
            server._advance_bots(state)
            self.assertEqual(state["trick"], completed)
            clock.return_value = 104
            server._advance_bots(state)
            self.assertEqual(state["phase"], "playing")
            self.assertEqual(state["trick"], [])
            self.assertEqual(state["lastTrick"], completed)
            self.assertGreater(state["nextBotAt"], 104)

    def test_review_presence_is_public_but_expires_and_hands_stay_private(self):
        state = room()
        state["players"][0]["review_until"] = 106
        with patch.object(server.time, "time", return_value=100):
            spectator = server._redact(state, "unknown")
            self.assertTrue(spectator["players"][0]["reviewingLastTrick"])
            self.assertEqual(spectator["yourHand"], [])
            self.assertNotIn("hands", spectator)
            self.assertNotIn("token", spectator["players"][0])
        with patch.object(server.time, "time", return_value=107):
            self.assertFalse(server._redact(state, "human")["players"][0]["reviewingLastTrick"])


class ReviewActionTests(unittest.IsolatedAsyncioTestCase):
    async def test_open_close_and_unauthenticated_review(self):
        state = room()
        state["lastTrick"] = [{"seat": 0, "card": state["hands"][0][0]}]
        with patch.object(server, "_get_room", AsyncMock(return_value=state)), patch.object(server, "_save_room", AsyncMock()), patch.object(server.time, "time", return_value=100):
            result = await server.room_action("TIMING", server.ActionReq(token="human", type="reviewLastTrick", reviewing=True))
            self.assertTrue(result["players"][0]["reviewingLastTrick"])
            result = await server.room_action("TIMING", server.ActionReq(token="human", type="reviewLastTrick", reviewing=False))
            self.assertFalse(result["players"][0]["reviewingLastTrick"])
            with self.assertRaises(HTTPException) as error:
                await server.room_action("TIMING", server.ActionReq(token="unknown", type="reviewLastTrick", reviewing=True))
            self.assertEqual(error.exception.status_code, 403)

    async def test_host_cannot_collect_before_minimum_hold(self):
        state = room()
        state.update(phase="trickEnd", lastWinner=0, trickEndedAt=100)
        with patch.object(server, "_get_room", AsyncMock(return_value=state)), patch.object(server, "TRICK_HOLD_SECONDS", 2), patch.object(server.time, "time", return_value=101):
            with self.assertRaises(HTTPException) as error:
                await server.room_action("TIMING", server.ActionReq(token="human", type="continueTrick"))
            self.assertEqual(error.exception.status_code, 409)
