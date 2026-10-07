"""Private, per-round card exchange recaps available only in tricks 1–3."""
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import server


def room(n=4, round_index=0):
    return {
        "_id": "EXCHANGE", "host_token": "player-0", "status": "playing",
        "phase": "passing", "n": n, "roundIndex": round_index,
        "trickNumber": 1, "scores": [0] * n, "piles": [[] for _ in range(n)],
        "trick": [], "lastTrick": None, "lastWinner": None,
        "players": [{"seat": seat, "name": f"Player {seat}", "avatar": {},
                     "isBot": False, "token": f"player-{seat}"}
                    for seat in range(n)],
        "spectators": [{"name": "Watcher", "token": "spectator-token"}],
        "hands": server.eng.deal(server.eng.make_deck(), n),
    }


def exchange(state):
    server._setup_passing(state)
    if state["passDir"]:
        state["pendingSelections"] = {
            str(seat): [card["id"] for card in hand[:state["passCount"]]]
            for seat, hand in enumerate(state["hands"])
        }
        server._apply_passes(state)
    return state


class ExchangeHistoryTests(unittest.TestCase):
    def test_every_supported_pass_direction_records_the_actual_cards_and_people(self):
        cycles = {3: [1, -1], 4: [1, -1, 2], 5: [1, -1], 6: [1, -1, 3]}
        for n, directions in cycles.items():
            for round_index, direction in enumerate(directions):
                with self.subTest(players=n, direction=direction):
                    state = room(n, round_index)
                    original = copy.deepcopy(state["hands"])
                    exchange(state)
                    self.assertEqual(state["passDir"], direction)
                    self.assertEqual(state["passCount"], {3: 4, 4: 3, 5: 3, 6: 2}[n])
                    for seat in range(n):
                        target = server.eng.target_seat(seat, direction, n)
                        source = next(i for i in range(n)
                                      if server.eng.target_seat(i, direction, n) == seat)
                        history = state["exchangeHistory"][str(seat)]
                        sent = original[seat][:state["passCount"]]
                        received = original[source][:state["passCount"]]
                        self.assertEqual(history["sent"], sent)
                        self.assertEqual(history["sentTo"], f"Player {target}")
                        self.assertEqual(history["receivedFrom"], f"Player {source}")
                        self.assertEqual(history["received"], [
                            {**card, "receivedFrom": f"Player {source}"} for card in received
                        ])
                        own_ids = {card["id"] for card in state["hands"][seat]}
                        self.assertTrue({card["id"] for card in received}.issubset(own_ids))
                        self.assertTrue({card["id"] for card in sent}.isdisjoint(own_ids))
                        self.assertEqual(len(state["hands"][seat]), len(original[seat]))

    def test_snapshots_survive_play_and_do_not_alias_hands_or_returned_views(self):
        state = room()
        # Deep copying also protects future card metadata, not just today's flat fields.
        state["hands"][0][0]["metadata"] = {"original": True}
        original_card = state["hands"][0][0]
        exchange(state)
        recipient = server.eng.target_seat(0, state["passDir"], state["n"])
        incoming_card = next(card for card in state["hands"][recipient]
                             if card["id"] == original_card["id"])
        expected = copy.deepcopy(state["exchangeHistory"])
        self.assertIsNot(state["exchangeHistory"]["0"]["sent"][0], original_card)
        self.assertIsNot(state["exchangeHistory"][str(recipient)]["received"][0], incoming_card)
        incoming_card["metadata"]["original"] = False
        original_card["value"] = -1
        state["currentSeat"] = recipient
        server._apply_play(state, incoming_card["id"])
        self.assertNotIn(incoming_card["id"], [c["id"] for c in state["hands"][recipient]])
        self.assertEqual(state["exchangeHistory"], expected)
        view = server._redact(state, f"player-{recipient}")
        self.assertEqual(view["yourExchange"], expected[str(recipient)])
        view["yourExchange"]["received"][0]["value"] = -99
        self.assertEqual(state["exchangeHistory"], expected)

    def test_viewers_only_get_their_own_exchange_and_never_raw_history(self):
        state = exchange(room())
        for seat in range(state["n"]):
            with self.subTest(seat=seat):
                view = server._redact(state, f"player-{seat}")
                self.assertEqual(view["yourExchange"], state["exchangeHistory"][str(seat)])
                self.assertNotIn("exchangeHistory", view)
                self.assertNotIn("pendingSelections", view)
                self.assertNotIn("hands", view)
                self.assertEqual(set(view["yourExchange"]), {"sent", "received", "sentTo", "receivedFrom"})
        for token in ("spectator-token", "unknown-token", ""):
            with self.subTest(token=token):
                view = server._redact(state, token)
                self.assertIsNone(view["yourExchange"])
                self.assertEqual(view["yourHand"], [])
                self.assertNotIn("exchangeHistory", view)

    def test_recap_is_only_available_during_first_three_tricks(self):
        state = exchange(room())
        for phase in ("playing", "trickEnd", "passing", "roundScores", "gameOver"):
            for trick_number in (0, 1, 2, 3, 4, 15):
                with self.subTest(phase=phase, trick_number=trick_number):
                    state.update(phase=phase, trickNumber=trick_number)
                    view = server._redact(state, "player-0")
                    allowed = phase in ("playing", "trickEnd") and 1 <= trick_number <= 3
                    self.assertEqual(view["yourExchange"] is not None, allowed)
        state.update(status="lobby", phase="lobby")
        self.assertNotIn("exchangeHistory", server._redact(state, "player-0"))
        self.assertIsNone(server._redact(state, "player-0").get("yourExchange"))

    def test_existing_rooms_without_saved_history_do_not_invent_a_recap(self):
        state = exchange(room())
        state.pop("exchangeHistory")
        self.assertIsNone(server._redact(state, "player-0")["yourExchange"])

    def test_bot_prefilled_passes_produce_the_same_private_recap(self):
        for n in range(3, 7):
            with self.subTest(players=n):
                state = room(n)
                for player in state["players"][1:]:
                    player["isBot"] = True
                server._setup_passing(state)
                state["pendingSelections"]["0"] = [
                    card["id"] for card in state["hands"][0][:state["passCount"]]
                ]
                selected = copy.deepcopy(state["pendingSelections"])
                server._advance_bots(state)
                self.assertEqual(state["phase"], "playing")
                self.assertEqual(state["currentSeat"], 0)
                for seat in range(n):
                    history = state["exchangeHistory"][str(seat)]
                    self.assertEqual({card["id"] for card in history["sent"]}, set(selected[str(seat)]))
                    self.assertEqual(len(history["received"]), state["passCount"])
                self.assertEqual(server._redact(state, "player-0")["yourExchange"], state["exchangeHistory"]["0"])

    def test_next_round_resets_old_history_and_never_skips_passing(self):
        for round_index in range(6):
            with self.subTest(round_index=round_index):
                state = exchange(room(4, round_index))
                self.assertTrue(state["exchangeHistory"])
                server._do_next_round(state)
                self.assertEqual(state["exchangeHistory"], {})
                self.assertIsNone(server._redact(state, "player-0")["yourExchange"])
                self.assertEqual(state["phase"], "passing")
                self.assertEqual(state["passDir"], [1, -1, 2][(round_index + 1) % 3])


class ExchangeResetActionTests(unittest.IsolatedAsyncioTestCase):
    async def test_start_and_rematch_reset_stale_exchange_history(self):
        for action, status in ((server.start_room, "lobby"), (server.rematch_room, "gameOver")):
            with self.subTest(status=status):
                state = exchange(room())
                state["status"] = status
                with patch.object(server, "_get_room", AsyncMock(return_value=state)), \
                        patch.object(server, "_save_room", AsyncMock()):
                    response = await action("EXCHANGE", SimpleNamespace(token="player-0"))
                self.assertEqual(state["exchangeHistory"], {})
                self.assertIsNone(response["yourExchange"])
                self.assertEqual(state["phase"], "passing")


if __name__ == "__main__":
    unittest.main()
