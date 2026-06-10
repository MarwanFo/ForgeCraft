import os
import sys
import logging
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

def start_bot() -> None:
    token = os.getenv("DISCORD_TOKEN")
    if not token or token == "YOUR_DISCORD_BOT_TOKEN_HERE":
        logger.critical("DISCORD_TOKEN is missing or contains template default. Please update your backend/.env configurations.")
        sys.exit(1)
        
    bot = ForgeCraftBot()
    try:
        bot.run(token)
    except KeyboardInterrupt:
        logger.info("Bot execution interrupted by keyboard commands. Exiting.")
    except Exception as e:
        logger.critical(f"Critical exception occurred while running the bot: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_bot()
