import logging
from datetime import datetime
from typing import Optional
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.moderation")

class ModerationCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="warn", description="Issue a formal warning to a server member.")
    @app_commands.describe(user="The user to warn.", reason="The reason for the warning.")
    @app_commands.default_permissions(moderate_members=True)
    async def warn_member(self, interaction: discord.Interaction, user: discord.Member, reason: str) -> None:
        if user.bot:
            await interaction.response.send_message("❌ You cannot warn a bot user.", ephemeral=True)
            return

        db = get_db()
        await interaction.response.defer()

        try:
            # 1. Ensure target user is registered in the main users table
            target_profile = await db.user.find_unique(where={"discord_id": str(user.id)})
            if not target_profile:
                target_profile = await db.user.create(
                    data={
                        "discord_id": str(user.id),
                        "username": user.name,
                        "experience_points": 0
                    }
                )

            # 2. Write warning to UserWarning table
            warning_record = await db.userwarning.create(
                data={
                    "discord_id": str(user.id),
                    "moderator_id": str(interaction.user.id),
                    "reason": reason
                }
            )

            # 3. Fetch warnings count to display in confirmation
            warn_count = await db.userwarning.count(where={"discord_id": str(user.id)})

            # 4. DM the warned user
            dm_success = True
            try:
                dm_embed = discord.Embed(
                    title=f"⚠️ Warning Issued in {interaction.guild.name}",
                    description=f"You have received a formal warning.",
                    color=discord.Color.yellow(),
                    timestamp=datetime.now()
                )
                dm_embed.add_field(name="Reason", value=reason, inline=False)
                dm_embed.add_field(name="Warning Count", value=f"{warn_count} warning(s) logged.", inline=True)
                await user.send(embed=dm_embed)
            except discord.Forbidden:
                dm_success = False
                logger.warning(f"Could not send DM warning to user {user.name} (DMs closed).")

            # 5. Reply with confirmation embed
            confirm_embed = discord.Embed(
                title="⚖️ Member Warned",
                description=f"**{user.name}** has been warned.",
                color=discord.Color.orange(),
                timestamp=datetime.now()
            )
            confirm_embed.add_field(name="Warning ID", value=str(warning_record.warning_id), inline=False)
            confirm_embed.add_field(name="Reason", value=reason, inline=False)
            confirm_embed.add_field(name="Active Warns", value=f"{warn_count} warning(s)", inline=True)
            confirm_embed.add_field(name="DM Status", value="✅ Notified" if dm_success else "❌ DMs Closed", inline=True)

            await interaction.followup.send(embed=confirm_embed)

        except Exception as e:
            logger.exception("Failed to warning member.")
            await interaction.followup.send("❌ Error writing warning to database registry.", ephemeral=True)

    @app_commands.command(name="warnings", description="View warnings logged against a member.")
    @app_commands.describe(user="The member to inspect (defaults to yourself).")
    async def view_warnings(self, interaction: discord.Interaction, user: Optional[discord.Member] = None) -> None:
        target_user = user or interaction.user
        db = get_db()

        # Restrict checking other members' warnings to moderators/admins
        if target_user.id != interaction.user.id and not interaction.user.guild_permissions.moderate_members:
            await interaction.response.send_message("❌ You do not have permissions to view other players' warning history.", ephemeral=True)
            return

        await interaction.response.defer()

        try:
            # Query warning records
            warnings_list = await db.userwarning.find_many(
                where={"discord_id": str(target_user.id)},
                order={"issued_at": "desc"}
            )

            if not warnings_list:
                await interaction.followup.send(f"🛡️ **{target_user.name}** has a clean record (0 active warnings).")
                return

            embed = discord.Embed(
                title=f"📋 Warnings Log: {target_user.name}",
                description=f"Total warnings logged: **{len(warnings_list)}**",
                color=discord.Color.red(),
                timestamp=datetime.now()
            )

            for i, warn in enumerate(warnings_list, 1):
                mod_mention = f"<@{warn.moderator_id}>"
                date_str = warn.issued_at.strftime("%Y-%m-%d %H:%M")
                embed.add_field(
                    name=f"Warning #{i}",
                    value=f"**Reason:** {warn.reason}\n**Issued By:** {mod_mention}\n**Date:** {date_str}",
                    inline=False
                )

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.exception("Error retrieving warnings from database.")
            await interaction.followup.send("❌ Failed to query warnings registry.", ephemeral=True)

    @app_commands.command(name="clear", description="Clear a designated amount of messages in this channel.")
    @app_commands.describe(amount="Number of messages to delete.")
    @app_commands.default_permissions(manage_messages=True)
    async def clear_messages(self, interaction: discord.Interaction, amount: int) -> None:
        if amount < 1 or amount > 100:
            await interaction.response.send_message("❌ Amount must be between 1 and 100.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        try:
            deleted = await interaction.channel.purge(limit=amount)
            await interaction.followup.send(f"✨ Purged **{len(deleted)}** message(s) successfully.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to purge channel messages.")
            await interaction.followup.send("❌ Failed to purge messages. Make sure the bot has Manage Messages permission.", ephemeral=True)

    @app_commands.command(name="slowmode", description="Configure channel slowmode delay.")
    @app_commands.describe(seconds="Slowmode cooldown in seconds (0 to disable).")
    @app_commands.default_permissions(manage_channels=True)
    async def set_slowmode(self, interaction: discord.Interaction, seconds: int) -> None:
        if seconds < 0 or seconds > 21600:
            await interaction.response.send_message("❌ Slowmode delay must be between 0 (disabled) and 21600 seconds (6 hours).", ephemeral=True)
            return

        try:
            await interaction.channel.edit(slowmode_delay=seconds)
            if seconds == 0:
                await interaction.response.send_message("🕒 Channel slowmode has been **disabled**.")
            else:
                await interaction.response.send_message(f"🕒 Channel slowmode delay has been configured to **{seconds}s**.")
        except Exception as e:
            logger.exception("Failed to update slowmode delay.")
            await interaction.response.send_message("❌ Failed to adjust slowmode settings. Check channel edit permissions.", ephemeral=True)

    @app_commands.command(name="vkick", description="Disconnect a member from their active voice channel.")
    @app_commands.describe(user="The member to disconnect.")
    @app_commands.default_permissions(mute_members=True)
    async def voice_kick(self, interaction: discord.Interaction, user: discord.Member) -> None:
        if not user.voice or not user.voice.channel:
            await interaction.response.send_message("❌ This member is not currently connected to any voice channels.", ephemeral=True)
            return

        try:
            await user.move_to(None)
            await interaction.response.send_message(f"🎙️ **{user.name}** was disconnected from voice channel **{user.voice.channel.name}**.")
        except Exception as e:
            logger.exception("Failed to execute voice disconnect.")
            await interaction.response.send_message("❌ Failed to disconnect user. Check moderator permissions.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ModerationCog(bot))
