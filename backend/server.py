from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

import witches_engine as eng


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- Game results (local + online history) ----------------


class PlayerScore(BaseModel):
    name: str
    score: int


class GameResultCreate(BaseModel):
    players: int
    rounds: int
    scores: List[PlayerScore]
    winners: List[str]


class GameResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    players: int
    rounds: int
    scores: List[PlayerScore]
    winners: List[str]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@api_router.get("/")
async def root():
    return {"message": "Coven of Witches API"}


@api_router.post("/games", response_model=GameResult)
async def save_game(payload: GameResultCreate):
    result = GameResult(**payload.model_dump())
    await db.game_results.insert_one(result.model_dump())
    return result


@api_router.get("/games/recent", response_model=List[GameResult])
async def recent_games(limit: int = 15):
    docs = await db.game_results.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api_router.get("/games/summary")
async def games_summary():
    total = await db.game_results.count_documents({})
    return {"total_games": total}


# ---------------- Online multiplayer rooms ----------------

BOT_AVATARS = [
    {"key": "necromancer", "label": "Necromancer", "icon": "skull", "color": "#94A3B8"},
    {"key": "druidess", "label": "Druidess", "icon": "sprout", "color": "#4ADE80"},
    {"key": "alchemist", "label": "Alchemist", "icon": "flask-conical", "color": "#38BDF8"},
    {"key": "enchanter", "label": "Enchanter", "icon": "wand-sparkles", "color": "#FBBF24"},
    {"key": "oracle", "label": "Oracle", "icon": "eye", "color": "#C084FC"},
    {"key": "sorceress", "label": "Sorceress", "icon": "sparkles", "color": "#F472B6"},
]
BOT_NAMES = ["Morgana", "Circe", "Baba Yaga", "Hazel", "Nimue", "Griselda", "Ursula", "Winifred"]

_locks: Dict[str, asyncio.Lock] = {}


def _lock(code: str) -> asyncio.Lock:
    if code not in _locks:
        _locks[code] = asyncio.Lock()
    return _locks[code]


class CreateRoom(BaseModel):
    name: str
    avatar: Dict[str, Any]


class JoinRoom(BaseModel):
    name: str
    avatar: Dict[str, Any]


class TokenReq(BaseModel):
    token: str


class BotsReq(BaseModel):
    token: str
    action: str  # 'add' | 'remove'


class ActionReq(BaseModel):
    token: str
    type: str  # 'pass' | 'play' | 'continueTrick' | 'nextRound'
    cards: Optional[List[str]] = None
    cardId: Optional[str] = None


def _gen_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(5))


async def _get_room(code: str):
    room = await db.rooms.find_one({"_id": code})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def _save_room(room):
    room["updated_at"] = datetime.now(timezone.utc).isoformat()
    room["expire_at"] = datetime.now(timezone.utc)
    room["version"] = room.get("version", 0) + 1
    await db.rooms.replace_one({"_id": room["_id"]}, room, upsert=True)


def _player_by_token(room, token):
    return next((p for p in room["players"] if p["token"] == token), None)


# ----- game flow helpers (operate on room dict in place) -----

def _setup_passing(room):
    n = room["n"]
    count, d = eng.pass_info(n, room["roundIndex"])
    room["passCount"] = count
    room["passDir"] = d
    room["pendingSelections"] = {}
    if count == 0 or d == 0:
        _start_tricks(room)
        return
    # pre-fill bot selections
    for seat, p in enumerate(room["players"]):
        if p["isBot"]:
            room["pendingSelections"][str(seat)] = eng.bot_pass(room["hands"][seat], count)
    room["phase"] = "passing"


