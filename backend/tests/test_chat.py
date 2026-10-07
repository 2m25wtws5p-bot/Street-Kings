"""Room chat shares game persistence, while publishing only public message data."""
import asyncio
import copy
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

import server


AVATAR = {"key": "boss", "label": "Boss", "color": "#C084FC"}
PUBLIC_MESSAGE_FIELDS = {"id", "seat", "name", "text", "createdAt"}


def room(status="lobby"):
    state = {"_id": "CHAT1", "host_token": "player-0", "status": status,
             "phase": "lobby" if status == "lobby" else "playing", "version": 0,
             "players": [{"seat": seat, "token": f"player-{seat}",
                          "name": f"Player {seat}", "avatar": AVATAR.copy(),
                          "isBot": False, "last_seen": 100.0}
                         for seat in range(3)],
             "spectators": [{"token": "spec-token", "name": "Watcher"}]}
    if status != "lobby":
        state.update(n=3, roundIndex=0, scores=[0, 0, 0], piles=[[], [], []],
                     hands=server.eng.deal(server.eng.make_deck(), 3), trick=[],
                     currentSeat=0, leader=0, lastTrick=None, lastWinner=None,
                     trickNumber=1)
    if status == "gameOver":
        state["phase"] = "gameOver"
    return state


def matches(document, query):
    for key, value in query.items():
        if key == "$or":
            if not any(matches(document, alternative) for alternative in value):
                return False
        elif isinstance(value, dict) and "$exists" in value:
            if (key in document) != value["$exists"]:
                return False
        elif document.get(key) != value:
            return False
    return True


class MemoryRooms:
    """Separate reads and compare-and-swap writes expose stale-save failures."""
    def __init__(self):
        self.docs = {"CHAT1": room()}

    async def find_one(self, query):
        await asyncio.sleep(0)
        return next((copy.deepcopy(doc) for doc in self.docs.values()
                     if matches(doc, query)), None)

    async def replace_one(self, query, replacement, upsert=False):
        await asyncio.sleep(0)
        self.assert_no_upsert(upsert)
        doc = next((doc for doc in self.docs.values() if matches(doc, query)), None)
        if doc is None:
            return SimpleNamespace(matched_count=0)
        self.docs[doc["_id"]] = copy.deepcopy(replacement)
        return SimpleNamespace(matched_count=1)

    @staticmethod
    def assert_no_upsert(upsert):
        if upsert:
            raise AssertionError("Room writes must not upsert expired/stale rooms")

    async def insert_one(self, document):
        await asyncio.sleep(0)
        self.docs[document["_id"]] = copy.deepcopy(document)
        return SimpleNamespace(inserted_id=document["_id"])


class ChatTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        server._locks.clear()
        self.rooms = MemoryRooms()
        self.db_patch = patch.object(server, "db", SimpleNamespace(rooms=self.rooms))
        self.db_patch.start()
        self.time_patch = patch.object(server.time, "time", return_value=100.0)
        self.clock = self.time_patch.start()

    def tearDown(self):
        self.time_patch.stop()
        self.db_patch.stop()

    async def send(self, text="Hello", token="player-0", code="CHAT1"):
        return await server.room_chat(code, server.ChatReq(token=token, text=text))

    async def assert_http_error(self, status, request):
        with self.assertRaises(HTTPException) as raised:
            await request
        self.assertEqual(raised.exception.status_code, status)

    async def test_only_seated_humans_can_send(self):
        self.rooms.docs["CHAT1"]["players"][2]["isBot"] = True
        for token in ("", "unknown-token", "spec-token", "player-2"):
            with self.subTest(token=token):
                await self.assert_http_error(403, self.send(token=token))
        self.assertNotIn("chatMessages", self.rooms.docs["CHAT1"])
        self.assertEqual(self.rooms.docs["CHAT1"]["version"], 0)

    async def test_chat_works_in_lobby_playing_and_game_over_without_advancing_game(self):
        for status in ("lobby", "playing", "gameOver"):
            with self.subTest(status=status):
                original = room(status)
                self.rooms.docs["CHAT1"] = copy.deepcopy(original)
                with patch.object(server, "_advance_bots", side_effect=AssertionError("Chat advanced bots")):
                    view = await self.send("  👨‍👩‍👧‍👦 Good game!  ")
                message = view["chatMessages"][0]
                self.assertEqual(set(message), PUBLIC_MESSAGE_FIELDS)
                self.assertEqual(message["text"], "👨‍👩‍👧‍👦 Good game!")
                self.assertEqual(message["seat"], 0)
                self.assertEqual(message["name"], "Player 0")
                self.assertEqual(message["createdAt"], 100000)
                self.assertIsInstance(message["id"], str)
                self.assertEqual(view["version"], 1)
                saved = self.rooms.docs["CHAT1"]
                for key in original.keys() - {"players", "version"}:
                    self.assertEqual(saved[key], original[key], key)
        self.rooms.docs["CHAT1"] = room("closed")
        await self.assert_http_error(409, self.send())

    async def test_text_validation_rejects_blank_long_and_control_messages(self):
        invalid = ("", "   ", "\u2003", "a" * 141, "Hi\nthere", "\tHi", "Hi\r",
                   "Hi\x00", "Hi\x7f", "Hi\x85", "Hi\u2028there", "Hi\u2029there", "\ud800")
        for text in invalid:
            with self.subTest(text=repr(text)):
                await self.assert_http_error(400, self.send(text))
        self.assertEqual(self.rooms.docs["CHAT1"]["version"], 0)
        view = await self.send("  " + "🃏" * 140 + "  ")
        self.assertEqual(view["chatMessages"][0]["text"], "🃏" * 140)

    async def test_api_validates_types_and_delivers_the_room_view(self):
        client = TestClient(server.app, raise_server_exceptions=False)
        try:
            for bad_text in (None, 42, [], {}):
                response = client.post("/api/rooms/CHAT1/chat", json={"token": "player-0", "text": bad_text})
                self.assertEqual(response.status_code, 422)
            response = client.post("/api/rooms/CHAT1/chat", json={"token": "player-0", "text": "🙂"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["chatMessages"][0]["text"], "🙂")
            self.assertEqual(response.json()["yourSeat"], 0)
        finally:
            client.close()

    async def test_missing_room_is_404(self):
        await self.assert_http_error(404, self.send(code="NONE1"))

    async def test_public_messages_never_include_tokens_or_private_hands(self):
        self.rooms.docs["CHAT1"] = room("playing")
        await self.send("<img src=x onerror=alert(1)>")
        self.rooms.docs["CHAT1"]["chatMessages"][0].update(
            token="private-secret", hands=self.rooms.docs["CHAT1"]["hands"])
        for token in ("player-1", "spec-token", "unknown-token", ""):
            view = server._redact(self.rooms.docs["CHAT1"], token)
            self.assertEqual(set(view["chatMessages"][0]), PUBLIC_MESSAGE_FIELDS)
            self.assertEqual(view["chatMessages"][0]["text"], "<img src=x onerror=alert(1)>")
            self.assertNotIn("hands", view)
            self.assertNotIn("players", view["chatMessages"][0])
            if token != "player-1":
                self.assertEqual(view["yourHand"], [])
        view["chatMessages"][0]["text"] = "modified"
        self.assertNotEqual(self.rooms.docs["CHAT1"]["chatMessages"][0]["text"], "modified")

    async def test_cooldown_is_per_player_and_survives_reloading_room_locks(self):
        await self.send()
        server._locks.clear()
        self.clock.return_value = 101.49
        await self.assert_http_error(429, self.send("Too soon"))
        other = await self.send("Other player", token="player-1")
        self.assertEqual(len(other["chatMessages"]), 2)
        self.clock.return_value = 101.5
        view = await self.send("On time")
        self.assertEqual(len(view["chatMessages"]), 3)
        self.assertNotIn("last_chat_at", view["players"][0])

    async def test_room_only_keeps_the_latest_thirty_messages(self):
        for index in range(35):
            self.clock.return_value = 100 + index * 2
            view = await self.send(f"Message {index}")
        messages = self.rooms.docs["CHAT1"]["chatMessages"]
        self.assertEqual(len(messages), 30)
        self.assertEqual([message["text"] for message in messages],
                         [f"Message {index}" for index in range(5, 35)])
        self.assertEqual(view["chatMessages"], messages)
        self.assertEqual(len({message["id"] for message in messages}), 30)

    async def test_concurrent_duplicate_sends_accept_once_and_keep_cooldown(self):
        outcomes = await asyncio.gather(self.send("First"), self.send("Second"), return_exceptions=True)
        self.assertEqual(sum(isinstance(outcome, dict) for outcome in outcomes), 1)
        errors = [outcome for outcome in outcomes if isinstance(outcome, HTTPException)]
        self.assertEqual([error.status_code for error in errors], [429])
        self.assertEqual(len(self.rooms.docs["CHAT1"]["chatMessages"]), 1)

    async def test_concurrent_players_do_not_lose_messages(self):
        await asyncio.gather(self.send("One"), self.send("Two", token="player-1"))
        self.assertEqual({message["text"] for message in self.rooms.docs["CHAT1"]["chatMessages"]}, {"One", "Two"})
        self.assertEqual(self.rooms.docs["CHAT1"]["version"], 2)

    async def test_chat_and_card_action_preserve_each_others_changes(self):
        original = room("playing")
        self.rooms.docs["CHAT1"] = copy.deepcopy(original)
        card_id = server.eng.legal_card_ids(original["hands"][0], original["trick"])[0]
        await asyncio.gather(self.send("Nice", token="player-1"), server.room_action(
            "CHAT1", server.ActionReq(token="player-0", type="play", cardId=card_id)))
        saved = self.rooms.docs["CHAT1"]
        self.assertEqual(saved["chatMessages"][0]["text"], "Nice")
        self.assertEqual(saved["trick"][0]["card"]["id"], card_id)
        self.assertNotIn(card_id, [card["id"] for card in saved["hands"][0]])
        self.assertEqual(saved["version"], 2)

    async def test_cross_process_version_conflict_preserves_external_card_action(self):
        original = room("playing")
        self.rooms.docs["CHAT1"] = copy.deepcopy(original)
        card_id = original["hands"][0][0]["id"]
        replace = self.rooms.replace_one

        async def external_action_before_save(query, replacement, upsert=False):
            current = self.rooms.docs["CHAT1"]
            server._apply_play(current, card_id)
            current["version"] += 1
            return await replace(query, replacement, upsert)

        with patch.object(self.rooms, "replace_one", side_effect=external_action_before_save):
            await self.assert_http_error(409, self.send())
        saved = self.rooms.docs["CHAT1"]
        self.assertEqual(saved["trick"][0]["card"]["id"], card_id)
        self.assertNotIn("chatMessages", saved)
        self.assertNotIn("last_chat_at", saved["players"][0])

    async def test_create_join_and_watch_trim_then_keep_twenty_four_character_names(self):
        name = "abcdefghijklmnopqrstuvwx"
        with patch.object(server, "_gen_code", return_value="NAMES"):
            created = await server.create_room(server.CreateRoom(name=f"   {name}EXTRA   ", avatar=AVATAR))
        self.assertEqual(self.rooms.docs["NAMES"]["players"][0]["name"], name)
        await self.assert_http_error(409, server.join_room("NAMES", server.JoinRoom(
            name=f"   {name.upper()}EXTRA   ", avatar=AVATAR)))
        await server.join_room("NAMES", server.JoinRoom(name="   " + "Z" * 30, avatar=AVATAR))
        self.assertEqual(self.rooms.docs["NAMES"]["players"][1]["name"], "Z" * 24)
        await server.watch_room("NAMES", server.WatchRoom(name="   " + "W" * 30))
        self.assertEqual(self.rooms.docs["NAMES"]["spectators"][0]["name"], "W" * 24)
        self.assertEqual(created["seat"], 0)

    async def test_replaced_bot_name_is_capped_at_twenty_four_characters(self):
        self.rooms.docs["CHAT1"] = room("playing")
        target = self.rooms.docs["CHAT1"]["players"][1]
        target.update(name="abcdefghijklmnopqrstuvwx", last_seen=0)
        view = await server.replace_with_bot("CHAT1", server.ReplaceReq(token="player-0", seat=1))
        self.assertEqual(view["players"][1]["name"], "abcdefghijklmnopqrs (KI)")
        self.assertEqual(len(view["players"][1]["name"]), 24)

    async def test_lobby_bot_removal_moves_chat_bubbles_with_the_human_seat(self):
        self.rooms.docs["CHAT1"]["players"] = self.rooms.docs["CHAT1"]["players"][:1]
        await server.manage_bots("CHAT1", server.BotsReq(token="player-0", action="add"))
        joined = await server.join_room("CHAT1", server.JoinRoom(name="Late joiner", avatar=AVATAR))
        self.assertEqual(joined["seat"], 2)
        await self.send("Hello", token=joined["token"])
        view = await server.manage_bots("CHAT1", server.BotsReq(token="player-0", action="remove"))
        self.assertEqual(view["n"], 2)
        self.assertEqual(view["players"][1]["name"], "Late joiner")
        self.assertEqual(view["chatMessages"][0]["seat"], 1)
        self.assertEqual(view["chatMessages"][0]["name"], "Late joiner")
        await self.assert_http_error(429, self.send("Still cooling down", token=joined["token"]))

    async def test_rematch_clears_chat_and_cooldown(self):
        self.rooms.docs["CHAT1"] = room("gameOver")
        await self.send("Good game")
        view = await server.rematch_room("CHAT1", server.TokenReq(token="player-0"))
        self.assertEqual(view["chatMessages"], [])
        self.assertNotIn("last_chat_at", self.rooms.docs["CHAT1"]["players"][0])
        view = await self.send("New game")
        self.assertEqual(view["chatMessages"][0]["text"], "New game")


if __name__ == "__main__":
    unittest.main()
