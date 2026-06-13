import os
import logging
import httpx
import jwt
import math
from typing import List, Optional
from datetime import datetime, timezone
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

class TicketResponse(BaseModel):
    ticket_id: str
    discord_id: str
    channel_id: str
    status: str
    created_at: datetime
    closed_at: Optional[datetime] = None
    username: Optional[str] = None

class UserWarningResponse(BaseModel):
    warning_id: str
    discord_id: str
    moderator_id: str
    reason: str
    issued_at: datetime
    username: Optional[str] = None

class ModerationLogsResponse(BaseModel):
    warnings: List[UserWarningResponse]
    tickets: List[TicketResponse]

class UserAdjustRequest(BaseModel):
    experience_points: Optional[int] = None
    gold_balance: Optional[float] = None
    player_class: Optional[str] = None
    custom_title: Optional[str] = None

DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "1116516121063993384")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "mock_secret")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "http://localhost:5173/")
JWT_SECRET = os.getenv("JWT_SECRET", "forgecraft_super_secret_jwt_key")

class AuthCallbackRequest(BaseModel):
    code: str

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

@app.get("/api/tickets", response_model=List[TicketResponse])
async def get_tickets():
    """Returns a list of all active open tickets."""
    db = get_db()
    try:
        tickets = await db.ticket.find_many(
            where={"status": "OPEN"},
            include={"user": True},
            order={"created_at": "desc"}
        )
        serialized = []
        for t in tickets:
            serialized.append(
                TicketResponse(
                    ticket_id=str(t.ticket_id),
                    discord_id=t.discord_id,
                    channel_id=t.channel_id,
                    status=t.status,
                    created_at=t.created_at,
                    closed_at=t.closed_at,
                    username=t.user.username if t.user else "Unknown"
                )
            )
        return serialized
    except Exception as e:
        logger.error(f"Failed to fetch open tickets API: {e}")
        raise HTTPException(status_code=500, detail="Database tickets query failure.")

@app.get("/api/warnings/{discord_id}", response_model=List[UserWarningResponse])
async def get_warnings(discord_id: str):
    """Returns active warnings for a user."""
    db = get_db()
    try:
        warnings = await db.userwarning.find_many(
            where={"discord_id": discord_id},
            include={"user": True},
            order={"issued_at": "desc"}
        )
        serialized = []
        for w in warnings:
            serialized.append(
                UserWarningResponse(
                    warning_id=str(w.warning_id),
                    discord_id=w.discord_id,
                    moderator_id=w.moderator_id,
                    reason=w.reason,
                    issued_at=w.issued_at,
                    username=w.user.username if w.user else "Unknown"
                )
            )
        return serialized
    except Exception as e:
        logger.error(f"Failed to fetch user warnings API: {e}")
        raise HTTPException(status_code=500, detail="Database warnings query failure.")

@app.get("/api/moderation/logs", response_model=ModerationLogsResponse)
async def get_moderation_logs():
    """Returns a history list of warnings and ticket closures."""
    db = get_db()
    try:
        warnings = await db.userwarning.find_many(
            include={"user": True},
            order={"issued_at": "desc"}
        )
        tickets = await db.ticket.find_many(
            include={"user": True},
            order={"created_at": "desc"}
        )
        
        serialized_warnings = []
        for w in warnings:
            serialized_warnings.append(
                UserWarningResponse(
                    warning_id=str(w.warning_id),
                    discord_id=w.discord_id,
                    moderator_id=w.moderator_id,
                    reason=w.reason,
                    issued_at=w.issued_at,
                    username=w.user.username if w.user else "Unknown"
                )
            )
            
        serialized_tickets = []
        for t in tickets:
            serialized_tickets.append(
                TicketResponse(
                    ticket_id=str(t.ticket_id),
                    discord_id=t.discord_id,
                    channel_id=t.channel_id,
                    status=t.status,
                    created_at=t.created_at,
                    closed_at=t.closed_at,
                    username=t.user.username if t.user else "Unknown"
                )
            )
            
        return ModerationLogsResponse(
            warnings=serialized_warnings,
            tickets=serialized_tickets
        )
    except Exception as e:
        logger.error(f"Failed to fetch moderation logs API: {e}")
        raise HTTPException(status_code=500, detail="Database moderation logs query failure.")

