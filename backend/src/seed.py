import asyncio
import logging
from decimal import Decimal
from database import init_db, close_db, get_db

# Configure logger
logger = logging.getLogger("forgecraft.seed")
logging.basicConfig(level=logging.INFO)

# Define the catalog items to seed
CATALOG_ITEMS = [
    {
        "name": "Scrap Metal",
        "rarity": "Common",
        "base_value": Decimal("10.00"),
        "is_consumable": False,
        "description": "Rusty scrap metal, useful for basic forging."
    },
    {
        "name": "Bread",
        "rarity": "Common",
        "base_value": Decimal("5.00"),
        "is_consumable": True,
        "description": "A simple loaf that restores small stamina."
    },
    {
        "name": "Health Elixir",
        "rarity": "Uncommon",
        "base_value": Decimal("25.00"),
        "is_consumable": True,
        "description": "A glowing red potion that restores health."
    },
    {
        "name": "Silicon Crystal Core",
        "rarity": "Rare",
        "base_value": Decimal("120.00"),
        "is_consumable": False,
        "description": "A highly condensed silicon cluster humming with algorithmic energy."
    },
    {
        "name": "ForgeCore Spark",
        "rarity": "Legendary",
        "base_value": Decimal("850.00"),
        "is_consumable": False,
        "description": "The glowing heart of an ancient forge machine."
    }
]

async def seed_database() -> None:
    """
    Seeds the database with default Items and their corresponding MarketCommodity configurations.
    This seed run is idempotent: existing items with matching names will not be duplicated.
    """
    # 1. Connect to the database
    await init_db()
    db = get_db()
    
    logger.info("Starting database seed process...")
    
    try:
        for item_data in CATALOG_ITEMS:
            name = item_data["name"]
            
            # Check if the item already exists in the catalog
            existing_item = await db.item.find_unique(where={"name": name})
            
            if existing_item:
                logger.info(f"Item '{name}' already exists in database. Skipping seed.")
                continue
            
            # Use an interactive transaction to create both Item and MarketCommodity atomically
            async with db.tx() as tx:
                # Create the item catalog record
                new_item = await tx.item.create(
                    data={
                        "name": name,
                        "description": item_data["description"],
                        "rarity": item_data["rarity"],
                        "base_value": item_data["base_value"],
                        "is_consumable": item_data["is_consumable"]
                    }
                )
                
                # Create the corresponding market commodity tracking supply and demand
                await tx.marketcommodity.create(
                    data={
                        "item_id": new_item.item_id,
                        "current_price": item_data["base_value"],
                        "supply_pool": 1000,
                        "demand_multiplier": Decimal("1.00")
                    }
                )
                
            logger.info(f"Successfully seeded '{name}' with corresponding MarketCommodity registry.")
            
        logger.info("Database seeding completed successfully.")
        
    except Exception as e:
        logger.exception("An error occurred while seeding the database.")
        raise e
    finally:
        # 2. Safely close database connection
        await close_db()

if __name__ == "__main__":
    asyncio.run(seed_database())
