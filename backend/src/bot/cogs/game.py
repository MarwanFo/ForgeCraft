import logging
import os
import random
import math
from datetime import datetime
from typing import Optional, List
import discord
from discord import app_commands
from discord.ext import commands, tasks

# Import database singleton getter
from src.database import get_db

logger = logging.getLogger("forgecraft.game")

class InventoryView(discord.ui.View):
    """
    Interactive UI view containing a Select Dropdown of inventory items
    and a 'Use' button to consume consumable items.
    """
    def __init__(self, owner_id: int, select_options: List[discord.SelectOption], inventory_items: List):
        super().__init__(timeout=60.0)
        self.owner_id = owner_id
        # Map item_id to inventory record
        self.inventory_items = {str(ui.item_id): ui for ui in inventory_items}
        self.selected_item_id = None

        # 1. Initialize Dropdown Selector
        self.select = discord.ui.Select(
            placeholder="Select an item to inspect or consume...",
            options=select_options,
            min_values=1,
            max_values=1
        )
        self.select.callback = self.on_select
        self.add_item(self.select)

        # 2. Initialize Use Button (Disabled by default)
        self.use_button = discord.ui.Button(
            label="Use Item",
            style=discord.ButtonStyle.success,
            disabled=True
        )
        self.use_button.callback = self.on_use
        self.add_item(self.use_button)

    async def on_select(self, interaction: discord.Interaction):
        # Validate that only the inventory owner can trigger selection updates
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message("🎒 This backpack belongs to another adventurer.", ephemeral=True)
            return

        self.selected_item_id = self.select.values[0]
        ui_record = self.inventory_items[self.selected_item_id]

        # Enable 'Use Item' button only if the selected item is consumable
        if ui_record.item.is_consumable:
            self.use_button.disabled = False
        else:
            self.use_button.disabled = True

        # Refresh the message interface view state
        await interaction.response.edit_message(view=self)

    async def on_use(self, interaction: discord.Interaction):
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message("🎒 This backpack belongs to another adventurer.", ephemeral=True)
            return

        if not self.selected_item_id:
            await interaction.response.send_message("❌ No item has been selected.", ephemeral=True)
            return

        db = get_db()
        ui_record = self.inventory_items[self.selected_item_id]
        discord_id = str(interaction.user.id)

        try:
            # Query current quantity to ensure transaction safety
            inv_record = await db.userinventory.find_unique(
                where={
                    "discord_id_item_id": {
                        "discord_id": discord_id,
                        "item_id": ui_record.item_id
                    }
                }
            )

            if not inv_record or inv_record.quantity <= 0:
                await interaction.response.send_message("❌ You no longer possess this item.", ephemeral=True)
                return

            # Decrement or delete record depending on stock quantity
            if inv_record.quantity == 1:
                await db.userinventory.delete(
                    where={
                        "discord_id_item_id": {
                            "discord_id": discord_id,
                            "item_id": ui_record.item_id
                        }
                    }
                )
            else:
                await db.userinventory.update(
                    where={
                        "discord_id_item_id": {
                            "discord_id": discord_id,
                            "item_id": ui_record.item_id
                        }
                    },
                    data={"quantity": {"decrement": 1}}
                )

            # Consume event message customization
            effect_msg = f"✨ You consumed 1x **{ui_record.item.name}**."
            if ui_record.item.name == "Bread":
                effect_msg = "🍞 You ate the Bread! It tastes slightly dry but fully restores your hunger."
            elif ui_record.item.name == "Health Elixir":
                effect_msg = "🧪 You drank the Health Elixir! A warm mystical light envelops you, restoring your health points."

            # Terminate view and strip UI components from the original embed
            self.stop()
            await interaction.response.send_message(effect_msg)
            await interaction.edit_original_response(view=None)

        except Exception as e:
            logger.error(f"Failed to consume item: {e}")
            await interaction.response.send_message("❌ Database transaction failed during consumption.", ephemeral=True)


class GameCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        # Map voice_channel_id -> consecutive active minutes
        self.voice_sessions = {}
        # Start the voice activity monitoring background task
        self.track_voice_channels.start()

    def cog_unload(self) -> None:
        self.track_voice_channels.cancel()

    @tasks.loop(seconds=60.0)
    async def track_voice_channels(self) -> None:
        """
        Background process checking voice channels every 60 seconds.
        Adds elements to the market commodity supply pools when voice metrics are hit.
        """
        db = get_db()
        for guild in self.bot.guilds:
            for vc in guild.voice_channels:
                # Count non-bot, unmuted members actively inside the channel
                active_members = [
                    m for m in vc.members
                    if not m.bot and not m.voice.self_deaf and not m.voice.deaf
                ]
                
                if len(active_members) >= 2:
                    self.voice_sessions[vc.id] = self.voice_sessions.get(vc.id, 0) + 1
                    logger.debug(f"Voice Channel {vc.name} incremented active minutes: {self.voice_sessions[vc.id]}/10")
                    
                    if self.voice_sessions[vc.id] >= 10:
                        # Reset tracking counter
                        self.voice_sessions[vc.id] = 0
                        logger.info(f"Voice Channel {vc.name} completed 10 minutes of active session. Injecting commodities.")
                        
                        try:
                            # Fetch crafting commodities (non-consumable items)
                            commodities = await db.marketcommodity.find_many(
                                include={"item": True}
                            )
                            crafting_commodities = [
                                c for c in commodities
                                if not c.item.is_consumable
                            ]
                            
                            if crafting_commodities:
                                target = random.choice(crafting_commodities)
                                increment = random.randint(5, 15)
                                
                                await db.marketcommodity.update(
                                    where={"commodity_id": target.commodity_id},
                                    data={"supply_pool": {"increment": increment}}
                                )
                                logger.info(f"Voice reward: Injected {increment}x '{target.item.name}' into market supply.")
                        except Exception as e:
                            logger.error(f"Failed to execute voice rewards injection: {e}")
                else:
                    # Reset counter if requirements (e.g. at least 2 users) are no longer met
                    if vc.id in self.voice_sessions:
                        self.voice_sessions[vc.id] = 0

    @track_voice_channels.before_loop
    async def before_voice_tracker(self) -> None:
        await self.bot.wait_until_ready()

    @app_commands.command(name="profile", description="Inspect character progression sheets, level, and balance.")
    @app_commands.describe(user="The member to view profile details for (defaults to yourself).")
    async def view_profile(self, interaction: discord.Interaction, user: Optional[discord.Member] = None) -> None:
        target_member = user or interaction.user
        db = get_db()

        try:
            await interaction.response.defer()
            # Fetch user profile metadata
            user_data = await db.user.find_unique(where={"discord_id": str(target_member.id)})

            if not user_data:
                # Register profile if user does not exist in database
                user_data = await db.user.create(
                    data={
                        "discord_id": str(target_member.id),
                        "username": target_member.name,
                        "experience_points": 0
                    }
                )

            xp = int(user_data.experience_points)
            # Level curve formula: Level = floor(sqrt(XP / 100)) + 1
            level = math.floor(math.sqrt(xp / 100)) + 1 if xp > 0 else 1
            next_level_xp = ((level) ** 2) * 100
            xp_remaining = next_level_xp - xp

            embed = discord.Embed(
                title=f"🛡️ Player Profile: {user_data.username}",
                color=discord.Color.dark_purple(),
                timestamp=datetime.now()
            )
            
            if target_member.display_avatar:
                embed.set_thumbnail(url=target_member.display_avatar.url)
                
            embed.add_field(name="Class Archetype", value=f"⭐ {user_data.player_class}", inline=True)
            embed.add_field(name="Current Level", value=f"📊 Level {level}", inline=True)
            embed.add_field(name="Experience Points", value=f"✨ {xp} / {next_level_xp} XP (Need {xp_remaining} XP for Level {level+1})", inline=False)
            embed.add_field(name="Wallet Gold", value=f"🪙 {float(user_data.gold_balance):.2f} Gold", inline=True)
            embed.add_field(name="Join Date", value=user_data.created_at.strftime("%Y-%m-%d"), inline=True)

            await interaction.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Error during profile retrieval: {e}")
            await interaction.followup.send("❌ Failed to fetch player profile. Please try again later.", ephemeral=True)

    @app_commands.command(name="inventory", description="Open your backpack to view or use items.")
    async def view_inventory(self, interaction: discord.Interaction) -> None:
        db = get_db()
        discord_id = str(interaction.user.id)

        try:
            await interaction.response.defer()
            # Fetch inventory slots joined with item descriptions
            inventory_items = await db.userinventory.find_many(
                where={"discord_id": discord_id},
                include={"item": True}
            )

            if not inventory_items:
                await interaction.followup.send("🎒 Your backpack is completely empty.", ephemeral=True)
                return

            # Group inventory slots by rarity
            grouped_slots = {}
            for ui in inventory_items:
                grouped_slots.setdefault(ui.item.rarity, []).append(ui)

            embed = discord.Embed(
                title=f"🎒 Backpack: {interaction.user.name}",
                color=discord.Color.green(),
                timestamp=datetime.now()
            )

            rarity_visuals = {
                "Common": "⚪",
                "Uncommon": "🟢",
                "Rare": "🔵",
                "Epic": "🟣",
                "Legendary": "🟡"
            }

            select_options = []
            for rarity, slots in grouped_slots.items():
                emoji = rarity_visuals.get(rarity, "❓")
                slot_descriptions = []
                
                for slot in slots:
                    slot_descriptions.append(
                        f"{emoji} **{slot.item.name}** x{slot.quantity} — *{slot.item.description or 'No descriptor'}*"
                    )
                    
                    # Populate dropdown selection list (Discord supports max 25 options)
                    if len(select_options) < 25:
                        select_options.append(
                            discord.SelectOption(
                                label=slot.item.name,
                                description=f"[{rarity}] Stock: {slot.quantity}",
                                value=str(slot.item_id),
                                emoji=emoji
                            )
                        )
                
                embed.add_field(
                    name=f"{rarity} Commodities",
                    value="\n".join(slot_descriptions),
                    inline=False
                )

            view = InventoryView(interaction.user.id, select_options, inventory_items)
            await interaction.followup.send(embed=embed, view=view)

        except Exception as e:
            logger.error(f"Error during inventory retrieval: {e}")
            await interaction.followup.send("❌ Failed to retrieve backpack contents. Please try again.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    """
    Standard load hook to register the Cog.
    """
    await bot.add_cog(GameCog(bot))