def _apply_passes(room):
    n = room["n"]
    d = room["passDir"]
    hands = [list(h) for h in room["hands"]]
    incoming = [[] for _ in range(n)]
    for seat in range(n):
        sel = set(room["pendingSelections"].get(str(seat), []))
        give = [c for c in hands[seat] if c["id"] in sel]
        hands[seat] = [c for c in hands[seat] if c["id"] not in sel]
        incoming[eng.target_seat(seat, d, n)].extend(give)
    for seat in range(n):
        hands[seat].extend(incoming[seat])
        hands[seat].sort(key=eng._sort_key)
    room["hands"] = hands
    _start_tricks(room)


def _start_tricks(room):
    n = room["n"]
    leader = room["roundIndex"] % n
    room["leader"] = leader
    room["currentSeat"] = leader
    room["trick"] = []
    room["trickNumber"] = 1
    room["phase"] = "playing"


def _apply_play(room, card_id):
    n = room["n"]
    seat = room["currentSeat"]
    hand = room["hands"][seat]
    idx = next((i for i, c in enumerate(hand) if c["id"] == card_id), -1)
    if idx < 0:
        return
    card = hand.pop(idx)
    room["trick"].append({"seat": seat, "card": card})
    if len(room["trick"]) < n:
        room["currentSeat"] = (seat + 1) % n
        return
    winner = eng.resolve_trick(room["trick"])
    room["piles"][winner].extend([t["card"] for t in room["trick"]])
    room["lastTrick"] = list(room["trick"])
    room["lastWinner"] = winner
    room["phase"] = "trickEnd"


def _do_continue_trick(room):
    if all(len(h) == 0 for h in room["hands"]):
        res = eng.score_round(room["piles"])
        room["roundResult"] = res
        room["scores"] = [s + res["results"][i]["total"] for i, s in enumerate(room["scores"])]
        room["totalRounds"] = room.get("totalRounds", 0) + 1
        room["phase"] = "roundScores"
        return
    winner = room["lastWinner"]
    room["leader"] = winner
    room["currentSeat"] = winner
    room["trick"] = []
    room["trickNumber"] = room["trickNumber"] + 1
    room["phase"] = "playing"


def _do_next_round(room):
    if eng.is_game_over(room["scores"]):
        room["phase"] = "gameOver"
        room["status"] = "gameOver"
        return
    room["roundIndex"] += 1
    n = room["n"]
    hands = eng.deal(eng.shuffle(eng.make_deck()), n)
    room["hands"] = hands
    room["piles"] = [[] for _ in range(n)]
    room["trick"] = []
    room["lastTrick"] = None
    room["lastWinner"] = None
    room["roundResult"] = None
    _setup_passing(room)


def _advance_bots(room):
    """Auto-play bot seats until a human is required or a terminal phase."""
    for _ in range(500):
        phase = room["phase"]
        if phase == "passing":
            n = room["n"]
            if all(str(seat) in room["pendingSelections"] for seat in range(n)):
                _apply_passes(room)
                continue
            break
        elif phase == "playing":
            cur = room["currentSeat"]
            if room["players"][cur]["isBot"]:
                cid = eng.bot_play(room["hands"][cur], room["trick"])
                _apply_play(room, cid)
                continue
            break
        elif phase == "trickEnd":
            if room["players"][room["lastWinner"]]["isBot"]:
                _do_continue_trick(room)
                continue
            break
        else:
            break


