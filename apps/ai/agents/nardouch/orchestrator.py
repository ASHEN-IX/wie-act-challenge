"""Course-aware orchestration; deterministic pedagogy stays apart from language."""

import json
import os
import re
import threading
from pathlib import Path
from agents.tutor.grounding import retrieve_grounding, CitationResult
from security.prompt_guard import wrap_untrusted
from utils.llm_client import (
    ask,
    LLMUnavailableError,
    LLMRequestError,
    MissingMockResponderError,
)
from utils.logger import get_logger
from .language import language_instruction
from .schemas import TurnRequest, TurnResponse, GeneratedAnswer

logger = get_logger(__name__)
_slots = threading.BoundedSemaphore(
    max(1, min(16, int(os.getenv("NARDOUCH_CONCURRENCY", "4"))))
)


class NardouchUnavailable(Exception):
    pass


def select_agent(req: TurnRequest) -> str:
    # Only a short request for clarification qualifies; length alone cannot
    # downgrade math, code, a misconception or a difficult follow-up.
    text = req.grounding.question.strip().lower()
    clarification = bool(
        re.fullmatch(
            r"(?:what do you mean|can you clarify|clarify|chnowa ta9sed|que veux-tu dire)[? .!]*",
            text,
        )
    )
    return (
        "nardouch_compact"
        if clarification and req.mode == "explain"
        else "nardouch_capable"
    )


def respond(req: TurnRequest, vector_store=None) -> TurnResponse:
    if not _slots.acquire(blocking=False):
        raise NardouchUnavailable("Nardouch is busy; retry shortly")
    try:
        return _respond(req, vector_store)
    except (
        LLMUnavailableError,
        LLMRequestError,
        MissingMockResponderError,
        ValueError,
        KeyError,
        OSError,
    ) as exc:
        logger.warning(
            "nardouch_turn_unavailable",
            extra={"trace_id": req.traceId, "error_type": type(exc).__name__},
        )
        raise NardouchUnavailable(
            "Nardouch is unavailable; your question is preserved"
        ) from None
    finally:
        _slots.release()


def _respond(req, vector_store):
    _, passages, _ = retrieve_grounding(req.grounding, vector_store)
    agent = select_agent(req)
    prompt_path = Path(
        os.getenv(
            "NARDOUCH_PROMPTS_PATH", str(Path(__file__).with_name("prompts.json"))
        )
    )
    prompts = json.loads(prompt_path.read_text())
    preferred_speech = {"darija": "ar", "fr": "fr", "en": "en"}.get(req.language.language)
    speech_target = preferred_speech or "ar, fr, or en based on the dominant language of the answer"
    system = "\n".join(
        [
            prompts["persona"],
            prompts["modes"][req.mode],
            language_instruction(req.language, req.grounding.question),
            "Return ONLY JSON: {displayText: string, sourceIds: integer[], followups: string[], "
            "speechText: string, speechLanguage: string}. "
            f"Set speechLanguage to {speech_target}. Write speechText entirely in that one language, "
            "without code-switching or changing languages mid-sentence. For ar use Tunisian Darija in Arabic "
            "script, never Arabizi. Use plain speech of at most 500 characters, preserving the answer's "
            "meaning and any exact identifiers or formulas. Keep the same question or hint and do not "
            "introduce new facts. Omit URLs, citations and stage directions from speechText. "
            "sourceIds are 1-based indices of the supplied passages that support the explanation. "
            "Use at least one source when relevant passages are supplied; do not cite unrelated passages. "
            "When no passage supports the question, use no sourceIds and explicitly say course evidence is missing. "
            "Never include invented references or URLs. Up to three short follow-up questions in the response language.",
            json.dumps(prompts.get("examples", []), ensure_ascii=False),
        ]
    )
    payload = {
        "objective": req.objective,
        "conversation": [t.model_dump() for t in req.history],
        "question": req.grounding.question,
        "passages": [
            {"id": i + 1, "text": p["text"][:6000]} for i, p in enumerate(passages)
        ],
    }
    def mock_answer(_prompt: str) -> str:
        return json.dumps({
            "displayText": "Mock tutor response. " + (
                "See the attached course excerpt." if passages else "No course excerpt was found."
            ),
            "sourceIds": [1] if passages else [],
            "followups": [],
        })

    # Real inference dispatches once; a user retry needs a fresh budget reservation.
    result = ask(
        agent=agent,
        system_prompt=system,
        user_prompt=wrap_untrusted(
            json.dumps(payload, ensure_ascii=False), label="LEARNING_CONTEXT"
        ),
        max_tokens=2400,
        trace_id=req.traceId,
        return_metadata=True,
        mock_fn=mock_answer if os.getenv("APP_ENV") in {"development", "test"} else None,
    )
    answer = GeneratedAnswer.model_validate_json(result.text)
    if not answer.displayText.strip() or any(
        not s.strip() or len(s) > 300 for s in answer.followups
    ):
        raise ValueError("Invalid output")
    if len(set(answer.sourceIds)) != len(answer.sourceIds) or any(
        i < 1 or i > len(passages) for i in answer.sourceIds
    ):
        raise ValueError("Foreign citation")
    # References must be structured, not model-invented inline document markers.
    if re.search(r"https?://|\[doc:", answer.displayText):
        raise ValueError("Unsupported inline reference")
    citations = [
        CitationResult(
            documentId=passages[i - 1]["documentId"],
            pageNumber=passages[i - 1]["pageNumber"],
            chunkId=passages[i - 1]["chunkId"],
            textHash=passages[i - 1]["textHash"],
            quote=passages[i - 1]["text"],
            verified=True,
        )
        for i in answer.sourceIds
    ]
    spoken = (answer.speechText or "").strip()
    spoken_language = answer.speechLanguage
    contains_arabic = bool(re.search(r"[\u0621-\u064a]", spoken))
    valid_speech = (
        spoken
        and spoken_language
        and (preferred_speech is None or preferred_speech == spoken_language)
        and contains_arabic == (spoken_language == "ar")
        and not re.search(r"https?://|\[|```", spoken)
    )
    return TurnResponse(
        displayText=answer.displayText,
        speechText=spoken if valid_speech else answer.displayText,
        speechLanguage=spoken_language if valid_speech else None,
        followups=answer.followups,
        citations=citations,
        evidenceStatus="source_linked" if citations else "missing_context",
        mode=req.mode,
        language=req.language,
        usage={
            "traceId": req.traceId,
            "model": result.model,
            "tier": result.tier,
            "executionMode": result.execution_mode,
            "latencyMs": result.latency_ms,
            "tokens": result.usage,
            "fallbackUsed": result.fallback_used,
        },
    )
