import json
import logging
import os
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

logger = logging.getLogger("forgecraft.analytics")

# 1. Initialize NVIDIA client using the OpenAI-compatible wrapper
client = AsyncOpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ.get("NVIDIA_API_KEY")
)
model_name = os.environ.get("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct")

class AIAnalysisResult(BaseModel):
    context_detected: str = Field(
        description="The primary conversation context categorization."
    )
    intensity_score: float = Field(
        description="Floating-point intensity value ranging between 0.0 and 1.0."
    )
    world_event_triggered: bool = Field(
        description="True if the conversation context should trigger a random drop or zone encounter."
    )
    reward_item: Optional[str] = Field(
        default=None,
        description="Item rewarded from the drop ('Scrap Metal', 'Bread', 'Health Elixir', 'Silicon Crystal Core', 'ForgeCore Spark' or null)."
    )
    flavor_text: str = Field(
        description="A stylized medieval/sci-fi RPG narrative summarizing the conversation batch."
    )

SYSTEM_PROMPT = """You are the ForgeCraft AI RPG Dungeon Master and World Narrative Generator.
Your job is to analyze a batch of chat messages from a community Discord server and return a structured JSON response.

Strictly adhere to the following schema rules in your response:
{
  "context_detected": "string descriptive of the topic",
  "intensity_score": 0.85, (float from 0.0 to 1.0)
  "world_event_triggered": true/false, (true if chat is deeply focused, creative, gaming, coding, or highly dramatic)
  "reward_item": "Scrap Metal" | "Bread" | "Health Elixir" | "Silicon Crystal Core" | "ForgeCore Spark" | null, (must be one of these names or null)
  "flavor_text": "A creative flavor text narrating how this chat session materialized into a game action."
}

Rules:
1. ONLY return a raw JSON string. Do not prefix or suffix with explanations.
2. The `reward_item` must be selected from the valid list above, or set to null if no event is triggered.
3. Keep the flavor_text engaging, fun, and themed after an RPG environment (e.g. sci-fi tech or medieval crafting).
"""

async def analyze_chat_batch(messages: List[Dict[str, Any]]) -> AIAnalysisResult:
    """
    Submits a batch of chat messages to the NVIDIA Llama NIM API.
    Parses and returns the structured AIAnalysisResult.
    """
    if not messages:
        return AIAnalysisResult(
            context_detected="silence",
            intensity_score=0.0,
            world_event_triggered=False,
            reward_item=None,
            flavor_text="The silence of the void stretches onward."
        )

    # Format chat batch for evaluation
    chat_transcript = "\n".join(
        [f"User {m.get('author_id')}: {m.get('content')}" for m in messages]
    )

    try:
        logger.info(f"Dispatching chat batch analysis request to NVIDIA API ({model_name})...")
        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze this transcript:\n\n{chat_transcript}"}
            ],
            temperature=0.2,
            max_tokens=500
        )
        
        raw_content = response.choices[0].message.content.strip()
        logger.info(f"Received analysis output: {raw_content}")

        # Clean JSON wrappers if present in the response
        json_match = re.search(r"\{.*\}", raw_content, re.DOTALL)
        if json_match:
            clean_json = json_match.group(0)
        else:
            clean_json = raw_content

        # Validate with Pydantic
        result = AIAnalysisResult.model_validate_json(clean_json)
        return result

    except Exception as e:
        logger.error(f"Error during Llama-3.1 API completion or validation: {e}")
        # Return fallback safe analysis to prevent the event loop from crashing
        return AIAnalysisResult(
            context_detected="unknown_discussion",
            intensity_score=0.1,
            world_event_triggered=False,
            reward_item=None,
            flavor_text="A strange distortion blocks the chronicle observers from recording this event."
        )
