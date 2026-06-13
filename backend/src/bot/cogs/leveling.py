import logging
import math
from typing import Optional
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.leveling")

class LevelingCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # Declare points subcommand group
    points_group = app_commands.Group(
        name="points",
        description="Manage player gold and experience points."
    )

    @app_commands.command(name="setxp", description="Directly set a user's experience points.")
    @app_commands.describe(user="The member to adjust.", amount="The target XP amount.")
    @app_commands.default_permissions(administrator=True)
    async def set_xp(self, interaction: discord.Interaction, user: discord.Member, amount: int) -> None:
        if amount < 0:
            await interaction.response.send_message("❌ XP amount cannot be negative.", ephemeral=True)
            return

        db = get_db()
        await interaction.response.defer()

        try:
            await db.user.upsert(
                where={"discord_id": str(user.id)},
                data={
                    "create": {
                        "discord_id": str(user.id),
                        "username": user.name,
                        "experience_points": amount
                    },
                    "update": {
                        "experience_points": amount
                    }
                }
            )
            await interaction.followup.send(f"✨ Successfully set **{user.name}**'s experience points to **{amount} XP**.")
        except Exception as e:
            logger.exception("Failed to set user XP.")
            await interaction.followup.send("❌ Database connection error updating XP.", ephemeral=True)

    @app_commands.command(name="setlevel", description="Directly set a user's level.")
    @app_commands.describe(user="The member to adjust.", level="The target level (minimum 1).")
    @app_commands.default_permissions(administrator=True)
    async def set_level(self, interaction: discord.Interaction, user: discord.Member, level: int) -> None:
        if level < 1:
            await interaction.response.send_message("❌ Level must be 1 or higher.", ephemeral=True)
            return

        # Calculate minimum XP required for the target level
        # level = math.floor(math.sqrt(xp / 100)) + 1 -> (level - 1)^2 * 100 = xp
        target_xp = ((level - 1) ** 2) * 100
        db = get_db()
        await interaction.response.defer()

        try:
            await db.user.upsert(
                where={"discord_id": str(user.id)},
                data={
                    "create": {
                        "discord_id": str(user.id),
                        "username": user.name,
                        "experience_points": target_xp
                    },
                    "update": {
                        "experience_points": target_xp
                    }
                }
            )
            await interaction.followup.send(f"📈 Successfully set **{user.name}** to **Level {level}** (calculated minimum **{target_xp} XP**).")
        except Exception as e:
            logger.exception("Failed to set user level.")
            await interaction.followup.send("❌ Database connection error updating level.", ephemeral=True)

    @points_group.command(name="increase", description="Increase a user's gold or experience points.")
    @app_commands.describe(user="The member to give points to.", amount="Number of points.", points_type="The type of points (Gold or XP).")
    @app_commands.choices(points_type=[
        app_commands.Choice(name="Gold", value="gold"),
        app_commands.Choice(name="XP", value="xp")
    ])
    async def increase_points(self, interaction: discord.Interaction, user: discord.Member, amount: float, points_type: app_commands.Choice[str]) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Only server administrators can use this command.", ephemeral=True)
            return

        if amount <= 0:
            await interaction.response.send_message("❌ Amount must be positive.", ephemeral=True)
            return

        db = get_db()
        await interaction.response.defer()

        try:
            if points_type.value == "gold":
                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "gold_balance": amount
                        },
                        "update": {
                            "gold_balance": {"increment": amount}
                        }
                    }
                )
                await interaction.followup.send(f"🪙 Added **{amount:.2f} Gold** to **{user.name}**'s wallet.")
            else:
                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "experience_points": int(amount)
                        },
                        "update": {
                            "experience_points": {"increment": int(amount)}
                        }
                    }
                )
                await interaction.followup.send(f"✨ Added **{int(amount)} XP** to **{user.name}**'s progression profile.")
        except Exception as e:
            logger.exception("Failed to increase points.")
            await interaction.followup.send("❌ Database update failed.", ephemeral=True)

    @points_group.command(name="decrease", description="Decrease a user's gold or experience points.")
    @app_commands.describe(user="The member to deduct points from.", amount="Number of points.", points_type="The type of points (Gold or XP).")
    @app_commands.choices(points_type=[
        app_commands.Choice(name="Gold", value="gold"),
        app_commands.Choice(name="XP", value="xp")
    ])
    async def decrease_points(self, interaction: discord.Interaction, user: discord.Member, amount: float, points_type: app_commands.Choice[str]) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Only server administrators can use this command.", ephemeral=True)
            return

        if amount <= 0:
            await interaction.response.send_message("❌ Amount must be positive.", ephemeral=True)
            return

        db = get_db()
        await interaction.response.defer()

        try:
            profile = await db.user.find_unique(where={"discord_id": str(user.id)})
            if not profile:
                await interaction.followup.send(f"❌ **{user.name}** has no active profile to deduct from.")
                return

            if points_type.value == "gold":
                new_balance = max(float(profile.gold_balance) - amount, 0.0)
                await db.user.update(
                    where={"discord_id": str(user.id)},
                    data={"gold_balance": new_balance}
                )
                await interaction.followup.send(f"🪙 Deducted **{amount:.2f} Gold** from **{user.name}**. New balance: **{new_balance:.2f} Gold**.")
            else:
                new_xp = max(int(profile.experience_points) - int(amount), 0)
                await db.user.update(
                    where={"discord_id": str(user.id)},
                    data={"experience_points": new_xp}
                )
                await interaction.followup.send(f"✨ Deducted **{int(amount)} XP** from **{user.name}**. New balance: **{new_xp} XP**.")
        except Exception as e:
            logger.exception("Failed to decrease points.")
            await interaction.followup.send("❌ Database update failed.", ephemeral=True)

    @points_group.command(name="set", description="Set a user's gold or experience points balance.")
    @app_commands.describe(user="The member to modify.", amount="Number of points.", points_type="The type of points (Gold or XP).")
    @app_commands.choices(points_type=[
        app_commands.Choice(name="Gold", value="gold"),
        app_commands.Choice(name="XP", value="xp")
    ])
    async def set_points(self, interaction: discord.Interaction, user: discord.Member, amount: float, points_type: app_commands.Choice[str]) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Only server administrators can use this command.", ephemeral=True)
            return

        if amount < 0:
            await interaction.response.send_message("❌ Balance amount cannot be negative.", ephemeral=True)
            return

        db = get_db()
        await interaction.response.defer()

        try:
            if points_type.value == "gold":
                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "gold_balance": amount
                        },
                        "update": {
                            "gold_balance": amount
                        }
                    }
                )
                await interaction.followup.send(f"🪙 Configured **{user.name}**'s gold balance to **{amount:.2f} Gold**.")
            else:
                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "experience_points": int(amount)
                        },
                        "update": {
                            "experience_points": int(amount)
                        }
                    }
                )
                await interaction.followup.send(f"✨ Configured **{user.name}**'s experience points to **{int(amount)} XP**.")
        except Exception as e:
            logger.exception("Failed to set points balance.")
            await interaction.followup.send("❌ Database update failed.", ephemeral=True)

    @points_group.command(name="reset", description="Reset a user's gold or experience points balance to default.")
    @app_commands.describe(user="The member to reset.", points_type="The type of points (Gold or XP).")
    @app_commands.choices(points_type=[
        app_commands.Choice(name="Gold", value="gold"),
        app_commands.Choice(name="XP", value="xp")
    ])
    async def reset_points(self, interaction: discord.Interaction, user: discord.Member, points_type: app_commands.Choice[str]) -> None:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ Only server administrators can use this command.", ephemeral=True)
            return

        db = get_db()
        await interaction.response.defer()

        try:
            if points_type.value == "gold":
                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "gold_balance": 100.00
                        },
                        "update": {
                            "gold_balance": 100.00
                        }
                    }
                )
                await interaction.followup.send(f"🪙 Reset **{user.name}**'s gold wallet balance to default (100.00 Gold).")
            else:
                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "experience_points": 0
                        },
                        "update": {
                            "experience_points": 0
                        }
                    }
                )
                await interaction.followup.send(f"✨ Reset **{user.name}**'s progression score to 0 XP.")
        except Exception as e:
            logger.exception("Failed to reset points.")
            await interaction.followup.send("❌ Database update failed.", ephemeral=True)

    @points_group.command(name="list", description="Display a ranked standings leaderboard of gold balances.")
    async def points_list(self, interaction: discord.Interaction) -> None:
        db = get_db()
        await interaction.response.defer()

        try:
            top_gold = await db.user.find_many(
                take=10,
                order={"gold_balance": "desc"}
            )

            if not top_gold:
                await interaction.followup.send("⚠️ No registered player profiles found in the database.")
                return

            embed = discord.Embed(
                title="🪙 Gold Standings Leaderboard",
                description="The richest adventurers in the guild ranked by vault balance.",
                color=discord.Color.gold(),
                timestamp=discord.utils.utcnow()
            )

            for rank, player in enumerate(top_gold, 1):
                embed.add_field(
                    name=f"#{rank} - {player.username}",
                    value=f"💰 Balance: **{float(player.gold_balance):.2f} Gold**",
                    inline=False
                )

            await interaction.followup.send(embed=embed)
        except Exception as e:
            logger.exception("Failed to render points list.")
            await interaction.followup.send("❌ Error fetching leaderboards.", ephemeral=True)

    @app_commands.command(name="rank", description="Display your leveling and experience standings.")
    @app_commands.describe(user="The member to view (defaults to yourself).")
    async def rank_card(self, interaction: discord.Interaction, user: Optional[discord.Member] = None) -> None:
        target = user or interaction.user
        db = get_db()
        await interaction.response.defer()

        try:
            profile = await db.user.find_unique(where={"discord_id": str(target.id)})
            if not profile:
                await interaction.followup.send(f"👤 **{target.name}** does not have an active adventurer profile yet.")
                return

            xp = int(profile.experience_points)
            level = math.floor(math.sqrt(xp / 100)) + 1 if xp > 0 else 1
            next_level_xp = ((level) ** 2) * 100
            prev_level_xp = ((level - 1) ** 2) * 100

            # Level progress calculations
            level_xp_range = next_level_xp - prev_level_xp
            xp_progress = xp - prev_level_xp
            percent = min(max(xp_progress / level_xp_range, 0.0), 1.0)
            progress_bar_filled = int(percent * 10)
            progress_bar = "🟩" * progress_bar_filled + "⬜" * (10 - progress_bar_filled)

            embed = discord.Embed(
                title=f"🛡️ Rank Status: {target.name}",
                description=f"**Title:** *{profile.custom_title or 'Novice Adventurer'}*",
                color=discord.Color.purple(),
                timestamp=discord.utils.utcnow()
            )
            embed.set_thumbnail(url=target.display_avatar.url)
            embed.add_field(name="Class", value=profile.player_class, inline=True)
            embed.add_field(name="Current Level", value=f"⭐ **Level {level}**", inline=True)
            embed.add_field(name="Experience Score", value=f"✨ **{xp} XP** (Next level: {next_level_xp} XP)", inline=False)
            embed.add_field(name="Progression Bar", value=f"`[{progress_bar}]` ({int(percent * 100)}%)", inline=False)

            await interaction.followup.send(embed=embed)
        except Exception as e:
            logger.exception("Failed to query rank card.")
            await interaction.followup.send("❌ Error fetching rank profile.", ephemeral=True)

    @app_commands.command(name="top", description="Display the top experience points leaderboard.")
    async def xp_leaderboard(self, interaction: discord.Interaction) -> None:
        db = get_db()
        await interaction.response.defer()

        try:
            top_xp = await db.user.find_many(
                take=10,
                order={"experience_points": "desc"}
            )

            if not top_xp:
                await interaction.followup.send("⚠️ No registered player profiles found in the database.")
                return

            embed = discord.Embed(
                title="🏆 Experience Points Leaderboard",
                description="The highest level adventurers in the guild ranked by XP score.",
                color=discord.Color.purple(),
                timestamp=discord.utils.utcnow()
            )

            for rank, player in enumerate(top_xp, 1):
                xp = int(player.experience_points)
                level = math.floor(math.sqrt(xp / 100)) + 1 if xp > 0 else 1
                embed.add_field(
                    name=f"#{rank} - {player.username}",
                    value=f"⭐ Level: **{level}** | Score: **{xp} XP**",
                    inline=False
                )

            await interaction.followup.send(embed=embed)
        except Exception as e:
            logger.exception("Failed to query XP top leaderboard.")
            await interaction.followup.send("❌ Error fetching leaderboard.", ephemeral=True)

    @app_commands.command(name="title", description="Customize your profile title card.")
    @app_commands.describe(text="The new custom title text.")
    async def set_custom_title(self, interaction: discord.Interaction, text: str) -> None:
        if len(text) > 40:
            await interaction.response.send_message("❌ Custom title cannot exceed 40 characters.", ephemeral=True)
            return

        db = get_db()
        discord_id = str(interaction.user.id)
        await interaction.response.defer(ephemeral=True)

        try:
            await db.user.upsert(
                where={"discord_id": discord_id},
                data={
                    "create": {
                        "discord_id": discord_id,
                        "username": interaction.user.name,
                        "custom_title": text
                    },
                    "update": {
                        "custom_title": text
                    }
                }
            )
            await interaction.followup.send(f"✅ Your custom profile title has been updated to: *\"{text}\"*.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to set custom title.")
            await interaction.followup.send("❌ Database connection error saving title card.", ephemeral=True)

    @app_commands.command(name="reset", description="Reset leveling and gold standings for a member or the entire server.")
    @app_commands.describe(scope="Whether to reset a single 'user' or 'all' members.", user="The target member to reset (if scope is 'user').")
    @app_commands.choices(scope=[
        app_commands.Choice(name="Specific User", value="user"),
        app_commands.Choice(name="Whole Server (Danger!)", value="all")
    ])
    @app_commands.default_permissions(administrator=True)
    async def reset_stats(self, interaction: discord.Interaction, scope: app_commands.Choice[str], user: Optional[discord.Member] = None) -> None:
        db = get_db()
        await interaction.response.defer()

        try:
            if scope.value == "all":
                await db.user.update_many(
                    data={
                        "experience_points": 0,
                        "gold_balance": 100.00
                    }
                )
                await interaction.followup.send("⚠️ **Server Stats Reset Complete**: All gold balances reset to **100.00** and all XP set to **0**.")
            else:
                if not user:
                    await interaction.followup.send("❌ You must specify a target user when resetting a single member's stats.", ephemeral=True)
                    return

                await db.user.upsert(
                    where={"discord_id": str(user.id)},
                    data={
                        "create": {
                            "discord_id": str(user.id),
                            "username": user.name,
                            "experience_points": 0,
                            "gold_balance": 100.00
                        },
                        "update": {
                            "experience_points": 0,
                            "gold_balance": 100.00
                        }
                    }
                )
                await interaction.followup.send(f"🔄 **Stats Reset Complete**: **{user.name}**'s gold balance reset to **100.00** and XP set to **0**.")
        except Exception as e:
            logger.exception("Failed to reset statistics.")
            await interaction.followup.send("❌ Database error during reset.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(LevelingCog(bot))
