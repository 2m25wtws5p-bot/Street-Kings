from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


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
    doc = result.model_dump()
    await db.game_results.insert_one(doc)
    return result


@api_router.get("/games/recent", response_model=List[GameResult])
async def recent_games(limit: int = 15):
    docs = await db.game_results.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api_router.get("/games/summary")
async def games_summary():
    total = await db.game_results.count_documents({})
    return {"total_games": total}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
