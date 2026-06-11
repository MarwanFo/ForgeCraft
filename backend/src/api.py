import logging
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import database getter
from src.database import get_db

logger = logging.getLogger("forgecraft.api")

app = FastAPI(
    title="ForgeCraft AI API Bridge",
    description="Exposes live game state and database coordinates to the React Dashboard.",
    version="1.0.0"
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Serialization Schemas -----------------

class UserResponse(BaseModel):
    discord_id: str
    username: str
    experience_points: int
    player_class: str
    gold_balance: float
    created_at: datetime
    last_active_at: datetime

    class Config:
        from_attributes = True

class MarketCommodityResponse(BaseModel):
    commodity_id: int
    item_id: int
    current_price: float
    supply_pool: int
    demand_multiplier: float
    updated_at: datetime
    name: str
    rarity: str
    description: Optional[str] = None

class LoreLedgerResponse(BaseModel):
    event_id: str
    event_type: str
    raw_trigger_summary: str
    generated_lore: str
    recorded_at: datetime

    class Config:
        from_attributes = True

class UserInventoryResponse(BaseModel):
    item_id: int
    name: str
    rarity: str
    description: Optional[str] = None
    base_value: float
    quantity: int

class UserProfileResponse(BaseModel):
    user: UserResponse
    inventory: List[UserInventoryResponse]

# ----------------- Endpoint Routers -----------------

@app.get("/")
@app.get("/api")
@app.get("/api/")
async def root():
    return {"status": "online", "service": "ForgeCraft API Bridge"}

@app.get("/api/leaderboard", response_model=List[UserResponse])
async def get_leaderboard():
    """Returns top 10 users ranked by experience points."""
    db = get_db()
    try:
        users = await db.user.find_many(
            order={"experience_points": "desc"},
            take=10
        )
        # Convert Decimal values to float for schema compatibility
        serialized = []
        for u in users:
            serialized.append(
                UserResponse(
                    discord_id=u.discord_id,
                    username=u.username,
                    experience_points=int(u.experience_points),
                    player_class=u.player_class,
                    gold_balance=float(u.gold_balance),
                    created_at=u.created_at,
                    last_active_at=u.last_active_at
                )
            )
        return serialized
    except Exception as e:
        logger.error(f"Failed to fetch leaderboard API: {e}")
        raise HTTPException(status_code=500, detail="Database leaderboard query failure.")

@app.get("/api/market", response_model=List[MarketCommodityResponse])
async def get_market():
    """Returns dynamic prices and supply pools for all commodities."""
    db = get_db()
    try:
        commodities = await db.marketcommodity.find_many(
            include={"item": True},
            order={"item": {"name": "asc"}}
        )
        
        serialized = []
        for c in commodities:
            serialized.append(
                MarketCommodityResponse(
                    commodity_id=c.commodity_id,
                    item_id=c.item_id,
                    current_price=float(c.current_price),
                    supply_pool=c.supply_pool,
                    demand_multiplier=float(c.demand_multiplier),
                    updated_at=c.updated_at,
                    name=c.item.name,
                    rarity=c.item.rarity,
                    description=c.item.description
                )
            )
        return serialized
    except Exception as e:
        logger.error(f"Failed to fetch market API: {e}")
        raise HTTPException(status_code=500, detail="Database market query failure.")

@app.get("/api/chronicles", response_model=List[LoreLedgerResponse])
async def get_chronicles():
    """Returns chronological AI lore ledger event records."""
    db = get_db()
    try:
        chronicles = await db.loreledger.find_many(
            order={"recorded_at": "desc"}
        )
        return chronicles
    except Exception as e:
        logger.error(f"Failed to fetch lore chronicles API: {e}")
        raise HTTPException(status_code=500, detail="Database lore chronicles query failure.")

@app.get("/api/users/{discord_id}", response_model=UserProfileResponse)
async def get_user_profile(discord_id: str):
    """Returns statistics and backpack contents of a specific player."""
    db = get_db()
    try:
        user = await db.user.find_unique(where={"discord_id": discord_id})
        if not user:
            raise HTTPException(status_code=404, detail=f"Player profile with Discord ID '{discord_id}' does not exist.")
            
        inventory_items = await db.userinventory.find_many(
            where={"discord_id": discord_id},
            include={"item": True}
        )
        
        user_response = UserResponse(
            discord_id=user.discord_id,
            username=user.username,
            experience_points=int(user.experience_points),
            player_class=user.player_class,
            gold_balance=float(user.gold_balance),
            created_at=user.created_at,
            last_active_at=user.last_active_at
        )
        
        inventory_response = []
        for ui in inventory_items:
            inventory_response.append(
                UserInventoryResponse(
                    item_id=ui.item_id,
                    name=ui.item.name,
                    rarity=ui.item.rarity,
                    description=ui.item.description,
                    base_value=float(ui.item.base_value),
                    quantity=ui.quantity
                )
            )
            
        return UserProfileResponse(
            user=user_response,
            inventory=inventory_response
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch user profile API: {e}")
        raise HTTPException(status_code=500, detail="Database user profile query failure.")
