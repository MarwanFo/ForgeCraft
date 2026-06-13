import logging
from typing import Optional, Set
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.temp_channels")

class TempChannelCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        # In-memory tracking of dynamically created voice channel IDs
        self.active_temp_channels: Set[int] = set()

    # Declare temp subcommand group
    temp_group = app_commands.Group(
        name="temp",
        description="Configure dynamic temporary voice channels."
    )

    @app_commands.command(name="moveme", description="Move yourself to a target voice channel.")
    @app_commands.describe(channel="The target voice channel to move into.")
    async def move_self(self, interaction: discord.Interaction, channel: discord.VoiceChannel) -> None:
        member = interaction.user
        if not isinstance(member, discord.Member) or not member.voice or not member.voice.channel:
            await interaction.response.send_message("❌ You must be connected to a voice channel to run this command.", ephemeral=True)
            return

        try:
            await member.move_to(channel, reason=f"Moved self via moveme command")
            await interaction.response.send_message(f"🚀 Moved you to **{channel.name}**.")
        except Exception as e:
            logger.exception("Failed to move member.")
            await interaction.response.send_message("❌ Failed to relocate you. Verify channel permissions.", ephemeral=True)

    @app_commands.command(name="move", description="Move a user or all users to a target voice channel.")
    @app_commands.describe(
        scope="Whether to move a single 'user' or 'all' users in your current channel.",
        member="The specific member to move (if scope is 'user').",
        channel="The target voice channel."
    )
    @app_commands.choices(scope=[
        app_commands.Choice(name="Specific Member", value="user"),
        app_commands.Choice(name="All Members in My Channel", value="all")
    ])
    @app_commands.default_permissions(move_members=True)
    async def move_members(self, interaction: discord.Interaction, scope: app_commands.Choice[str], channel: discord.VoiceChannel, member: Optional[discord.Member] = None) -> None:
        if scope.value == "user":
            if not member:
                await interaction.response.send_message("❌ You must specify a member to move.", ephemeral=True)
                return

            if not member.voice or not member.voice.channel:
                await interaction.response.send_message("❌ The target member is not connected to a voice channel.", ephemeral=True)
                return

            try:
                await member.move_to(channel, reason=f"Moved by {interaction.user.name}")
                await interaction.response.send_message(f"🚀 Relocated **{member.name}** to **{channel.name}**.")
            except Exception as e:
                logger.exception("Failed to move user.")
                await interaction.response.send_message("❌ Failed to relocate member. Check bot permissions.", ephemeral=True)
        else:
            # Move all users in the calling user's voice channel
            caller = interaction.user
            if not isinstance(caller, discord.Member) or not caller.voice or not caller.voice.channel:
                await interaction.response.send_message("❌ You must be connected to a voice channel to use this scope.", ephemeral=True)
                return

            voice_channel = caller.voice.channel
            members_to_move = list(voice_channel.members)

            if not members_to_move:
                await interaction.response.send_message("⚠️ No members found in your voice channel to relocate.", ephemeral=True)
                return

            await interaction.response.defer()
            success_count = 0
            for m in members_to_move:
                try:
                    await m.move_to(channel, reason=f"Bulk moved by {interaction.user.name}")
                    success_count += 1
                except Exception:
                    pass

            await interaction.followup.send(f"🚀 Relocated **{success_count}/{len(members_to_move)}** members to **{channel.name}**.")

    @temp_group.command(name="setup", description="Configure the 'Join to Create' voice hub channel.")
    @app_commands.describe(channel="The voice channel that will spawn dynamic rooms when joined.")
    @app_commands.default_permissions(administrator=True)
    async def temp_setup(self, interaction: discord.Interaction, channel: discord.VoiceChannel) -> None:
        db = get_db()
        guild_id = str(interaction.guild.id)
        await interaction.response.defer(ephemeral=True)

        try:
            await db.tempchannelsetting.upsert(
                where={"guild_id": guild_id},
                data={
                    "create": {
                        "guild_id": guild_id,
                        "hub_channel_id": str(channel.id),
                        "enabled": True
                    },
                    "update": {
                        "hub_channel_id": str(channel.id)
                    }
                }
            )
            await interaction.followup.send(f"✅ Dynamic voice room hub configured to channel: **{channel.name}**.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to save temp setup.")
            await interaction.followup.send("❌ Database connection error saving configuration.", ephemeral=True)

    @temp_group.command(name="toggle", description="Enable or disable the temporary voice room system.")
    @app_commands.describe(enabled="Select True to enable or False to disable.")
    @app_commands.default_permissions(administrator=True)
    async def temp_toggle(self, interaction: discord.Interaction, enabled: bool) -> None:
        db = get_db()
        guild_id = str(interaction.guild.id)
        await interaction.response.defer(ephemeral=True)

        try:
            await db.tempchannelsetting.upsert(
                where={"guild_id": guild_id},
                data={
                    "create": {
                        "guild_id": guild_id,
                        "enabled": enabled
                    },
                    "update": {
                        "enabled": enabled
                    }
                }
            )
            status = "enabled" if enabled else "disabled"
            await interaction.followup.send(f"✅ Temporary voice rooms system is now **{status}**.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to save toggle state.")
            await interaction.followup.send("❌ Database connection error saving toggle state.", ephemeral=True)

    @temp_group.command(name="max", description="Set the maximum concurrent temporary rooms a user can spawn.")
    @app_commands.describe(count="Maximum limit of concurrent channels.")
    @app_commands.default_permissions(administrator=True)
    async def temp_max(self, interaction: discord.Interaction, count: int) -> None:
        if count < 1 or count > 10:
            await interaction.response.send_message("❌ Maximum limit count must be between 1 and 10.", ephemeral=True)
            return

        db = get_db()
        guild_id = str(interaction.guild.id)
        await interaction.response.defer(ephemeral=True)

        try:
            await db.tempchannelsetting.upsert(
                where={"guild_id": guild_id},
                data={
                    "create": {
                        "guild_id": guild_id,
                        "max_channels": count
                    },
                    "update": {
                        "max_channels": count
                    }
                }
            )
            await interaction.followup.send(f"✅ User maximum temporary rooms count set to **{count}**.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to save max count.")
            await interaction.followup.send("❌ Database connection error saving count.", ephemeral=True)

    @temp_group.command(name="time", description="Configure cooldown timer delay.")
    @app_commands.describe(seconds="Cooldown in seconds (default is 10).")
    @app_commands.default_permissions(administrator=True)
    async def temp_time(self, interaction: discord.Interaction, seconds: int) -> None:
        if seconds < 0 or seconds > 300:
            await interaction.response.send_message("❌ Cooldown seconds must be between 0 and 300.", ephemeral=True)
            return

        db = get_db()
        guild_id = str(interaction.guild.id)
        await interaction.response.defer(ephemeral=True)

        try:
            await db.tempchannelsetting.upsert(
                where={"guild_id": guild_id},
                data={
                    "create": {
                        "guild_id": guild_id,
                        "cooldown_seconds": seconds
                    },
                    "update": {
                        "cooldown_seconds": seconds
                    }
                }
            )
            await interaction.followup.send(f"✅ Cooldown timer adjusted to **{seconds} seconds**.", ephemeral=True)
        except Exception as e:
            logger.exception("Failed to save cooldown seconds.")
            await interaction.followup.send("❌ Database connection error saving timer.", ephemeral=True)

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState) -> None:
        guild = member.guild
        db = get_db()

        # 1. Fetch channel config
        try:
            settings = await db.tempchannelsetting.find_unique(where={"guild_id": str(guild.id)})
            if settings and settings.enabled and settings.hub_channel_id:
                # 2. Spawn Room Trigger
                if after.channel and str(after.channel.id) == settings.hub_channel_id:
                    category = after.channel.category
                    channel_name = f"🎙️ {member.name}'s Room"
                    
                    try:
                        new_channel = await guild.create_voice_channel(
                            name=channel_name,
                            category=category,
                            reason="Spawning dynamic voice room"
                        )
                        self.active_temp_channels.add(new_channel.id)
                        await member.move_to(new_channel)
                    except Exception as e:
                        logger.exception(f"Failed to create voice channel for {member.name}")

            # 3. Clean up Room Trigger
            if before.channel and before.channel.id in self.active_temp_channels:
                if len(before.channel.members) == 0:
                    try:
                        await before.channel.delete(reason="Temporary voice channel empty")
                        self.active_temp_channels.discard(before.channel.id)
                    except Exception as e:
                        logger.exception(f"Failed to delete empty temporary channel {before.channel.name}")

        except Exception as e:
            logger.exception("Failed to process voice state update event.")


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(TempChannelCog(bot))
