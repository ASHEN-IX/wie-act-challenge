import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from app.services.trend_service import compute_trends
from app.database import reflections_collection
from pymongo.errors import PyMongoError
from utils.llm_client import (
    LLMRequestError,
    MissingMockResponderError,
    agent_config,
    ask,
)

logger = logging.getLogger(__name__)

load_dotenv()

REFLECTION_SYSTEM_PROMPT = (
    "You are an intelligent study coach writing a personalized weekly "
    "reflection. Be specific, human, and encouraging. Reference the actual "
    "numbers in your analysis."
)


def build_prompt(user_id: str, trends: dict) -> str:
    t     = trends["trends"]
    score = trends["progression_score"]
    weeks = trends["weeks_analyzed"]

    return f"""You are an intelligent study coach analyzing a student's weekly learning data.

Student ID: {user_id}
Weeks analyzed: {weeks}
Overall progression score: {score}/100

Performance data compared to last week:

Focus score (0 to 1, higher is better):
  - This week: {t['focus']['current']}
  - Last week: {t['focus']['previous']}
  - Change: {t['focus']['change_percent']:+.1f}%
  - Trend: {t['focus']['trend']}

Fatigue score (0 to 1, lower is better):
  - This week: {t['fatigue']['current']}
  - Last week: {t['fatigue']['previous']}
  - Change: {t['fatigue']['change_percent']:+.1f}%
  - Trend: {t['fatigue']['trend']}

XP earned:
  - This week: {t['xp']['current']}
  - Last week: {t['xp']['previous']}
  - Change: {t['xp']['change_percent']:+.1f}%
  - Trend: {t['xp']['trend']}

Total study minutes:
  - This week: {t['study_minutes']['current']}
  - Last week: {t['study_minutes']['previous']}
  - Change: {t['study_minutes']['change_percent']:+.1f}%
  - Trend: {t['study_minutes']['trend']}

Based on this data, generate a personalized and intelligent weekly reflection.
Be specific, human, and encouraging. Reference the actual numbers in your analysis.
Respond ONLY in this exact JSON format, no extra text, no markdown:

{{
  "summary": "2-3 sentences overall assessment referencing the actual data",
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1 or empty list if none"],
  "tips": ["concrete actionable tip 1", "concrete actionable tip 2", "concrete actionable tip 3"]
}}"""


def generate_reflection(user_id: str) -> dict:
    try:
        trends = compute_trends(user_id)
        logger.debug("trends_computed", extra={"user_id": user_id})

        if trends.get("status") in ("error", "insufficient_data"):
            logger.debug("trends_insufficient", extra={"user_id": user_id, "status": trends.get("status")})
            return trends

        prompt = build_prompt(user_id, trends)
        logger.debug("reflection_llm_call_start", extra={"user_id": user_id})

        raw = ""
        try:
            raw = ask("reflection", REFLECTION_SYSTEM_PROMPT, prompt).strip()
        except (LLMRequestError, MissingMockResponderError) as e:
            logger.error("reflection_llm_unavailable", extra={"user_id": user_id, "error": str(e)})
            return {"status": "error", "detail": "Reflection LLM unavailable. Please try again later."}
        logger.debug("reflection_llm_response_received", extra={"user_id": user_id, "response_preview": raw[:200]})

        start  = raw.find("{")
        end    = raw.rfind("}") + 1
        parsed = json.loads(raw[start:end])
        logger.debug("reflection_json_parsed", extra={"user_id": user_id})

    except json.JSONDecodeError as e:
        logger.error("reflection_json_decode_failed", extra={"error": str(e), "raw_response": raw})
        return {"status": "error", "detail": "Reflection generation failed. Please try again later."}
    except Exception as e:
        logger.error("reflection_generation_failed", extra={"error": str(e)}, exc_info=True)
        return {"status": "error", "detail": "Reflection generation failed. Please try again later."}

    reflection = {
        "user_id":           user_id,
        "period":            "weekly",
        "progression_score": trends["progression_score"],
        "summary":           parsed.get("summary", ""),
        "strengths":         parsed.get("strengths", []),
        "weaknesses":        parsed.get("weaknesses", []),
        "tips":              parsed.get("tips", []),
        "trends_snapshot":   trends["trends"],
        "generated_by":      agent_config("reflection").model,
        "created_at":        datetime.now(timezone.utc).isoformat()
    }

    try:
        reflections_collection.insert_one({**reflection})
        reflection.pop("_id", None)
    except PyMongoError as e:
        reflection["storage_warning"] = str(e)

    return reflection