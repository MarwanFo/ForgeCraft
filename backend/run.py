import os
import sys
import logging
import asyncio
import uvicorn
from dotenv import load_dotenv

# Ensure backend root directory is prepended to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("forgecraft.runner")

# Load environment configs
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
    logger.info("Configuration variables loaded from .env file.")
else:
    logger.warning("No .env configuration file discovered. Standard system env values will be used.")

from src.bot.main import ForgeCraftBot
from src.api import app

class UvicornServer(uvicorn.Server):
    def install_signal_handlers(self) -> None:
        # Prevent Uvicorn from registering its own signal handlers 
        # so they do not conflict with discord.py's native event loop cleanup signals
        pass

async def run_services() -> None:
    token = os.getenv("DISCORD_TOKEN")
    if not token or token == "YOUR_DISCORD_BOT_TOKEN_HERE":
        logger.critical("DISCORD_TOKEN is missing or contains template default. Please update your backend/.env configurations.")
        sys.exit(1)

    bot = ForgeCraftBot()

    # Configure API server running on port 8000
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        loop="asyncio"
    )
    server = UvicornServer(config)

    logger.info("Starting ForgeCraft AI Bot and FastAPI API Bridge concurrently...")
    try:
        # Run both services concurrently in the same asyncio event loop
        await asyncio.gather(
            bot.start(token),
            server.serve()
        )
    except KeyboardInterrupt:
        logger.info("Termination signal received.")
    finally:
        # Ensure graceful teardown
        if not bot.is_closed():
            logger.info("Closing active bot connection...")
            await bot.close()

def main() -> None:
    try:
        asyncio.run(run_services())
    except KeyboardInterrupt:
        logger.info("Execution interrupted. Exiting.")

if __name__ == "__main__":
    main()
