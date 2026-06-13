import logging
import random
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional
import discord
import httpx
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.utility")

async def shorten_url(url: str) -> Optional[str]:
    # TinyURL free API endpoint
    api_url = f"http://tinyurl.com/api-create.php?url={urllib.parse.quote(url)}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(api_url, timeout=5.0)
            if resp.status_code == 200:
                return resp.text.strip()
        except Exception as e:
            logger.warning(f"Failed to shorten URL: {e}")
    return None

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
            # Ensure user has a profile in the main database
            user_profile = await db.user.find_unique(where={"discord_id": discord_id})
            if not user_profile:
                user_profile = await db.user.create(
                    data={
                        "discord_id": discord_id,
                        "username": interaction.user.name,
                        "experience_points": 0
                    }
                )

            # Check last claim logs
            daily_record = await db.dailyreward.find_unique(where={"discord_id": discord_id})

            if not daily_record:
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

            embed = discord.Embed(
                title=message_title,
                color=discord.Color.gold() if streak >= 7 else discord.Color.green(),
                timestamp=now
            )
            embed.add_field(name="Gold Earned", value=f"🪙 **{gold_earned:.2f} Gold**", inline=True)
            embed.add_field(name="Current Streak", value=f"🔥 **{streak}/7 Days**", inline=True)
            embed.add_field(name="New Wallet Balance", value=f"💰 **{new_balance:.2f} Gold**", inline=False)
            
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

            target_profile = await db.user.find_unique(where={"discord_id": str(user.id)})
            if not target_profile:
                await db.user.create(
                    data={
                        "discord_id": str(user.id),
                        "username": user.name,
                        "experience_points": 0
                    }
                )

            await db.reputationlog.create(
                data={
                    "sender_id": discord_id,
                    "receiver_id": str(user.id)
                }
            )

            rep_count = await db.reputationlog.count(where={"receiver_id": str(user.id)})

            embed = discord.Embed(
                title="🌟 Reputation Awarded!",
                description=f"<@{interaction.user.id}> has awarded a reputation point to <@{user.id}>!",
                color=discord.Color.purple(),
                timestamp=now
            )
            embed.add_field(name="Target Adventurer", value=user.name, inline=True)
            embed.add_field(name="Total Reputation", value=f"⭐ **{rep_count}** points", inline=True)

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.exception("Failed to issue reputation point.")
            await interaction.followup.send("❌ Database connection failed during reputation update.", ephemeral=True)

    @app_commands.command(name="avatar", description="Display a user's avatar.")
    @app_commands.describe(member="The member whose avatar you want to view.")
    async def show_avatar(self, interaction: discord.Interaction, member: Optional[discord.Member] = None) -> None:
        target = member or interaction.user
        embed = discord.Embed(
            title=f"🖼️ {target.name}'s Avatar",
            color=discord.Color.blue()
        )
        embed.set_image(url=target.display_avatar.url)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="invite", description="Get the link to invite the bot to your server.")
    async def bot_invite(self, interaction: discord.Interaction) -> None:
        permissions = discord.Permissions(administrator=True)
        invite_url = discord.utils.oauth_url(interaction.client.user.id, permissions=permissions)
        
        embed = discord.Embed(
            title="🔗 Invite ForgeCraft Bot",
            description="Invite ForgeCraft to your guild with Administrator permissions to access Moderation, Gamification, and dynamic voice/tickets systems.",
            color=discord.Color.dark_theme()
        )
        
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Invite Bot", url=invite_url, style=discord.ButtonStyle.link))
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="ping", description="Test the bot's response time latency.")
    async def test_ping(self, interaction: discord.Interaction) -> None:
        latency = round(interaction.client.latency * 1000)
        embed = discord.Embed(
            description=f"🏓 Pong! Latency: **{latency}ms**",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="server", description="Get core information about this server.")
    async def server_info(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if not guild:
            await interaction.response.send_message("❌ This command can only be used in a server.", ephemeral=True)
            return

        text_channels = len(guild.text_channels)
        voice_channels = len(guild.voice_channels)
        created_at = guild.created_at.strftime("%Y-%m-%d")

        embed = discord.Embed(
            title=f"🏰 Server Info: {guild.name}",
            color=discord.Color.teal(),
            timestamp=datetime.now()
        )
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)

        embed.add_field(name="Owner", value=f"<@{guild.owner_id}>", inline=True)
        embed.add_field(name="Created At", value=created_at, inline=True)
        embed.add_field(name="Member Count", value=f"👥 **{guild.member_count}**", inline=True)
        embed.add_field(name="Text Channels", value=f"💬 **{text_channels}**", inline=True)
        embed.add_field(name="Voice Channels", value=f"🎙️ **{voice_channels}**", inline=True)
        embed.add_field(name="Verification Level", value=str(guild.verification_level).title(), inline=True)

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="roll", description="Roll a dice or generate a random number.")
    @app_commands.describe(max_number="The maximum number limit (default is 6).")
    async def roll_dice(self, interaction: discord.Interaction, max_number: Optional[int] = 6) -> None:
        if max_number < 1:
            await interaction.response.send_message("❌ Max number must be 1 or higher.", ephemeral=True)
            return
        result = random.randint(1, max_number)
        await interaction.response.send_message(f"🎲 You rolled a **{result}** (1-{max_number})")

    @app_commands.command(name="vote", description="Vote for the bot to support development.")
    async def vote_link(self, interaction: discord.Interaction) -> None:
        embed = discord.Embed(
            title="🗳️ Vote for ForgeCraft",
            description="Support the bot's growth by voting on Discord Bot registries. Every vote grants you custom daily perks!",
            color=discord.Color.brand_red()
        )
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Vote on Top.gg", url="https://top.gg", style=discord.ButtonStyle.link))
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="short", description="Shorten a URL using an async API.")
    @app_commands.describe(url="The URL link to shorten.")
    async def shorten_link(self, interaction: discord.Interaction, url: str) -> None:
        await interaction.response.defer()
        short = await shorten_url(url)
        if short:
            await interaction.followup.send(f"🔗 Here is your shortened link: **<{short}>**")
        else:
            await interaction.followup.send("❌ Failed to shorten URL. Make sure the URL is valid.")

    @app_commands.command(name="user", description="Display comprehensive information about a user.")
    @app_commands.describe(member="The member to query (defaults to yourself).")
    async def user_info(self, interaction: discord.Interaction, member: Optional[discord.Member] = None) -> None:
        target = member or interaction.user
        db = get_db()
        await interaction.response.defer()

        # Gather database profiles
        profile = await db.user.find_unique(where={"discord_id": str(target.id)})
        warn_count = await db.userwarning.count(where={"discord_id": str(target.id)})

        joined_guild = target.joined_at.strftime("%Y-%m-%d") if target.joined_at else "Unknown"
        created_acc = target.created_at.strftime("%Y-%m-%d")
        top_role = target.top_role.mention if hasattr(target, "top_role") else "None"

        embed = discord.Embed(
            title=f"👤 User Card: {target.name}",
            color=discord.Color.dark_magenta(),
            timestamp=datetime.now()
        )
        embed.set_thumbnail(url=target.display_avatar.url)

        embed.add_field(name="Mention", value=target.mention, inline=True)
        embed.add_field(name="User ID", value=f"`{target.id}`", inline=True)
        embed.add_field(name="Top Role", value=top_role, inline=True)
        embed.add_field(name="Account Created", value=created_acc, inline=True)
        embed.add_field(name="Guild Joined", value=joined_guild, inline=True)

        if profile:
            embed.add_field(name="Gold Wallet", value=f"🪙 **{profile.gold_balance:.2f} Gold**", inline=True)
            embed.add_field(name="XP Score", value=f"⭐ **{profile.experience_points} XP**", inline=True)
            embed.add_field(name="Class", value=profile.player_class, inline=True)
            embed.add_field(name="Custom Title", value=profile.custom_title or "*None*", inline=True)
            embed.add_field(name="Language Preference", value=f"🗣️ `{profile.language.upper()}`", inline=True)
            embed.add_field(name="Active Warnings", value=f"⚠️ **{warn_count}** warning(s)", inline=True)
        else:
            embed.add_field(name="ForgeCraft Profile", value="*Not Registered*", inline=False)

        await interaction.followup.send(embed=embed)

    @app_commands.command(name="setlang", description="Set your preferred language for the bot.")
    @app_commands.describe(language="Select your language.")
    @app_commands.choices(language=[
        app_commands.Choice(name="English", value="en"),
        app_commands.Choice(name="French", value="fr"),
        app_commands.Choice(name="Spanish", value="es"),
        app_commands.Choice(name="Arabic", value="ar")
    ])
    async def set_language(self, interaction: discord.Interaction, language: app_commands.Choice[str]) -> None:
        db = get_db()
        discord_id = str(interaction.user.id)
        await interaction.response.defer(ephemeral=True)

        try:
            # Upsert user registration
            await db.user.upsert(
                where={"discord_id": discord_id},
                data={
                    "create": {
                        "discord_id": discord_id,
                        "username": interaction.user.name,
                        "language": language.value
                    },
                    "update": {
                        "language": language.value
                    }
                }
            )
            await interaction.followup.send(f"🗣️ Language preference updated to **{language.name}** (`{language.value.upper()}`).", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to update language setting.")
            await interaction.followup.send("❌ Database connection error updating language configuration.", ephemeral=True)

    @app_commands.command(name="help", description="Feeling lost? Renders categories of all active slash commands.")
    async def help_menu(self, interaction: discord.Interaction) -> None:
        embed = discord.Embed(
            title="📖 ForgeCraft Help Index",
            description="Welcome to ForgeCraft AI! Explore our premium, categorized command deck below.",
            color=discord.Color.blurple(),
            timestamp=datetime.now()
        )
        embed.add_field(
            name="🛡️ Moderation Commands",
            value="`/warn`, `/warnings`, `/warn_remove`, `/clear`, `/slowmode`, `/vkick`, `/ban`, `/unban`, `/kick`, `/lock`, `/unlock`, `/mute text`, `/mute voice`, `/timeout`, `/untimeout`",
            inline=False
        )
        embed.add_field(
            name="ℹ️ Utility & Core Info",
            value="`/daily`, `/rep`, `/avatar`, `/invite`, `/ping`, `/server`, `/roll`, `/vote`, `/short`, `/user`, `/setlang`, `/help`",
            inline=False
        )
        embed.add_field(
            name="🎫 Support Systems",
            value="`/tickets setup` (spawns the interactive ticketing panel for members)",
            inline=False
        )
        embed.add_field(
            name="💰 Economy & Adventures",
            value="`/profile`, `/balance`, `/market`, `/buy`, `/sell`, `/mine`, `/inventory`",
            inline=False
        )
        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(UtilityCog(bot))