def _redact(room, token):
    n = room.get("n", len(room["players"]))
    me = _player_by_token(room, token)
    your_seat = me["seat"] if me else None
    players_pub = sorted(
        [{"name": p["name"], "avatar": p["avatar"], "isBot": p["isBot"], "seat": p["seat"]} for p in room["players"]],
        key=lambda x: x["seat"],
    )
    view = {
        "code": room["_id"],
        "status": room["status"],
        "phase": room.get("phase", "lobby"),
        "n": n,
        "players": players_pub,
        "yourSeat": your_seat,
        "isHost": bool(me and room["host_token"] == token),
        "threshold": eng.WIN_THRESHOLD,
        "version": room.get("version", 0),
    }
    if room["status"] == "lobby":
        return view
    view.update({
        "roundIndex": room.get("roundIndex", 0),
        "totalRounds": room.get("totalRounds", 0),
        "trickNumber": room.get("trickNumber", 1),
        "scores": room.get("scores", [0] * n),
        "handCounts": [len(h) for h in room["hands"]],
        "trick": room.get("trick", []),
        "currentSeat": room.get("currentSeat", 0),
        "leader": room.get("leader", 0),
        "lastWinner": room.get("lastWinner"),
        "lastTrick": room.get("lastTrick"),
        "passCount": room.get("passCount", 0),
        "passDir": room.get("passDir", 0),
        "roundResult": room.get("roundResult"),
        "yourHand": room["hands"][your_seat] if your_seat is not None else [],
    })
    if view["phase"] == "passing":
        view["passedSeats"] = [str(seat) in room["pendingSelections"] for seat in range(n)]
        view["iPassed"] = your_seat is not None and str(your_seat) in room["pendingSelections"]
        view["passTarget"] = eng.target_seat(your_seat, room["passDir"], n) if your_seat is not None else None
    return view


async def _maybe_record(room):
    if room["status"] == "gameOver" and not room.get("recorded"):
        room["recorded"] = True
        winners = [room["players"][i]["name"] for i in eng.lowest_seats(room["scores"])]
        await db.game_results.insert_one(GameResult(
            players=room["n"],
            rounds=room.get("totalRounds", 0),
            scores=[{"name": p["name"], "score": room["scores"][p["seat"]]} for p in sorted(room["players"], key=lambda x: x["seat"])],
            winners=winners,
        ).model_dump())


@api_router.post("/rooms")
async def create_room(payload: CreateRoom):
    for _ in range(10):
        code = _gen_code()
        if not await db.rooms.find_one({"_id": code}):
            break
    token = str(uuid.uuid4())
    room = {
        "_id": code,
        "host_token": token,
        "status": "lobby",
        "phase": "lobby",
        "players": [{"token": token, "name": payload.name[:16] or "Host", "avatar": payload.avatar, "isBot": False, "seat": 0}],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "version": 0,
    }
    await db.rooms.replace_one({"_id": code}, room, upsert=True)
    return {"code": code, "token": token, "seat": 0}


@api_router.post("/rooms/{code}/join")
async def join_room(code: str, payload: JoinRoom):
    async with _lock(code):
        room = await _get_room(code)
        if room["status"] != "lobby":
            raise HTTPException(status_code=409, detail="Game already started")
        if len(room["players"]) >= 6:
            raise HTTPException(status_code=409, detail="Room is full")
        token = str(uuid.uuid4())
        seat = len(room["players"])
        room["players"].append({"token": token, "name": payload.name[:16] or f"Witch {seat + 1}", "avatar": payload.avatar, "isBot": False, "seat": seat})
        await _save_room(room)
        return {"code": code, "token": token, "seat": seat}


@api_router.post("/rooms/{code}/bots")
async def manage_bots(code: str, payload: BotsReq):
    async with _lock(code):
        room = await _get_room(code)
        if room["host_token"] != payload.token:
            raise HTTPException(status_code=403, detail="Only the host can manage bots")
        if room["status"] != "lobby":
            raise HTTPException(status_code=409, detail="Game already started")
        if payload.action not in ("add", "remove"):
            raise HTTPException(status_code=400, detail="Unknown bot action")
        if payload.action == "add":
            if len(room["players"]) >= 6:
                raise HTTPException(status_code=409, detail="Room is full")
            used = {p["avatar"].get("key") for p in room["players"]}
            avatar = next((a for a in BOT_AVATARS if a["key"] not in used), BOT_AVATARS[0])
            seat = len(room["players"])
            name = BOT_NAMES[seat % len(BOT_NAMES)]
            room["players"].append({"token": f"bot-{uuid.uuid4()}", "name": name, "avatar": avatar, "isBot": True, "seat": seat})
        elif payload.action == "remove":
            for i in range(len(room["players"]) - 1, 0, -1):
                if room["players"][i]["isBot"]:
                    room["players"].pop(i)
                    break
        await _save_room(room)
        return _redact(room, payload.token)