@app.delete("/api/warnings/{warning_id}")
async def delete_warning(warning_id: str):
    """Delete a warning entry by ID."""
    db = get_db()
    try:
        warning = await db.userwarning.find_unique(where={"warning_id": warning_id})
        if not warning:
            raise HTTPException(status_code=404, detail="Warning not found.")
        await db.userwarning.delete(where={"warning_id": warning_id})
        return {"status": "success", "message": f"Warning {warning_id} deleted."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete warning: {e}")
        raise HTTPException(status_code=500, detail="Database warning deletion failure.")

@app.post("/api/users/{discord_id}/adjust")
async def adjust_user_profile(discord_id: str, payload: UserAdjustRequest):
    """Adjust XP, gold, class, and custom title attributes for a player profile."""
    db = get_db()
    try:
        user = await db.user.find_unique(where={"discord_id": discord_id})
        if not user:
            raise HTTPException(status_code=404, detail="Player profile not found.")
        
        update_data = {}
        if payload.experience_points is not None:
            update_data["experience_points"] = payload.experience_points
        if payload.gold_balance is not None:
            update_data["gold_balance"] = payload.gold_balance
        if payload.player_class is not None:
            update_data["player_class"] = payload.player_class
        if payload.custom_title is not None:
            update_data["custom_title"] = payload.custom_title
            
        if not update_data:
            return {"status": "ignored", "message": "No fields updated."}
            
        await db.user.update(
            where={"discord_id": discord_id},
            data=update_data
        )
        return {"status": "success", "message": "User attributes successfully updated."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to adjust user profile: {e}")
        raise HTTPException(status_code=500, detail="Database player update failure.")

@app.post("/api/auth/callback")
async def auth_callback(payload: AuthCallbackRequest):
    """Callback receiver that exchanges authorization code for user credentials and generates JWT."""
    code = payload.code
    async with httpx.AsyncClient() as client:
        try:
            token_url = "https://discord.com/api/oauth2/token"
            data = {
                "client_id": DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": DISCORD_REDIRECT_URI
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            
            # Dev/Sandbox bypass to ease testing when credentials are unset
            if DISCORD_CLIENT_SECRET == "mock_secret":
                logger.info("Sandbox developer authentication bypass triggered.")
                mock_discord_id = "1116516121063993384"
                mock_username = "Guest Adventurer"
                mock_avatar = "default_avatar"
                
                db = get_db()
                user = await db.user.find_unique(where={"discord_id": mock_discord_id})
                if not user:
                    await db.user.create(
                        data={
                            "discord_id": mock_discord_id,
                            "username": mock_username,
                        }
                    )
                
                jwt_token = jwt.encode(
                    {
                        "discord_id": mock_discord_id,
                        "username": mock_username,
                        "avatar": mock_avatar
                    },
                    JWT_SECRET,
                    algorithm="HS256"
                )
                return {
                    "token": jwt_token,
                    "user": {
                        "discord_id": mock_discord_id,
                        "username": mock_username,
                        "avatar": mock_avatar
                    }
                }

            token_res = await client.post(token_url, data=data, headers=headers)
            if token_res.status_code != 200:
                logger.error(f"Discord oauth code exchange failed: {token_res.text}")
                raise HTTPException(status_code=400, detail="Discord authorization exchange failed.")
            
            tokens = token_res.json()
            access_token = tokens.get("access_token")
            
            user_url = "https://discord.com/api/users/@me"
            user_res = await client.get(user_url, headers={"Authorization": f"Bearer {access_token}"})
            if user_res.status_code != 200:
                logger.error(f"Failed to fetch user profile info: {user_res.text}")
                raise HTTPException(status_code=400, detail="Failed to retrieve profile credentials.")
                
            profile = user_res.json()
            discord_id = profile["id"]
            username = profile["username"]
            avatar = profile.get("avatar") or "default_avatar"
            
            db = get_db()
            user = await db.user.find_unique(where={"discord_id": discord_id})
            if not user:
                await db.user.create(
                    data={
                        "discord_id": discord_id,
                        "username": username,
                    }
                )
            else:
                if user.username != username:
                    await db.user.update(
                        where={"discord_id": discord_id},
                        data={"username": username}
                    )
            
            jwt_token = jwt.encode(
                {
                    "discord_id": discord_id,
                    "username": username,
                    "avatar": avatar
                },
                JWT_SECRET,
                algorithm="HS256"
            )
            
            return {
                "token": jwt_token,
                "user": {
                    "discord_id": discord_id,
                    "username": username,
                    "avatar": avatar
                }
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to process auth callback: {e}")
            raise HTTPException(status_code=500, detail="Authentication callback failure.")

@app.get("/api/users/{discord_id}/dashboard-stats")
async def get_dashboard_stats(discord_id: str):
    """Retrieves computed gamification metrics, level thresholds, and global rank card info."""
    db = get_db()
    try:
        user = await db.user.find_unique(where={"discord_id": discord_id})
        if not user:
            raise HTTPException(status_code=404, detail="Adventurer profile not found.")
            
        xp = int(user.experience_points)
        level = int(math.floor(math.sqrt(xp / 100)) + 1) if xp > 0 else 1
        next_level_xp = ((level) ** 2) * 100
        prev_level_xp = ((level - 1) ** 2) * 100
        
        # Determine global rank sorted by experience points
        rank = await db.user.count(
            where={
                "experience_points": {
                    "gt": user.experience_points
                }
            }
        ) + 1
        
        # Determine reputation points
        reputation = await db.reputationlog.count(
            where={
                "receiver_id": discord_id
            }
        )
        
        return {
            "discord_id": user.discord_id,
            "username": user.username,
            "gold_balance": float(user.gold_balance),
            "experience_points": xp,
            "level": level,
            "next_level_xp": next_level_xp,
            "prev_level_xp": prev_level_xp,
            "rank": rank,
            "reputation": reputation,
            "player_class": user.player_class,
            "custom_title": user.custom_title or "Novice Adventurer"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to query dashboard statistics: {e}")
        raise HTTPException(status_code=500, detail="Database error retrieving user statistics.")

@app.get("/api/users/{discord_id}/transactions")
async def get_user_transactions(discord_id: str):
    """Retrieves credit ledger ledger tracking history."""
    db = get_db()
    try:
        txs = await db.credittransaction.find_many(
            where={"discord_id": discord_id},
            order={"created_at": "desc"}
        )
        return [
            {
                "transaction_id": str(tx.transaction_id),
                "amount": float(tx.amount),
                "description": tx.description,
                "created_at": tx.created_at
            }
            for tx in txs
        ]
    except Exception as e:
        logger.error(f"Failed to fetch credit ledger logs: {e}")
        raise HTTPException(status_code=500, detail="Database error retrieving transaction history.")

@app.post("/api/users/{discord_id}/daily-claim")
async def claim_daily_reward(discord_id: str):
    """Processes daily reward checks, streaking updates, and wallet balance modifications."""
    db = get_db()
    try:
        user = await db.user.find_unique(where={"discord_id": discord_id})
        if not user:
            raise HTTPException(status_code=404, detail="Adventurer profile not found.")
            
        now = datetime.now(timezone.utc)
        daily = await db.dailyreward.find_unique(where={"discord_id": discord_id})
        
        streak = 1
        if daily:
            # Check cooldown duration
            delta = now - daily.last_claimed_at
            hours_passed = delta.total_seconds() / 3600.0
            
            if hours_passed < 24.0:
                cooldown_remaining = int(86400 - delta.total_seconds())
                return {
                    "claimed": False,
                    "message": "Reward cooldown active.",
                    "cooldown_seconds": max(cooldown_remaining, 0)
                }
            elif hours_passed < 48.0:
                streak = daily.current_streak + 1
            else:
                streak = 1
                
        # Calculate streak multipliers
        bonus = 10.00 * min(streak, 5)
        reward_amount = 50.00 + bonus
        
        async with db.tx() as transaction:
            # Add gold reward
            await transaction.user.update(
                where={"discord_id": discord_id},
                data={"gold_balance": {"increment": Decimal(str(reward_amount))}}
            )
            
            # Upsert cooldown marker
            await transaction.dailyreward.upsert(
                where={"discord_id": discord_id},
                data={
                    "create": {
                        "discord_id": discord_id,
                        "last_claimed_at": now,
                        "current_streak": streak
                    },
                    "update": {
                        "last_claimed_at": now,
                        "current_streak": streak
                    }
                }
            )
            
            # Log credit transaction record
            await transaction.credittransaction.create(
                data={
                    "discord_id": discord_id,
                    "amount": Decimal(str(reward_amount)),
                    "description": f"Claimed daily reward. Streak: {streak} days."
                }
            )
            
        return {
            "claimed": True,
            "amount_claimed": reward_amount,
            "new_streak": streak,
            "message": f"Successfully claimed {reward_amount:.2f} Gold!"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to issue daily claim reward: {e}")
        raise HTTPException(status_code=500, detail="Database transaction failed during daily reward processing.")



