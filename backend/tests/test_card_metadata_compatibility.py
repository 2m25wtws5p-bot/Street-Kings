"""Stable card identities and non-destructive persisted metadata upgrades."""
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
import server
import street_kings_engine as eng
from test_server_stability import MemoryCollection, playing


def retire_metadata(value):
    if isinstance(value, dict):
        if "suit" in value and "value" in value and "id" in value:
            value["special"] = "retired-kind"
        else:
            for nested in value.values():
                retire_metadata(nested)
    elif isinstance(value, list):
        for nested in value:
            retire_metadata(nested)


class CardMetadataTests(unittest.TestCase):
    def test_every_card_container_is_normalized_without_changing_ids_or_metadata(self):
        deck = eng.make_deck()
        state = {"hands": [copy.deepcopy(deck)], "piles": [copy.deepcopy(deck)],
                 "trick": [{"seat": 0, "card": copy.deepcopy(card)} for card in deck],
                 "lastTrick": [{"seat": 1, "card": copy.deepcopy(card)} for card in deck],
                 "exchangeHistory": {"0": {"sent": copy.deepcopy(deck), "received": copy.deepcopy(deck), "sentTo": "Ace"}},
                 "version": 7, "scores": [1, 2, 3], "pendingSelections": {"0": ["W1"]}}
        retire_metadata(state)
        state["hands"][0][0]["receivedFrom"] = "Ruby"
        before = copy.deepcopy(state)
        eng.normalize_room_cards(state)
        for field in ["hands", "piles"]:
            self.assertEqual(state[field][0], [{**card, **({"receivedFrom": "Ruby"} if field == "hands" and index == 0 else {})} for index, card in enumerate(deck)])
        self.assertEqual([entry["card"] for entry in state["trick"]], deck)
        self.assertEqual([entry["card"] for entry in state["lastTrick"]], deck)
        self.assertEqual(state["exchangeHistory"]["0"]["sent"], deck)
        self.assertEqual(state["exchangeHistory"]["0"]["received"], deck)
        for field in ["version", "scores", "pendingSelections"]:
            self.assertEqual(state[field], before[field])
        normalized = copy.deepcopy(state)
        self.assertEqual(eng.normalize_room_cards(state), normalized, "Upgrade is idempotent")

    def test_completed_results_rebuild_explanations_but_preserve_awarded_scores(self):
        deck = eng.make_deck()
        for n in range(3, 7):
            for previous in [[0] * n, [68, *([10] * (n - 1))], [0, *([68] * (n - 1))]]:
                for capture in [deck, [card for card in deck if card["suit"] in ("RED", "GREEN")]]:
                    piles = [copy.deepcopy(capture), [card for card in deck if card not in capture], *([[]] * (n - 2))]
                    expected = eng.score_round(piles, previous)
                    scores = [score + row["total"] for score, row in zip(previous, expected["results"])]
                    state = {"piles": piles, "scores": scores, "version": 8,
                             "roundResult": {"results": [{"total": row["total"], "retiredFlag": True} for row in expected["results"]], "retiredName": "archived"}}
                    retire_metadata(state["piles"])
                    eng.normalize_room_cards(state)
                    self.assertEqual(state["roundResult"], expected)
                    self.assertEqual(state["scores"], scores)
                    self.assertEqual(state["version"], 8)
        ordinary = eng.deal(deck, 3)
        expected = eng.score_round(ordinary)
        state = {"piles": ordinary, "scores": [10, 20, 30], "roundResult": {"results": [{"total": 9}, {"total": 8}, {"total": 7}]}}
        eng.normalize_room_cards(state)
        self.assertEqual([row["total"] for row in state["roundResult"]["results"]], [9, 8, 7], "Historical awarded points are not recalculated")
        self.assertEqual(state["scores"], [10, 20, 30])
        self.assertEqual(state["roundResult"]["results"][0]["heatCards"], expected["results"][0]["heatCards"])


class UpgradeAuthorizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_database_reads_and_rejected_actions_do_not_write_or_change_versions(self):
        state = playing()
        retire_metadata(state["hands"])
        rooms = MemoryCollection([state])
        before = copy.deepcopy(rooms.docs["STABLE"])
        with patch.object(server, "db", SimpleNamespace(rooms=rooms)):
            upgraded = await server._get_room("STABLE")
            self.assertEqual(upgraded["version"], before["version"])
            self.assertEqual(upgraded["hands"], eng.deal(eng.make_deck(), 3))
            self.assertEqual(rooms.docs["STABLE"], before)
            with self.assertRaises(HTTPException) as error:
                await server.room_action("STABLE", server.ActionReq(token="foreign-access", type="play", cardId="RED-1"))
            self.assertEqual(error.exception.status_code, 403)
            self.assertEqual(rooms.docs["STABLE"], before)
            self.assertEqual(rooms.replace_calls, [])

    async def test_authorized_move_keeps_the_existing_compare_and_swap_contract(self):
        state = playing()
        state["version"] = 7
        retire_metadata(state["hands"])
        rooms = MemoryCollection([state])
        with patch.object(server, "db", SimpleNamespace(rooms=rooms)), patch.object(server.time, "time", return_value=100):
            view = await server.room_action("STABLE", server.ActionReq(token="player-0", type="play", cardId="RED-1"))
        self.assertEqual(view["version"], state["version"] + 1)
        self.assertEqual(rooms.replace_calls[0][0]["version"], state["version"])
        self.assertEqual(rooms.docs["STABLE"]["hands"][0][0]["special"], None)
        self.assertEqual(view["trick"][0]["card"]["id"], "RED-1")
