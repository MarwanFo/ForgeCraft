import logging
import re
from typing import Optional
import discord
from discord import app_commands
from discord.ext import commands

# Import database client getter
from src.database import get_db

logger = logging.getLogger("forgecraft.roles")

COLOR_PALETTE = {
    "red": 0xff0000,
    "blue": 0x0000ff,
    "green": 0x00ff00,
    "yellow": 0xffff00,
    "orange": 0xffa500,
    "purple": 0x800080,
    "pink": 0xffc0cb,
    "cyan": 0x00ffff,
    "gold": 0xffd700
}

class RolesCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # Declare role subcommand group
    role_group = app_commands.Group(
        name="role",
        description="Manage server roles.",
        default_permissions=discord.Permissions(manage_roles=True)
    )

    @role_group.command(name="give", description="Grant a role to a server member.")
    @app_commands.describe(member="The target member.", role="The role to grant.")
    async def give_role(self, interaction: discord.Interaction, member: discord.Member, role: discord.Role) -> None:
        try:
            await member.add_roles(role, reason=f"Granted by {interaction.user.name}")
            await interaction.response.send_message(f"✅ Granted role **{role.name}** to **{member.name}**.")
        except Exception as e:
            logger.exception("Failed to grant role.")
            await interaction.response.send_message("❌ Failed to grant role. Check bot hierarchy and permissions.", ephemeral=True)

    @role_group.command(name="remove", description="Remove a role from a server member.")
    @app_commands.describe(member="The target member.", role="The role to remove.")
    async def remove_role(self, interaction: discord.Interaction, member: discord.Member, role: discord.Role) -> None:
        try:
            await member.remove_roles(role, reason=f"Removed by {interaction.user.name}")
            await interaction.response.send_message(f"✅ Removed role **{role.name}** from **{member.name}**.")
        except Exception as e:
            logger.exception("Failed to remove role.")
            await interaction.response.send_message("❌ Failed to remove role. Check bot hierarchy and permissions.", ephemeral=True)

    @role_group.command(name="multiple", description="Assign multiple roles to a member at once.")
    @app_commands.describe(
        member="The target member.",
        role1="First role to assign.",
        role2="Second role (optional).",
        role3="Third role (optional).",
        role4="Fourth role (optional).",
        role5="Fifth role (optional)."
    )
    async def give_multiple_roles(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        role1: discord.Role,
        role2: Optional[discord.Role] = None,
        role3: Optional[discord.Role] = None,
        role4: Optional[discord.Role] = None,
        role5: Optional[discord.Role] = None
    ) -> None:
        roles_to_add = [r for r in [role1, role2, role3, role4, role5] if r is not None]
        try:
            await member.add_roles(*roles_to_add, reason=f"Multiple roles assigned by {interaction.user.name}")
            role_names = ", ".join([r.name for r in roles_to_add])
            await interaction.response.send_message(f"✅ Assigned roles **{role_names}** to **{member.name}**.")
        except Exception as e:
            logger.exception("Failed to assign multiple roles.")
            await interaction.response.send_message("❌ Failed to assign roles. Check bot hierarchy.", ephemeral=True)

    @app_commands.command(name="roles", description="List server roles with member counts.")
    async def list_roles(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if not guild:
            await interaction.response.send_message("❌ This command can only be used in a server.", ephemeral=True)
            return

        embed = discord.Embed(
            title=f"📋 Guild Roles List: {guild.name}",
            color=discord.Color.blue(),
            timestamp=discord.utils.utcnow()
        )

        # Sort roles by position (descending, excluding @everyone)
        sorted_roles = sorted(guild.roles[1:], key=lambda r: r.position, reverse=True)

        description_lines = []
        for role in sorted_roles[:25]:  # Limit to top 25 roles to fit embed limits
            description_lines.append(f"{role.mention}: **{len(role.members)}** member(s)")

        if not description_lines:
            embed.description = "*No roles found.*"
        else:
            embed.description = "\n".join(description_lines)
            if len(sorted_roles) > 25:
                embed.set_footer(text=f"Showing 25 of {len(sorted_roles)} total roles.")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="colors", description="Display available nickname colors palette.")
    async def colors_palette(self, interaction: discord.Interaction) -> None:
        embed = discord.Embed(
            title="🎨 Nickname Colors Palette",
            description="Use `/color [color_name]` to select a pre-configured name color role.",
            color=discord.Color.teal()
        )
        for name, hex_val in COLOR_PALETTE.items():
            embed.add_field(name=name.capitalize(), value=f"Hex: `#{hex_val:06x}`", inline=True)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="color", description="Select a predefined nickname color role.")
    @app_commands.describe(color_name="The name of the color from the palette.")
    @app_commands.choices(color_name=[
        app_commands.Choice(name="Red", value="red"),
        app_commands.Choice(name="Blue", value="blue"),
        app_commands.Choice(name="Green", value="green"),
        app_commands.Choice(name="Yellow", value="yellow"),
        app_commands.Choice(name="Orange", value="orange"),
        app_commands.Choice(name="Purple", value="purple"),
        app_commands.Choice(name="Pink", value="pink"),
        app_commands.Choice(name="Cyan", value="cyan"),
        app_commands.Choice(name="Gold", value="gold")
    ])
    async def select_palette_color(self, interaction: discord.Interaction, color_name: app_commands.Choice[str]) -> None:
        guild = interaction.guild
        member = interaction.user
        if not guild or not isinstance(member, discord.Member):
            await interaction.response.send_message("❌ This command must be run in a server.", ephemeral=True)
            return

        await interaction.response.defer()

        # Clean up existing color palette roles from the user first
        for name in COLOR_PALETTE.keys():
            existing_role = discord.utils.get(guild.roles, name=f"ColorPalette-{name}")
            if existing_role and existing_role in member.roles:
                try:
                    await member.remove_roles(existing_role)
                except Exception:
                    pass

        try:
            # Check or create the target color role
            role_name = f"ColorPalette-{color_name.value}"
            target_role = discord.utils.get(guild.roles, name=role_name)
            if not target_role:
                color_hex = COLOR_PALETTE[color_name.value]
                target_role = await guild.create_role(
                    name=role_name,
                    color=discord.Color(color_hex),
                    reason="Predefined nickname color role setup"
                )

            await member.add_roles(target_role)
            await interaction.followup.send(f"🎨 Successfully updated your name color to **{color_name.name}**.")
        except Exception as e:
            logger.exception("Failed to assign palette color.")
            await interaction.followup.send("❌ Failed to assign name color. Check bot role permissions.", ephemeral=True)

    @app_commands.command(name="setcolor", description="Create or update your personalized custom hex name color.")
    @app_commands.describe(hex_code="The Hex color code (e.g. #FF5733 or FF5733).")
    async def set_custom_hex_color(self, interaction: discord.Interaction, hex_code: str) -> None:
        guild = interaction.guild
        member = interaction.user
        if not guild or not isinstance(member, discord.Member):
            await interaction.response.send_message("❌ This command must be run in a server.", ephemeral=True)
            return

        # Validate hex color code format
        clean_hex = hex_code.strip().lstrip("#")
        if not re.match(r"^[0-9a-fA-F]{6}$", clean_hex):
            await interaction.response.send_message("❌ Invalid hex color code. Format must be like `#FF5733` or `FF5733`.", ephemeral=True)
            return

        color_int = int(clean_hex, 16)
        db = get_db()
        await interaction.response.defer()

        try:
            # Query user database custom color role details
            profile = await db.user.find_unique(where={"discord_id": str(member.id)})
            role = None

            if profile and profile.color_role_id:
                role = guild.get_role(int(profile.color_role_id))

            if role:
                # Update existing custom color role
                await role.edit(color=discord.Color(color_int), name=f"Color-{clean_hex.upper()}")
            else:
                # Create a new custom color role
                role = await guild.create_role(
                    name=f"Color-{clean_hex.upper()}",
                    color=discord.Color(color_int),
                    reason="Custom hex nickname color selection"
                )
                # Save the new role ID to the user profile
                await db.user.upsert(
                    where={"discord_id": str(member.id)},
                    data={
                        "create": {
                            "discord_id": str(member.id),
                            "username": member.name,
                            "color_role_id": str(role.id)
                        },
                        "update": {
                            "color_role_id": str(role.id)
                        }
                    }
                )

            # Assign custom role to user
            await member.add_roles(role)
            await interaction.followup.send(f"🌈 Your nickname color has been updated to custom Hex code **#{clean_hex.upper()}**.")
        except Exception as e:
            logger.exception("Failed to create custom color role.")
            await interaction.followup.send("❌ Error creating or assigning custom color role. Check bot role configuration.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(RolesCog(bot))
