import json
import logging
import os
import time
from typing import List, Dict, Any
import redis.asyncio as aioredis

logger = logging.getLogger("forgecraft.buffer")

class ChatBuffer:
    """
    Manages chat message buffering in a Redis sliding-window queue.
    """
    def __init__(self) -> None:
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", "6379"))
        self.redis = aioredis.Redis(
            host=self.redis_host,
            port=self.redis_port,
            decode_responses=True
        )
        logger.info(f"Connected to Redis buffer store at {self.redis_host}:{self.redis_port}")

    def _get_key(self, guild_id: str, channel_id: str) -> str:
        return f"chat_buffer:{guild_id}:{channel_id}"

    async def push_message(
        self, guild_id: str, channel_id: str, author_id: str, content: str
    ) -> None:
        """
        Appends a message JSON payload to the queue and sets a 10-minute TTL.
        """
        key = self._get_key(guild_id, channel_id)
        payload = {
            "author_id": author_id,
            "content": content,
            "timestamp": time.time()
        }
        
        try:
            # Append message to list and refresh expiration to 10 minutes
            async with self.redis.pipeline(transaction=True) as pipe:
                pipe.rpush(key, json.dumps(payload))
                pipe.expire(key, 600)  # 10 minutes TTL
                await pipe.execute()
        except Exception as e:
            logger.error(f"Failed to push message to Redis buffer for key {key}: {e}")
            raise e

    async def get_and_clear_buffer(self, guild_id: str, channel_id: str) -> List[Dict[str, Any]]:
        """
        Atomically fetches all message items in the list and deletes the key.
        Returns a list of parsed message dictionaries.
        """
        key = self._get_key(guild_id, channel_id)
        try:
            async with self.redis.pipeline(transaction=True) as pipe:
                pipe.lrange(key, 0, -1)
                pipe.delete(key)
                results = await pipe.execute()
                
            raw_messages = results[0] if results else []
            parsed_messages = []
            
            for msg_str in raw_messages:
                try:
                    parsed_messages.append(json.loads(msg_str))
                except json.JSONDecodeError:
                    logger.warning(f"Skipping malformed JSON message in buffer: {msg_str}")
                    
            return parsed_messages
        except Exception as e:
            logger.error(f"Failed to fetch and clear Redis buffer for key {key}: {e}")
            raise e

    async def get_buffer_size(self, guild_id: str, channel_id: str) -> int:
        """
        Returns the number of message elements currently buffered for a channel.
        """
        key = self._get_key(guild_id, channel_id)
        try:
            return await self.redis.llen(key)  # type: ignore
        except Exception as e:
            logger.error(f"Failed to get buffer size from Redis for key {key}: {e}")
            return 0
            
    async def close(self) -> None:
        """
        Closes the Redis connection.
        """
        await self.redis.close()
