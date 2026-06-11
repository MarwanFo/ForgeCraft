import logging
import asyncio
from datetime import datetime
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.tickets")


class TicketDeleteView(discord.ui.View):
    """
    Persistent button view enabling admins/moderators to delete the closed ticket channel.
    """
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(label="Delete Channel", emoji="🗑️", style=discord.ButtonStyle.danger, custom_id="ticket_delete_button")
    async def delete_channel(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ You do not have permissions to delete ticket channels.", ephemeral=True)
            return

        await interaction.response.send_message("🗑️ This channel will be deleted in 3 seconds...")
        await asyncio.sleep(3.0)
        try:
            await interaction.channel.delete()
        except Exception as e:
            logger.exception("Failed to delete support channel.")


class TicketCloseView(discord.ui.View):
    """
    Persistent button view attached to active tickets enabling users or mods to close it.
    """
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(label="Close Ticket", emoji="🔒", style=discord.ButtonStyle.red, custom_id="ticket_close_button")
    async def close_ticket(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        db = get_db()
        channel_id = str(interaction.channel.id)

        await interaction.response.defer()

        try:
            # 1. Fetch the ticket record
            ticket_record = await db.ticket.find_unique(where={"channel_id": channel_id})

            if not ticket_record:
                await interaction.followup.send("❌ This channel is not registered as a ticket in the database.", ephemeral=True)
                return

            if ticket_record.status == "CLOSED":
                await interaction.followup.send("❌ This support ticket is already closed.", ephemeral=True)
                return

            # 2. Update database record to CLOSED status
            await db.ticket.update(
                where={"channel_id": channel_id},
                data={
                    "status": "CLOSED",
                    "closed_at": datetime.now()
                }
            )

            # 3. Revoke creator write access but keep read access (archive)
            try:
                owner = interaction.guild.get_member(int(ticket_record.discord_id))
                if not owner:
                    owner = await interaction.guild.fetch_member(int(ticket_record.discord_id))
                
                if owner:
                    # Grant read access but restrict send message access
                    await interaction.channel.set_permissions(
                        owner,
                        read_messages=True,
                        send_messages=False,
                        read_message_history=True
                    )
            except Exception as e:
                logger.warning(f"Could not update channel permissions for owner {ticket_record.discord_id}: {e}")

            # 4. Disable current closing buttons and attach deletion panel
            embed = discord.Embed(
                title="🔒 Support Ticket Closed",
                description="This ticket has been archived. Ticket owner write access has been revoked.",
                color=discord.Color.red(),
                timestamp=datetime.now()
            )
            embed.add_field(name="Closed By", value=interaction.user.mention, inline=True)

            # Update channel view and send delete options
            await interaction.followup.send(embed=embed, view=TicketDeleteView())

        except Exception as e:
            logger.exception("Failed to close ticket.")
            await interaction.followup.send("❌ Database update failure during ticket closure.", ephemeral=True)


class TicketCreateView(discord.ui.View):
    """
    Persistent button panel prompting users to spawn private support channels.
    """
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(label="Create Support Ticket", emoji="🎫", style=discord.ButtonStyle.green, custom_id="ticket_create_button")
    async def create_ticket(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        db = get_db()
        discord_id = str(interaction.user.id)

        await interaction.response.defer(ephemeral=True)

        try:
            # 1. Ensure user has profile
            user_profile = await db.user.find_unique(where={"discord_id": discord_id})
            if not user_profile:
                user_profile = await db.user.create(
                    data={
                        "discord_id": discord_id,
                        "username": interaction.user.name,
                        "experience_points": 0
                    }
                )

            # 2. Check if user already has an active open ticket
            active_ticket = await db.ticket.find_first(
                where={"discord_id": discord_id, "status": "OPEN"}
            )

            if active_ticket:
                await interaction.followup.send(
                    f"❌ You already have an open support ticket. Go to <#{active_ticket.channel_id}>.",
                    ephemeral=True
                )
                return

            # 3. Define permission overrides
            overwrites = {
                interaction.guild.default_role: discord.PermissionOverwrite(read_messages=False),
                interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True, read_message_history=True),
                interaction.guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True)
            }

            # Add moderator role permissions dynamically
            for role in interaction.guild.roles:
                if role.permissions.manage_channels or role.permissions.administrator:
                    overwrites[role] = discord.PermissionOverwrite(read_messages=True, send_messages=True, read_message_history=True)

            # 4. Spawn private channel under current category
            category = interaction.channel.category
            channel_name = f"ticket-{interaction.user.name.lower()}"
            
            ticket_channel = await interaction.guild.create_text_channel(
                name=channel_name,
                category=category,
                overwrites=overwrites
            )

            # 5. Save ticket log in database
            ticket_record = await db.ticket.create(
                data={
                    "discord_id": discord_id,
                    "channel_id": str(ticket_channel.id),
                    "status": "OPEN"
                }
            )

            # 6. Send welcome embed with closing action view
            welcome_embed = discord.Embed(
                title=f"🎫 Support Ticket — {interaction.user.name}",
                description="Welcome to your support channel. Please outline your issue or request here, and an administrator will assist you shortly.",
                color=discord.Color.blue(),
                timestamp=datetime.now()
            )
            welcome_embed.add_field(name="Ticket Owner", value=interaction.user.mention, inline=True)
            welcome_embed.add_field(name="Ticket ID", value=str(ticket_record.ticket_id), inline=True)

            await ticket_channel.send(embed=welcome_embed, view=TicketCloseView())

            # 7. Notify creator
            await interaction.followup.send(f"✅ Support channel created successfully: <#{ticket_channel.id}>", ephemeral=True)

        except Exception as e:
            logger.exception("Failed to initialize support ticket.")
            await interaction.followup.send("❌ Failed to spawn support channel. Contact admins.", ephemeral=True)


class TicketCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        # Register persistent views so they remain interactive after restarts
        self.bot.add_view(TicketCreateView())
        self.bot.add_view(TicketCloseView())
        self.bot.add_view(TicketDeleteView())

    @app_commands.command(name="tickets-setup", description="Deploy the persistent Support Ticket creation panel.")
    @app_commands.default_permissions(administrator=True)
    async def setup_tickets(self, interaction: discord.Interaction) -> None:
        embed = discord.Embed(
            title="🎫 ForgeCraft Support Center",
            description=(
                "Need assistance or have a query?\n"
                "Click the button below to spawn a private text channel. "
                "Our moderation team will assist you as soon as possible."
            ),
            color=discord.Color.dark_blue(),
            timestamp=datetime.now()
        )
        embed.set_footer(text="ForgeCraft Support Engine")

        # Post the setup embed containing the creation button
        await interaction.response.send_message("✅ Support panel deployed successfully.", ephemeral=True)
        await interaction.channel.send(embed=embed, view=TicketCreateView())


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(TicketCog(bot))
