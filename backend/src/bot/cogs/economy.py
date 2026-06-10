import logging
from decimal import Decimal
from typing import List
import discord
from discord import app_commands
from discord.ext import commands

# Import database and pricing formula engines
from src.database import get_db
from src.engine.economy_rules import calculate_price

logger = logging.getLogger("forgecraft.economy")

class EconomyTransactionError(Exception):
    """Custom exception class to trigger atomic transaction rollbacks."""
    pass

async def item_autocomplete(
    interaction: discord.Interaction,
    current: str,
) -> List[app_commands.Choice[str]]:
    """Helper method providing auto-completion suggestions for item commands."""
    try:
        db = get_db()
        items = await db.item.find_many()
        return [
            app_commands.Choice(name=item.name, value=item.name)
            for item in items if current.lower() in item.name.lower()
        ][:25]
    except Exception:
        return []

class EconomyCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="market", description="View market prices or buy and sell commodities.")
    async def market_ticker(self, interaction: discord.Interaction) -> None:
        """
        Slash command "/market" displaying pricing and stock metrics.
        """
        db = get_db()
        try:
            await interaction.response.defer()
            commodities = await db.marketcommodity.find_many(
                include={"item": True},
                order={"item": {"name": "asc"}}
            )

            if not commodities:
                await interaction.followup.send("⚠️ The marketplace has no registered commodities.")
                return

            embed = discord.Embed(
                title="⚖️ ForgeCraft Global Marketplace",
                description="Live ticker rates for local goods and crafting materials.",
                color=discord.Color.blue()
            )

            # Build a summary table format in embed fields
            for c in commodities:
                item_name = c.item.name
                price = float(c.current_price)
                supply = c.supply_pool
                rarity = c.item.rarity
                desc = c.item.description or "No desc."
                
                embed.add_field(
                    name=f"📦 {item_name} [{rarity}]",
                    value=f"• **Price:** {price:.2f} Gold\n• **Supply:** {supply} units\n• *{desc}*",
                    inline=False
                )

            await interaction.followup.send(embed=embed)
        except Exception as e:
            logger.error(f"Error during market ticker query: {e}")
            await interaction.followup.send("❌ Failed to query marketplace coordinates.", ephemeral=True)

    @app_commands.command(name="buy", description="Purchase items from the marketplace.")
    @app_commands.describe(item_name="The name of the item to purchase.", quantity="The amount of units to purchase.")
    @app_commands.autocomplete(item_name=item_autocomplete)
    async def market_buy(self, interaction: discord.Interaction, item_name: str, quantity: int) -> None:
        if quantity <= 0:
            await interaction.response.send_message("❌ Quantity must be a positive integer.", ephemeral=True)
            return

        db = get_db()
        discord_id = str(interaction.user.id)
        
        try:
            await interaction.response.defer()
            
            # 1. Run transaction sequence using db.tx() builder
            async with db.tx() as tx:
                # Query user profile
                user = await tx.user.find_unique(where={"discord_id": discord_id})
                if not user:
                    # Register user if they do not exist yet
                    user = await tx.user.create(
                        data={
                            "discord_id": discord_id,
                            "username": interaction.user.name,
                            "experience_points": 0
                        }
                    )
                
                # Query item and commodity data
                item = await tx.item.find_unique(
                    where={"name": item_name},
                    include={"commodities": True}
                )
                if not item or not item.commodities:
                    raise EconomyTransactionError(f"Item '{item_name}' is not listed in the marketplace.")

                commodity = item.commodities[0]
                
                # Check supply availability
                if commodity.supply_pool < quantity:
                    raise EconomyTransactionError(
                        f"Insufficient market supply. Only {commodity.supply_pool} units of '{item.name}' are available."
                    )
                
                # Calculate costs
                unit_price = commodity.current_price
                cost = unit_price * quantity
                
                # Verify gold balance
                if user.gold_balance < cost:
                    raise EconomyTransactionError(
                        f"Insufficient gold. Cost is {float(cost):.2f} Gold, but you only possess {float(user.gold_balance):.2f} Gold."
                    )
                
                # Decrement user gold balance
                await tx.user.update(
                    where={"discord_id": discord_id},
                    data={"gold_balance": {"decrement": cost}}
                )
                
                # Increment user inventory slot
                await tx.userinventory.upsert(
                    where={
                        "discord_id_item_id": {
                            "discord_id": discord_id,
                            "item_id": item.item_id
                        }
                    },
                    data={
                        "create": {
                            "discord_id": discord_id,
                            "item_id": item.item_id,
                            "quantity": quantity
                        },
                        "update": {
                            "quantity": {
                                "increment": quantity
                            }
                        }
                    }
                )
                
                # Recalculate commodity pricing post-supply decrease
                new_supply = commodity.supply_pool - quantity
                new_price = calculate_price(
                    base_value=item.base_value,
                    demand_multiplier=commodity.demand_multiplier,
                    supply_pool=new_supply
                )
                
                # Update commodity table
                await tx.marketcommodity.update(
                    where={"commodity_id": commodity.commodity_id},
                    data={
                        "supply_pool": new_supply,
                        "current_price": new_price
                    }
                )
                
                # Record transaction log
                await tx.markettransaction.create(
                    data={
                        "discord_id": discord_id,
                        "item_id": item.item_id,
                        "transaction_type": "BUY",
                        "quantity": quantity,
                        "unit_price": unit_price
                    }
                )

            # 2. Transaction succeeded: construct feedback response
            embed = discord.Embed(
                title="🛒 Transaction Invoice: BUY",
                color=discord.Color.green(),
                timestamp=discord.utils.utcnow()
            )
            embed.add_field(name="Purchased Item", value=f"**{item.name}** x{quantity}", inline=True)
            embed.add_field(name="Unit Price", value=f"{float(unit_price):.2f} Gold", inline=True)
            embed.add_field(name="Total cost", value=f"**{float(cost):.2f} Gold**", inline=True)
            embed.add_field(name="New Supply Pool", value=f"{new_supply} units", inline=True)
            embed.add_field(name="New Market Price", value=f"{float(new_price):.2f} Gold", inline=True)
            
            await interaction.followup.send(embed=embed)

        except EconomyTransactionError as ete:
            await interaction.followup.send(f"❌ Transaction Rejected: {ete}", ephemeral=True)
        except Exception as e:
            logger.exception("Unexpected error during buy execution.")
            await interaction.followup.send("❌ System transaction error during purchase.", ephemeral=True)

    @app_commands.command(name="sell", description="Sell items back to the marketplace.")
    @app_commands.describe(item_name="The name of the item to sell.", quantity="The amount of units to sell.")
    @app_commands.autocomplete(item_name=item_autocomplete)
    async def market_sell(self, interaction: discord.Interaction, item_name: str, quantity: int) -> None:
        if quantity <= 0:
            await interaction.response.send_message("❌ Quantity must be a positive integer.", ephemeral=True)
            return

        db = get_db()
        discord_id = str(interaction.user.id)
        
        try:
            await interaction.response.defer()
            
            # 1. Run transaction sequence using db.tx() builder
            async with db.tx() as tx:
                # Query item and commodity data
                item = await tx.item.find_unique(
                    where={"name": item_name},
                    include={"commodities": True}
                )
                if not item or not item.commodities:
                    raise EconomyTransactionError(f"Item '{item_name}' is not tradeable in the marketplace.")

                commodity = item.commodities[0]
                
                # Check user inventory stock levels
                inventory = await tx.userinventory.find_unique(
                    where={
                        "discord_id_item_id": {
                            "discord_id": discord_id,
                            "item_id": item.item_id
                        }
                    }
                )
                
                if not inventory or inventory.quantity < quantity:
                    current_qty = inventory.quantity if inventory else 0
                    raise EconomyTransactionError(
                        f"Insufficient stock. You only have {current_qty}x '{item.name}' in your backpack."
                    )
                
                # Calculate revenues
                unit_price = commodity.current_price
                revenue = unit_price * quantity
                
                # Decrement or delete inventory slot
                if inventory.quantity == quantity:
                    await tx.userinventory.delete(
                        where={
                            "discord_id_item_id": {
                                "discord_id": discord_id,
                                "item_id": item.item_id
                            }
                        }
                    )
                else:
                    await tx.userinventory.update(
                        where={
                            "discord_id_item_id": {
                                "discord_id": discord_id,
                                "item_id": item.item_id
                            }
                        },
                        data={"quantity": {"decrement": quantity}}
                    )
                
                # Increment user gold balance
                await tx.user.update(
                    where={"discord_id": discord_id},
                    data={"gold_balance": {"increment": revenue}}
                )
                
                # Recalculate commodity pricing post-supply increase
                new_supply = commodity.supply_pool + quantity
                new_price = calculate_price(
                    base_value=item.base_value,
                    demand_multiplier=commodity.demand_multiplier,
                    supply_pool=new_supply
                )
                
                # Update commodity table
                await tx.marketcommodity.update(
                    where={"commodity_id": commodity.commodity_id},
                    data={
                        "supply_pool": new_supply,
                        "current_price": new_price
                    }
                )
                
                # Record transaction log
                await tx.markettransaction.create(
                    data={
                        "discord_id": discord_id,
                        "item_id": item.item_id,
                        "transaction_type": "SELL",
                        "quantity": quantity,
                        "unit_price": unit_price
                    }
                )

            # 2. Transaction succeeded: construct feedback response
            embed = discord.Embed(
                title="🛒 Transaction Invoice: SELL",
                color=discord.Color.red(),
                timestamp=discord.utils.utcnow()
            )
            embed.add_field(name="Sold Item", value=f"**{item.name}** x{quantity}", inline=True)
            embed.add_field(name="Unit Price", value=f"{float(unit_price):.2f} Gold", inline=True)
            embed.add_field(name="Total Revenue", value=f"**{float(revenue):.2f} Gold**", inline=True)
            embed.add_field(name="New Supply Pool", value=f"{new_supply} units", inline=True)
            embed.add_field(name="New Market Price", value=f"{float(new_price):.2f} Gold", inline=True)
            
            await interaction.followup.send(embed=embed)

        except EconomyTransactionError as ete:
            await interaction.followup.send(f"❌ Transaction Rejected: {ete}", ephemeral=True)
        except Exception as e:
            logger.exception("Unexpected error during sell execution.")
            await interaction.followup.send("❌ System transaction error during sale.", ephemeral=True)

async def setup(bot: commands.Bot) -> None:
    """Standard load hook to register the Cog."""
    await bot.add_cog(EconomyCog(bot))
