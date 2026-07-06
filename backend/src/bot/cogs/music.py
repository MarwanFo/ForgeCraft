import asyncio
import logging
import discord
from discord import app_commands
from discord.ext import commands
import yt_dlp as youtube_dl
import imageio_ffmpeg

logger = logging.getLogger("forgecraft.music")

# Silence unnecessary logs from yt-dlp
youtube_dl.utils.bug_reports_message = lambda: ''

ytdl_format_options = {
    'format': 'bestaudio/best',
    'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
    'restrictfilenames': True,
    'noplaylist': True,
    'nocheckcertificate': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0',  # Bind to ipv4
}

ffmpeg_options = {
    'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    'options': '-vn',
}

ytdl = youtube_dl.YoutubeDL(ytdl_format_options)

class YTDLSource(discord.PCMVolumeTransformer):
    def __init__(self, source, *, data, volume=0.5):
        super().__init__(source, volume)
        self.data = data
        self.title = data.get('title')
        self.url = data.get('url')

    @classmethod
    async def from_url(cls, url, *, loop=None, stream=False):
        loop = loop or asyncio.get_event_loop()
        data = await loop.run_in_executor(None, lambda: ytdl.extract_info(url, download=not stream))

        if 'entries' in data:
            # Take first item from search results
            data = data['entries'][0]

        filename = data['url'] if stream else ytdl.prepare_filename(data)
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        return cls(discord.FFmpegPCMAudio(filename, executable=ffmpeg_path, **ffmpeg_options), data=data)

class Track:
    def __init__(self, title, url, duration, requester):
        self.title = title
        self.url = url
        self.duration = duration
        self.requester = requester

class MusicPlayer:
    def __init__(self, bot, guild_id, channel):
        self.bot = bot
        self.guild_id = guild_id
        self.channel = channel
        self.queue = []
        self.current = None
        self.voice = None
        self.loop = bot.loop
        self.idle_time = 0
        self.task = self.loop.create_task(self.player_loop())

    async def player_loop(self):
        while True:
            # Check if voice client exists and is connected
            if not self.voice or not self.voice.is_connected():
                await asyncio.sleep(1)
                continue

            if not self.queue:
                self.idle_time += 1
                if self.idle_time >= 300:  # 5 minutes idle timeout
                    try:
                        await self.channel.send("💤 Left voice channel due to inactivity.")
                        await self.voice.disconnect()
                    except Exception:
                        pass
                    break
                await asyncio.sleep(1)
                continue
                
            self.idle_time = 0
            self.current = self.queue.pop(0)
            
            try:
                await self.channel.send(f"🎵 Now playing: **{self.current.title}** (Requested by: {self.current.requester})")
                source = await YTDLSource.from_url(self.current.url, loop=self.loop, stream=True)
                self.voice.play(source)
            except Exception as e:
                logger.error(f"Failed to stream track: {e}")
                await self.channel.send(f"❌ Failed to stream track: **{self.current.title}**")
                continue

            # Wait until it is no longer playing
            while self.voice and (self.voice.is_playing() or self.voice.is_paused()):
                await asyncio.sleep(1)

class MusicCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.players = {}

    def get_player(self, interaction: discord.Interaction) -> MusicPlayer:
        guild_id = interaction.guild_id
        if guild_id not in self.players:
            self.players[guild_id] = MusicPlayer(self.bot, guild_id, interaction.channel)
        return self.players[guild_id]

    @app_commands.command(name="play", description="Play a song from YouTube in your voice channel.")
    @app_commands.describe(query="The song name or YouTube link to play.")
    async def play(self, interaction: discord.Interaction, query: str) -> None:
        member = interaction.user
        if not isinstance(member, discord.Member) or not member.voice or not member.voice.channel:
            await interaction.response.send_message("❌ You must be connected to a voice channel to run this command.", ephemeral=True)
            return

        await interaction.response.defer()

        # Connect to voice if not already connected
        player = self.get_player(interaction)
        voice_client = interaction.guild.voice_client

        if not voice_client:
            try:
                player.voice = await member.voice.channel.connect()
            except Exception as e:
                logger.exception("Failed to connect to voice channel.")
                await interaction.followup.send(f"❌ Failed to join your voice channel. Error: `{type(e).__name__}: {str(e)}`")
                return
        else:
            player.voice = voice_client

        # Get video metadata
        try:
            loop = self.bot.loop or asyncio.get_event_loop()
            data = await loop.run_in_executor(None, lambda: ytdl.extract_info(query, download=False))
            if 'entries' in data:
                data = data['entries'][0]
            
            title = data.get('title')
            url = data.get('webpage_url') or data.get('url')
            duration = data.get('duration')
            
            track = Track(title=title, url=url, duration=duration, requester=member.name)
            player.queue.append(track)
            
            if player.voice.is_playing() or player.voice.is_paused():
                await interaction.followup.send(f"➕ Added **{title}** to queue (Position #{len(player.queue)}).")
            else:
                await interaction.followup.send(f"🔍 Searching and preparing to play: **{title}**")
        except Exception as e:
            logger.exception("Failed to extract info via yt-dlp.")
            await interaction.followup.send("❌ Failed to find or parse query.")

    @app_commands.command(name="skip", description="Skip the currently playing track.")
    async def skip(self, interaction: discord.Interaction) -> None:
        voice_client = interaction.guild.voice_client
        if not voice_client or not voice_client.is_playing():
            await interaction.response.send_message("❌ Nothing is currently playing.", ephemeral=True)
            return

        voice_client.stop()
        await interaction.response.send_message("⏭️ Skipped current track.")

    @app_commands.command(name="pause", description="Pause the currently playing track.")
    async def pause(self, interaction: discord.Interaction) -> None:
        voice_client = interaction.guild.voice_client
        if not voice_client or not voice_client.is_playing():
            await interaction.response.send_message("❌ Nothing is currently playing.", ephemeral=True)
            return

        voice_client.pause()
        await interaction.response.send_message("⏸️ Paused playback.")

    @app_commands.command(name="resume", description="Resume a paused track.")
    async def resume(self, interaction: discord.Interaction) -> None:
        voice_client = interaction.guild.voice_client
        if not voice_client or not voice_client.is_paused():
            await interaction.response.send_message("❌ Playback is not paused.", ephemeral=True)
            return

        voice_client.resume()
        await interaction.response.send_message("▶️ Resumed playback.")

    @app_commands.command(name="stop", description="Stop the player and clear the queue.")
    async def stop(self, interaction: discord.Interaction) -> None:
        voice_client = interaction.guild.voice_client
        if not voice_client:
            await interaction.response.send_message("❌ The bot is not connected to a voice channel.", ephemeral=True)
            return

        guild_id = interaction.guild_id
        if guild_id in self.players:
            self.players[guild_id].queue.clear()
            if self.players[guild_id].task:
                self.players[guild_id].task.cancel()
            del self.players[guild_id]

        if voice_client.is_playing() or voice_client.is_paused():
            voice_client.stop()
        await voice_client.disconnect()
        await interaction.response.send_message("🛑 Stopped player, cleared queue, and disconnected from voice channel.")

    @app_commands.command(name="queue", description="Show the current queue of tracks.")
    async def show_queue(self, interaction: discord.Interaction) -> None:
        player = self.players.get(interaction.guild_id)
        if not player or (not player.current and not player.queue):
            await interaction.response.send_message("❌ The queue is currently empty.", ephemeral=True)
            return

        embed = discord.Embed(title="🎵 ForgeCraft Music Queue", color=discord.Color.blue())
        if player.current:
            embed.add_field(name="Now Playing", value=f"**{player.current.title}** (Requested by: {player.current.requester})", inline=False)
        
        if player.queue:
            queue_list = "\n".join([f"**{i+1}.** {track.title} (Requested by: {track.requester})" for i, track in enumerate(player.queue[:10])])
            if len(player.queue) > 10:
                queue_list += f"\n...and {len(player.queue) - 10} more tracks."
            embed.add_field(name="Up Next", value=queue_list, inline=False)
        else:
            embed.add_field(name="Up Next", value="No tracks in queue.", inline=False)

        await interaction.response.send_message(embed=embed)

async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MusicCog(bot))
