import logging
import re
from datetime import datetime, timedelta
from typing import Optional
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.moderation")

def parse_duration(duration_str: str) -> Optional[timedelta]:
    match = re.match(r"^(\d+)([smhd])$", duration_str.lower().strip())
    if not match:
        try:
            # fallback to minutes if it's just a number
            val = int(duration_str.strip())
            return timedelta(minutes=val)
        except ValueError:
            return None
    val = int(match.group(1))
    unit = match.group(2)
    if unit == 's':
        return timedelta(seconds=val)
    elif unit == 'm':
        return timedelta(minutes=val)
    elif unit == 'h':
        return timedelta(hours=val)
    elif unit == 'd':
        return timedelta(days=val)
    return None

class ModerationCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # Declare subcommand groups for mute/unmute
    mute_group = app_commands.Group(
        name="mute",
        description="Mute a member in text channels or voice.",
        default_permissions=discord.Permissions(moderate_members=True)
    )
    unmute_group = app_commands.Group(
        name="unmute",
        description="Unmute a member from text channels or voice.",
        default_permissions=discord.Permissions(moderate_members=True)
    )

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
                    value=f"**Reason:** {warn.reason}\n**Issued By:** {mod_mention}\n**Date:** {date_str}\n**ID:** `{warn.warning_id}`",
                    inline=False
                )

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.exception("Error retrieving warnings from database.")
            await interaction.followup.send("❌ Failed to query warnings registry.", ephemeral=True)

    @app_commands.command(name="warn_remove", description="Remove a warning from a user.")
    @app_commands.describe(user="The user to remove warnings from.", warning_id="Specific warning ID to remove, or 'all' to clear all.")
    @app_commands.default_permissions(moderate_members=True)
    async def warn_remove(self, interaction: discord.Interaction, user: discord.User, warning_id: str) -> None:
        db = get_db()
        await interaction.response.defer()

        try:
            if warning_id.lower() == "all":
                deleted = await db.userwarning.delete_many(where={"discord_id": str(user.id)})
                await interaction.followup.send(f"✅ Cleared all warning records ({deleted} entries) for **{user.name}**.")
            else:
                # Find warning to ensure it belongs to the user
                warning = await db.userwarning.find_unique(where={"warning_id": warning_id})
                if not warning or warning.discord_id != str(user.id):
                    await interaction.followup.send("❌ Warning record not found or does not match specified user.", ephemeral=True)
                    return
                await db.userwarning.delete(where={"warning_id": warning_id})
                await interaction.followup.send(f"✅ Successfully deleted warning **`{warning_id}`** for user **{user.name}**.")
        except Exception as e:
            logger.exception("Error executing warn_remove.")
            await interaction.followup.send("❌ Database error removing warning record.", ephemeral=True)

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

    @app_commands.command(name="ban", description="Ban a member from the server.")
    @app_commands.describe(user="The member to ban.", reason="Reason for the ban.")
    @app_commands.default_permissions(ban_members=True)
    async def ban_member(self, interaction: discord.Interaction, user: discord.Member, reason: Optional[str] = "No reason provided") -> None:
        try:
            await user.ban(reason=reason)
            await interaction.response.send_message(f"🔨 **{user.name}** has been banned. Reason: *{reason}*")
        except Exception as e:
            logger.exception("Failed to ban member.")
            await interaction.response.send_message("❌ Failed to ban user. Make sure the bot has higher role hierarchy and ban permissions.", ephemeral=True)

    @app_commands.command(name="unban", description="Unban a user from the server by their ID.")
    @app_commands.describe(user_id="The Discord user ID to unban.")
    @app_commands.default_permissions(ban_members=True)
    async def unban_user(self, interaction: discord.Interaction, user_id: str) -> None:
        try:
            await interaction.guild.unban(discord.Object(id=int(user_id)))
            await interaction.response.send_message(f"🔓 User with ID **{user_id}** has been unbanned.")
        except Exception as e:
            logger.exception("Failed to unban user.")
            await interaction.response.send_message("❌ Failed to unban user. Make sure the ID is correct and they are actually banned.", ephemeral=True)

    @app_commands.command(name="kick", description="Kick a member from the server.")
    @app_commands.describe(user="The member to kick.", reason="Reason for the kick.")
    @app_commands.default_permissions(kick_members=True)
    async def kick_member(self, interaction: discord.Interaction, user: discord.Member, reason: Optional[str] = "No reason provided") -> None:
        try:
            await user.kick(reason=reason)
            await interaction.response.send_message(f"👞 **{user.name}** has been kicked. Reason: *{reason}*")
        except Exception as e:
            logger.exception("Failed to kick member.")
            await interaction.response.send_message("❌ Failed to kick user. Make sure the bot has higher role hierarchy and kick permissions.", ephemeral=True)

    @app_commands.command(name="lock", description="Lock a channel to prevent everyone from sending messages.")
    @app_commands.describe(channel="The channel to lock (defaults to current channel).")
    @app_commands.default_permissions(manage_channels=True)
    async def lock_channel(self, interaction: discord.Interaction, channel: Optional[discord.TextChannel] = None) -> None:
        target_channel = channel or interaction.channel
        try:
            overwrite = target_channel.overwrites_for(interaction.guild.default_role)
            overwrite.send_messages = False
            await target_channel.set_permissions(interaction.guild.default_role, overwrite=overwrite, reason=f"Channel locked by {interaction.user.name}")
            await interaction.response.send_message(f"🔒 **{target_channel.mention}** has been locked.")
        except Exception as e:
            logger.exception("Failed to lock channel.")
            await interaction.response.send_message("❌ Failed to lock channel. Check bot permissions.", ephemeral=True)

    @app_commands.command(name="unlock", description="Unlock a channel, restoring default sending permissions.")
    @app_commands.describe(channel="The channel to unlock (defaults to current channel).")
    @app_commands.default_permissions(manage_channels=True)
    async def unlock_channel(self, interaction: discord.Interaction, channel: Optional[discord.TextChannel] = None) -> None:
        target_channel = channel or interaction.channel
        try:
            overwrite = target_channel.overwrites_for(interaction.guild.default_role)
            overwrite.send_messages = None
            await target_channel.set_permissions(interaction.guild.default_role, overwrite=overwrite, reason=f"Channel unlocked by {interaction.user.name}")
            await interaction.response.send_message(f"🔓 **{target_channel.mention}** has been unlocked.")
        except Exception as e:
            logger.exception("Failed to unlock channel.")
            await interaction.response.send_message("❌ Failed to unlock channel. Check bot permissions.", ephemeral=True)

    @mute_group.command(name="text", description="Mute a member from typing in text channels.")
    @app_commands.describe(user="The member to mute.", reason="Reason for muting.")
    async def mute_text(self, interaction: discord.Interaction, user: discord.Member, reason: Optional[str] = "No reason provided") -> None:
        try:
            muted_role = discord.utils.get(interaction.guild.roles, name="Muted")
            if not muted_role:
                muted_role = await interaction.guild.create_role(name="Muted", reason="Mute command setup")
                # Configure channels to deny send_messages for this role
                for channel in interaction.guild.text_channels:
                    try:
                        await channel.set_permissions(muted_role, send_messages=False)
                    except Exception:
                        pass

            await user.add_roles(muted_role, reason=reason)
            await interaction.response.send_message(f"🤐 **{user.name}** has been text-muted. Reason: *{reason}*")
        except Exception as e:
            logger.exception("Failed to mute text.")
            await interaction.response.send_message("❌ Failed to text-mute user. Check bot role hierarchy and permissions.", ephemeral=True)

    @unmute_group.command(name="text", description="Unmute a member, allowing them to type in text channels again.")
    @app_commands.describe(user="The member to unmute.")
    async def unmute_text(self, interaction: discord.Interaction, user: discord.Member) -> None:
        try:
            muted_role = discord.utils.get(interaction.guild.roles, name="Muted")
            if muted_role and muted_role in user.roles:
                await user.remove_roles(muted_role, reason="Unmuted by command")
                await interaction.response.send_message(f"🔊 **{user.name}** has been text-unmuted.")
            else:
                await interaction.response.send_message(f"❌ **{user.name}** is not text-muted.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to unmute text.")
            await interaction.response.send_message("❌ Failed to text-unmute user. Check bot role hierarchy and permissions.", ephemeral=True)

    @mute_group.command(name="voice", description="Voice-mute a member in voice channels.")
    @app_commands.describe(user="The member to voice-mute.", reason="Reason for voice-mute.")
    async def mute_voice(self, interaction: discord.Interaction, user: discord.Member, reason: Optional[str] = "No reason provided") -> None:
        try:
            await user.edit(mute=True, reason=reason)
            await interaction.response.send_message(f"🎙️🤐 **{user.name}** has been server voice-muted.")
        except Exception as e:
            logger.exception("Failed to voice mute.")
            await interaction.response.send_message("❌ Failed to voice-mute user. Make sure they are in voice or check bot permissions.", ephemeral=True)

    @unmute_group.command(name="voice", description="Voice-unmute a member in voice channels.")
    @app_commands.describe(user="The member to voice-unmute.")
    async def unmute_voice(self, interaction: discord.Interaction, user: discord.Member) -> None:
        try:
            await user.edit(mute=False, reason="Unmuted by command")
            await interaction.response.send_message(f"🎙️🔊 **{user.name}** has been server voice-unmuted.")
        except Exception as e:
            logger.exception("Failed to voice unmute.")
            await interaction.response.send_message("❌ Failed to voice-unmute user. Make sure they are in voice or check bot permissions.", ephemeral=True)

    @app_commands.command(name="timeout", description="Timeout a user from text channels, reactions, and voice channels.")
    @app_commands.describe(user="The member to timeout.", duration="Duration (e.g. 10m, 1h, 1d) or just minutes.", reason="Reason for the timeout.")
    @app_commands.default_permissions(moderate_members=True)
    async def timeout_member(self, interaction: discord.Interaction, user: discord.Member, duration: str, reason: Optional[str] = "No reason provided") -> None:
        delta = parse_duration(duration)
        if not delta:
            await interaction.response.send_message("❌ Invalid duration format. Use e.g. `10m`, `2h`, `1d` or minutes.", ephemeral=True)
            return

        try:
            await user.timeout(delta, reason=reason)
            await interaction.response.send_message(f"⏳ **{user.name}** has been timed out for **{duration}**. Reason: *{reason}*")
        except Exception as e:
            logger.exception("Failed to timeout member.")
            await interaction.response.send_message("❌ Failed to timeout user. Check bot role hierarchy and permissions.", ephemeral=True)

    @app_commands.command(name="untimeout", description="Remove timeout from a user.")
    @app_commands.describe(user="The member to untimeout.")
    @app_commands.default_permissions(moderate_members=True)
    async def untimeout_member(self, interaction: discord.Interaction, user: discord.Member) -> None:
        try:
            await user.timeout(None, reason="Untimeout by command")
            await interaction.response.send_message(f"😇 **{user.name}**'s timeout has been removed.")
        except Exception as e:
            logger.exception("Failed to untimeout member.")
            await interaction.response.send_message("❌ Failed to remove timeout. Check bot permissions.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(ModerationCog(bot))
