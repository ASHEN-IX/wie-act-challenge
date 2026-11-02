"""Untrusted recognition proposals, separate from canonical source content.

This module does not dispatch model requests, persist proposals, or change a
revision. Callers must establish owner authorization and budget before any
remote inference. Syntax checks are deliberately not mathematical validation.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceReference(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)
    document_id: str = Field(pattern=r"^doc_[a-f0-9]{16}$")
    revision_id: str = Field(min_length=1, max_length=128)
    source_sha256: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    region_id: str = Field(pattern=r"^region_[a-f0-9]{20}$")
    page: int = Field(ge=1)
    # Coordinates come only from the trusted extractor, never model output.
    bbox: tuple[float, float, float, float]

    @model_validator(mode="after")
    def valid_box(self):
        import math
        x0, y0, x1, y1 = self.bbox
        if not all(math.isfinite(v) for v in self.bbox) or not (0 <= x0 < x1 and 0 <= y0 < y1):
            raise ValueError("invalid source geometry")
        return self


class ModelResponse(BaseModel):
    """Provider output is data; it may not supply identity or review state."""
    model_config = ConfigDict(extra="forbid", strict=True)
    status: Literal["proposed", "unresolved"]
    representation: Literal["latex", "plain_text"]
    content: str = Field(max_length=8000)
    uncertainty: list[str] = Field(max_length=12)

    @model_validator(mode="after")
    def content_matches_status(self):
        if self.status == "proposed" and not self.content.strip():
            raise ValueError("proposed content must be nonempty")
        if self.status == "unresolved" and self.content:
            raise ValueError("unresolved responses must not contain proposed content")
        if any(not isinstance(item, str) or len(item) > 500 for item in self.uncertainty):
            raise ValueError("invalid uncertainty")
        return self


def _latex_syntax_warnings(text: str) -> list[str]:
    """Conservative diagnostics only; not a complete parser or safety filter."""
    warnings = []
    depth = 0
    escaped = False
    for ch in text:
        if escaped:
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                break
    if depth != 0:
        warnings.append("unbalanced_braces")
    if re.search(r"\\(?:html|href|url|includegraphics|input|write|def|newcommand)\b", text, re.I):
        warnings.append("unsupported_latex_command")
    return warnings


def create_proposal(raw: str, *, source: SourceReference, provider: str, model: str) -> dict:
    """Validate bounded untrusted JSON and attach caller-verified identity.

    Always returns an unreviewed proposal. Warnings do not promote or render it.
    """
    if len(raw.encode("utf-8")) > 32_768:
        raise ValueError("response too large")
    if not provider or len(provider) > 64 or not model or len(model) > 256:
        raise ValueError("invalid provider identity")
    response = ModelResponse.model_validate_json(raw)
    warnings = _latex_syntax_warnings(response.content) if response.representation == "latex" else []
    identity = {
        "source": source.model_dump(mode="json"),
        "provider": provider,
        "model": model,
        "response": response.model_dump(),
    }
    serialized = json.dumps(identity, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return {
        **identity,
        "proposal_sha256": "sha256:" + hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
        "validation": {"syntax_warnings": warnings, "mathematical_correctness": "not_verified"},
        "review_disposition": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
