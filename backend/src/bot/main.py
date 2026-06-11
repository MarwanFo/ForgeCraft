import logging
import os
import random
from datetime import datetime
import discord
from discord.ext import commands

# Import project engines and database wrapper
from src.database import init_db, close_db, get_db
from src.engine.buffer import ChatBuffer
from src.engine.analytics import analyze_chat_batch

logger = logging.getLogger("forgecraft.bot")
logging.basicConfig(level=logging.INFO)

class ForgeCraftBot(commands.Bot):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.messages = True
        intents.guilds = True
        intents.message_content = True
        intents.voice_states = True
        
        # Configure command prefix (slash commands are primary, prefix acts as fallback)
        super().__init__(
            command_prefix="fc!",
            intents=intents,
            help_command=None
        )
        self.chat_buffer = ChatBuffer()

    async def setup_hook(self) -> None:
        """
        Setup hook called before bot connects.
        Initializes Prisma client, loads cogs, and registers slash commands.
        """
        logger.info("Initializing bot setup hook...")
        
        # 1. Connect to PostgreSQL via Prisma
        await init_db()
        
        # 2. Dynamic module loading for all cogs in the cogs/ folder
        cogs_dir = os.path.join(os.path.dirname(__file__), "cogs")
        if os.path.exists(cogs_dir):
            for filename in os.listdir(cogs_dir):
                if filename.endswith(".py") and filename != "__init__.py":
                    extension_name = f"src.bot.cogs.{filename[:-3]}"
                    try:
                        await self.load_extension(extension_name)
                        logger.info(f"Cog extension '{extension_name}' loaded successfully.")
                    except Exception as e:
                        logger.exception(f"Failed to load cog extension '{extension_name}'.")
        
        # 3. Synchronize Slash Commands globally or instantly to a target testing guild
        try:
            guild_id = os.getenv("TEST_GUILD_ID")
            if guild_id:
                logger.info(f"Syncing application commands instantly to target testing guild: {guild_id}...")
                guild_target = discord.Object(id=int(guild_id))
                self.tree.copy_global_to(guild=guild_target)
                synced = await self.tree.sync(guild=guild_target)
                logger.info(f"Guild-specific sync complete. Registered {len(synced)} slash command(s) instantly.")
            else:
                logger.info("Syncing application commands globally...")
                synced = await self.tree.sync()
                logger.info(f"Global sync complete. Registered {len(synced)} slash command(s) globally.")
        except Exception as e:
            logger.error(f"Failed to sync slash commands: {e}")

    async def on_ready(self) -> None:
        logger.info(f"ForgeCraft Bot connected successfully as {self.user} (ID: {self.user.id})")

    async def on_message(self, message: discord.Message) -> None:
        """
        Event handler running on every guild and DM message.
        """
        # 1. Ignore bot messages
        if message.author.bot:
            return

        db = get_db()
        author_id = str(message.author.id)
        
        # 2. Experience progression tracking (Idempotent profile registration & increment)
        try:
            await db.user.upsert(
                where={"discord_id": author_id},
                data={
                    "create": {
                        "discord_id": author_id,
                        "username": message.author.name,
                        "experience_points": 1,
                    },
                    "update": {
                        "experience_points": {
                            "increment": 1
                        },
                        "last_active_at": datetime.now()
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to track XP for user {author_id}: {e}")

        # 3. Redis sliding-window chat buffer processing
        try:
            guild_id = str(message.guild.id) if message.guild else "dm"
            channel_id = str(message.channel.id)
            
            await self.chat_buffer.push_message(
                guild_id=guild_id,
                channel_id=channel_id,
                author_id=author_id,
                content=message.content
            )
            
            # Check if sliding window has met the processing threshold of 10 messages
            buffer_size = await self.chat_buffer.get_buffer_size(guild_id, channel_id)
            if buffer_size >= 10:
                logger.info(f"Channel {channel_id} buffer reached trigger capacity ({buffer_size}). Starting batch evaluation.")
                
                # Retrieve and flush message buffer atomically
                messages = await self.chat_buffer.get_and_clear_buffer(guild_id, channel_id)
                
                # Execute NVIDIA NIM Llama analysis
                analysis = await analyze_chat_batch(messages)
                logger.info(f"Analysis completed: EventTriggered={analysis.world_event_triggered}, Item={analysis.reward_item}")
                
                # If an event is triggered, save lore ledger record and optional items
                if analysis.world_event_triggered:
                    # Write event chronicles to database
                    await db.loreledger.create(
                        data={
                            "event_type": analysis.context_detected,
                            "raw_trigger_summary": f"Context: {analysis.context_detected} | Intensity: {analysis.intensity_score:.2f}",
                            "generated_lore": analysis.flavor_text
                        }
                    )
                    
                    if analysis.reward_item:
                        # Fetch requested reward item details from our database catalog
                        item = await db.item.find_unique(where={"name": analysis.reward_item})
                        if item:
                            # Select a random active participant from this chat block to win the item
                            winner_msg = random.choice(messages)
                            winner_id = winner_msg["author_id"]
                            
                            # Ensure the winner exists in our user database
                            winner_user = await db.user.find_unique(where={"discord_id": winner_id})
                            if not winner_user:
                                # Create bare minimum profile to prevent Foreign Key constraints
                                await db.user.create(
                                    data={
                                        "discord_id": winner_id,
                                        "username": f"Adventurer_{winner_id[:5]}",
                                        "experience_points": 0
                                    }
                                )
                            
                            # Allocate the item reward to winner inventory
                            await db.userinventory.upsert(
                                where={
                                    "discord_id_item_id": {
                                        "discord_id": winner_id,
                                        "item_id": item.item_id
                                    }
                                },
                                data={
                                    "create": {
                                        "discord_id": winner_id,
                                        "item_id": item.item_id,
                                        "quantity": 1
                                    },
                                    "update": {
                                        "quantity": {
                                            "increment": 1
                                        }
                                    }
                                }
                            )
                            logger.info(f"Allocated 1x '{item.name}' to User {winner_id}.")
                            
                            # Dispatch embed layout notification to Discord
                            embed = discord.Embed(
                                title="✨ The Forge Awakens: World Event! ✨",
                                description=analysis.flavor_text,
                                color=discord.Color.gold()
                            )
                            embed.add_field(name="Theme Context", value=analysis.context_detected.replace("_", " ").title(), inline=True)
                            embed.add_field(name="Selected Winner", value=f"<@{winner_id}>", inline=True)
                            embed.add_field(name="Received Reward", value=f"1x **{item.name}** ({item.rarity})", inline=True)
                            await message.channel.send(embed=embed)
                        else:
                            logger.warning(f"AI requested reward item '{analysis.reward_item}', but it is not seeded in catalog.")
                    else:
                        # Event triggered with no drop. Send standard lore chronicler embed to Discord channel
                        embed = discord.Embed(
                            title="📜 Chronicler Event Logged 📜",
                            description=analysis.flavor_text,
                            color=discord.Color.blue()
                        )
                        embed.add_field(name="Theme Context", value=analysis.context_detected.replace("_", " ").title(), inline=True)
                        await message.channel.send(embed=embed)
                        
        except Exception as e:
            logger.exception("Error occurred in on_message processing lifecycle.")

        # 4. Process command matching (if any prefix commands exist)
        await self.process_commands(message)

    async def close(self) -> None:
        """
        Graceful teardown hooks.
        """
        logger.info("Initiating bot shutdown sequence...")
        await self.chat_buffer.close()
        await close_db()
        await super().close()
