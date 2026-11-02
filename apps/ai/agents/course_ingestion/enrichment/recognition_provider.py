"""Provider-independent contract for source-backed recognition proposals.

No provider invocation, approval, persistence, or publication occurs here.
A caller must establish consent and enforce budgets before invoking a provider.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Protocol

from agents.course_ingestion.enrichment.recognition_proposal import SourceReference, create_proposal


@dataclass(frozen=True)
class RecognitionRequest:
    source: SourceReference
    course_id: str
    image_png: bytes
    extraction_text: str

    def __post_init__(self) -> None:
        if not self.course_id or len(self.course_id) > 128:
            raise ValueError("invalid course identity")
        if not self.image_png.startswith(b"\x89PNG\r\n\x1a\n") or len(self.image_png) > 1_000_000:
            raise ValueError("invalid or oversized source crop")
        if len(self.extraction_text) > 8000:
            raise ValueError("source text too large")


@dataclass(frozen=True)
class RecognitionResult:
    raw_json: str
    provider: str
    model: str
    model_version: str


class RecognitionProvider(Protocol):
    """Implementations return untrusted content; they do not promote it."""

    async def recognize(self, request: RecognitionRequest) -> RecognitionResult: ...


def project_proposal(request: RecognitionRequest, result: RecognitionResult) -> dict:
    """Bind validated output to immutable course, revision and source evidence."""
    if not result.model_version or len(result.model_version) > 256:
        raise ValueError("invalid model version")
    proposal = create_proposal(result.raw_json, source=request.source,
                               provider=result.provider, model=result.model)
    binding = {
        "course_id": request.course_id,
        "source": proposal["source"],
        "crop_sha256": hashlib.sha256(request.image_png).hexdigest(),
        "provider": result.provider,
        "model": result.model,
        "model_version": result.model_version,
        "response": proposal["response"],
    }
    canonical = json.dumps(binding, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    proposal.update({
        "course_id": request.course_id,
        "crop_sha256": binding["crop_sha256"],
        "model_version": result.model_version,
        "proposal_sha256": "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    })
    return proposal
