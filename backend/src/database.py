import logging
from typing import Optional
from prisma import Prisma

# Configure logger for database events
logger = logging.getLogger("forgecraft.database")
logging.basicConfig(level=logging.INFO)

# Global singleton client instance
_prisma_client: Optional[Prisma] = None

async def init_db() -> Prisma:
    """
    Initializes the Prisma Client and connects to the PostgreSQL database.
    This function is idempotent; calling it multiple times will return the existing client.
    """
    global _prisma_client
    if _prisma_client is None:
        try:
            logger.info("Initializing Prisma database client...")
            _prisma_client = Prisma()
            await _prisma_client.connect()
            logger.info("Prisma database connection established successfully.")
        except Exception as e:
            logger.exception("Failed to connect to the database via Prisma.")
            _prisma_client = None
            raise e
    return _prisma_client

async def close_db() -> None:
    """
    Safely disconnects the Prisma client from the database.
    """
    global _prisma_client
    if _prisma_client is not None:
        try:
            logger.info("Closing Prisma database connection...")
            if _prisma_client.is_connected():
                await _prisma_client.disconnect()
            logger.info("Prisma database connection closed successfully.")
        except Exception as e:
            logger.exception("Failed to close the Prisma database connection.")
        finally:
            _prisma_client = None

def get_db() -> Prisma:
    """
    Returns the active Prisma Client instance.
    Raises RuntimeError if the client has not been initialized.
    """
    global _prisma_client
    if _prisma_client is None:
        raise RuntimeError(
            "Prisma database client has not been initialized. "
            "Please invoke init_db() before calling get_db()."
        )
    return _prisma_client
