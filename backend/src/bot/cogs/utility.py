import logging
from datetime import datetime, timedelta
from typing import Optional
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.utility")

class UtilityCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="daily", description="Claim your daily gold reward and build your streak multiplier.")
    async def claim_daily(self, interaction: discord.Interaction) -> None:
        db = get_db()
        discord_id = str(interaction.user.id)
        now = datetime.now()

        await interaction.response.defer()

        try:
            # 1. Ensure user has a profile in the main database
            user_profile = await db.user.find_unique(where={"discord_id": discord_id})
            if not user_profile:
                user_profile = await db.user.create(
                    data={
                        "discord_id": discord_id,
                        "username": interaction.user.name,
                        "experience_points": 0
                    }
                )

            # 2. Check last claim logs
            daily_record = await db.dailyreward.find_unique(where={"discord_id": discord_id})

            if not daily_record:
                # First time claim ever
                streak = 1
                gold_earned = 50.0

                await db.dailyreward.create(
                    data={
                        "discord_id": discord_id,
                        "last_claimed_at": now,
                        "current_streak": streak
                    }
                )

                await db.user.update(
                    where={"discord_id": discord_id},
                    data={"gold_balance": {"increment": gold_earned}}
                )

                new_balance = float(user_profile.gold_balance) + gold_earned
                message_title = "🎁 First Daily Reward Claimed!"
            else:
                elapsed_seconds = (now - daily_record.last_claimed_at).total_seconds()

                if elapsed_seconds < 86400:  # 24 hours cooldown
                    seconds_left = 86400 - elapsed_seconds
                    hours = int(seconds_left // 3600)
                    minutes = int((seconds_left % 3600) // 60)
                    await interaction.followup.send(
                        f"⏳ Cooldown Active: Please wait **{hours}h {minutes}m** before claiming your next daily reward.",
                        ephemeral=True
                    )
                    return
                elif elapsed_seconds <= 172800:  # Within 48 hours - streak is kept
                    streak = min(daily_record.current_streak + 1, 7)
                    gold_earned = 50.0 * streak

                    await db.dailyreward.update(
                        where={"discord_id": discord_id},
                        data={
                            "last_claimed_at": now,
                            "current_streak": streak
                        }
                    )

                    await db.user.update(
                        where={"discord_id": discord_id},
                        data={"gold_balance": {"increment": gold_earned}}
                    )

                    new_balance = float(user_profile.gold_balance) + gold_earned
                    message_title = f"🔥 Daily Reward Claimed (Day {streak} Streak!)"
                else:  # Over 48 hours - streak is reset
                    streak = 1
                    gold_earned = 50.0

                    await db.dailyreward.update(
                        where={"discord_id": discord_id},
                        data={
                            "last_claimed_at": now,
                            "current_streak": streak
                        }
                    )

                    await db.user.update(
                        where={"discord_id": discord_id},
                        data={"gold_balance": {"increment": gold_earned}}
                    )

                    new_balance = float(user_profile.gold_balance) + gold_earned
                    message_title = "⚠️ Streak Broken! Daily Reward Claimed"

            # 3. Build a beautiful presentation embed
            embed = discord.Embed(
                title=message_title,
                color=discord.Color.gold() if streak >= 7 else discord.Color.green(),
                timestamp=now
            )
            embed.add_field(name="Gold Earned", value=f"🪙 **{gold_earned:.2f} Gold**", inline=True)
            embed.add_field(name="Current Streak", value=f"🔥 **{streak}/7 Days**", inline=True)
            embed.add_field(name="New Wallet Balance", value=f"💰 **{new_balance:.2f} Gold**", inline=False)
            
            # Show progress visual bar
            progress_bar = "🔥" * streak + "⚫" * (7 - streak)
            embed.add_field(name="Streak Progress", value=progress_bar, inline=False)

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.exception("Failed to claim daily reward.")
            await interaction.followup.send("❌ Failed to process reward claim. Please try again.", ephemeral=True)

    @app_commands.command(name="rep", description="Award a reputation point to another adventurer once per day.")
    @app_commands.describe(user="The member to award reputation to.")
    async def give_reputation(self, interaction: discord.Interaction, user: discord.Member) -> None:
        if user.id == interaction.user.id:
            await interaction.response.send_message("❌ You cannot award reputation to yourself.", ephemeral=True)
            return

        if user.bot:
            await interaction.response.send_message("❌ You cannot award reputation to bots.", ephemeral=True)
            return

        db = get_db()
        now = datetime.now()
        discord_id = str(interaction.user.id)

        await interaction.response.defer()

        try:
            # 1. Check if executor has already given a rep in the last 24 hours
            one_day_ago = now - timedelta(days=1)
            recent_log = await db.reputationlog.find_first(
                where={
                    "sender_id": discord_id,
                    "given_at": {"gt": one_day_ago}
                }
            )

            if recent_log:
                elapsed_seconds = (now - recent_log.given_at).total_seconds()
                seconds_left = 86400 - elapsed_seconds
                hours = int(seconds_left // 3600)
                minutes = int((seconds_left % 3600) // 60)
                await interaction.followup.send(
                    f"⏳ You have already awarded reputation today. Cooldown: **{hours}h {minutes}m**.",
                    ephemeral=True
                )
                return

            # 2. Ensure target user profile exists
            target_profile = await db.user.find_unique(where={"discord_id": str(user.id)})
            if not target_profile:
                await db.user.create(
                    data={
                        "discord_id": str(user.id),
                        "username": user.name,
                        "experience_points": 0
                    }
                )

            # 3. Create Reputation Log record
            await db.reputationlog.create(
                data={
                    "sender_id": discord_id,
                    "receiver_id": str(user.id)
                }
            )

            # 4. Count total reputation points for target user
            rep_count = await db.reputationlog.count(where={"receiver_id": str(user.id)})

            # 5. Send announcement embed
            embed = discord.Embed(
                title="🌟 Reputation Awarded!",
                description=f"<@{interaction.user.id}> has awarded a reputation point to <@{user.id}>!",
                color=discord.Color.purple(),
                timestamp=now
            )
            embed.add_field(name="Target adventurer", value=user.name, inline=True)
            embed.add_field(name="Total reputation", value=f"⭐ **{rep_count}** points", inline=True)

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.exception("Failed to issue reputation point.")
            await interaction.followup.send("❌ Database connection failed during reputation update.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(UtilityCog(bot))