@api_router.post("/rooms/{code}/start")
async def start_room(code: str, payload: TokenReq):
    async with _lock(code):
        room = await _get_room(code)
        if room["host_token"] != payload.token:
            raise HTTPException(status_code=403, detail="Only the host can start")
        if room["status"] != "lobby":
            raise HTTPException(status_code=409, detail="Already started")
        n = len(room["players"])
        if n < 3 or n > 6:
            raise HTTPException(status_code=400, detail="Need 3 to 6 players (add bots to fill)")
        for i, p in enumerate(room["players"]):
            p["seat"] = i
        room["n"] = n
        room["status"] = "playing"
        room["roundIndex"] = 0
        room["totalRounds"] = 0
        room["scores"] = [0] * n
        room["hands"] = eng.deal(eng.shuffle(eng.make_deck()), n)
        room["piles"] = [[] for _ in range(n)]
        room["trick"] = []
        room["lastTrick"] = None
        room["lastWinner"] = None
        room["roundResult"] = None
        _setup_passing(room)
        _advance_bots(room)
        await _save_room(room)
        return _redact(room, payload.token)


@api_router.get("/rooms/{code}")
async def get_room(code: str, token: str = ""):
    room = await _get_room(code)
    return _redact(room, token)


@api_router.post("/rooms/{code}/action")
async def room_action(code: str, payload: ActionReq):
    async with _lock(code):
        room = await _get_room(code)
        if room["status"] not in ("playing",):
            raise HTTPException(status_code=409, detail="Game not in progress")
        me = _player_by_token(room, payload.token)
        if not me:
            raise HTTPException(status_code=403, detail="Not a player in this room")
        seat = me["seat"]
        phase = room["phase"]
        t = payload.type

        if t == "pass":
            if phase != "passing":
                raise HTTPException(status_code=409, detail="Not the passing phase")
            if str(seat) in room["pendingSelections"]:
                raise HTTPException(status_code=409, detail="Already passed")
            hand_ids = {c["id"] for c in room["hands"][seat]}
            cards = payload.cards or []
            if len(cards) != room["passCount"] or not set(cards).issubset(hand_ids):
                raise HTTPException(status_code=400, detail="Invalid card selection")
            room["pendingSelections"][str(seat)] = cards
        elif t == "play":
            if phase != "playing":
                raise HTTPException(status_code=409, detail="Not the playing phase")
            if room["currentSeat"] != seat:
                raise HTTPException(status_code=409, detail="Not your turn")
            legal = set(eng.legal_card_ids(room["hands"][seat], room["trick"]))
            if payload.cardId not in legal:
                raise HTTPException(status_code=400, detail="Illegal card")
            _apply_play(room, payload.cardId)
        elif t == "continueTrick":
            if phase != "trickEnd":
                raise HTTPException(status_code=409, detail="No trick to gather")
            if seat != room["lastWinner"] and room["host_token"] != payload.token:
                raise HTTPException(status_code=403, detail="Only the trick winner can continue")
            _do_continue_trick(room)
        elif t == "nextRound":
            if phase != "roundScores":
                raise HTTPException(status_code=409, detail="Not the scoring phase")
            _do_next_round(room)
        else:
            raise HTTPException(status_code=400, detail="Unknown action")

        _advance_bots(room)
        await _maybe_record(room)
        await _save_room(room)
        return _redact(room, payload.token)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _ensure_indexes():
    # idle rooms auto-expire after 12h (activity refreshes expire_at)
    try:
        await db.rooms.create_index("expire_at", expireAfterSeconds=43200)
    except Exception as e:  # pragma: no cover
        logger.warning("Could not create rooms TTL index: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
