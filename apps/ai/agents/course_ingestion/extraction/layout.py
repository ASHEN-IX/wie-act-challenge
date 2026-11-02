"""Format-aware document regions with source geometry and review states.

The original file is never modified. Region text and bounding boxes are kept
for downstream canonical blocks, while uncertain regions remain inspectable.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Any, Dict, Iterable, List, Sequence


LAYOUT_VERSION = "1.0.0"
MIN_MEANINGFUL_CHARS = 3
_HEADING_NUMBER = re.compile(r"^(?:#{1,4}\s+|(?:\d+\.){1,3}\d*\s+)")
_EDU_LABEL = re.compile(
    r"^(?:Définition|Definition|Théorème|Theoreme|Theorem|Proposition|Lemme|Lemma|Corollaire|Corollary|Preuve|Proof|Exemple|Example|Exercice|Exercise|Solution|Remarque|Remark)\b",
    re.IGNORECASE,
)
_FIGURE_CAPTION = re.compile(r"^(?:Figure|Fig\.|Tableau|Table)\s+\d+", re.IGNORECASE)
_SUSPICIOUS = re.compile(r"[\uf8ff\ue000-\uf8fe]|(?:\S*[´ˆ¸`]\S*)|\bX\s*$")
_MATH_CUE = re.compile(r"[=<>∑∏∫√±≤≥∈∀∃⇒⇐→↦∂∞]|\b(?:lim|exp|log|sin|cos|tan)\b")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:20]


def _suspicion(text: str) -> List[str]:
    reasons: List[str] = []
    if re.search(r"[\ue000-\uf8fe]", text):
        reasons.append("private_use_glyph")
    if re.search(r"[´ˆ¸`]", text):
        reasons.append("possible_encoding_artifact")
    if re.search(r"\b[89X]\b", text) and not _MATH_CUE.search(text):
        reasons.append("ambiguous_symbol")
    return reasons


def _region_type(text: str, bbox: Sequence[float], page_height: float) -> str:
    compact = " ".join(text.split())
    if not compact:
        return "empty"
    if _FIGURE_CAPTION.match(compact):
        return "figure_caption"
    if _EDU_LABEL.match(compact):
        return "definition" if compact.lower().startswith(("définition", "definition")) else "semantic"
    if len(compact) <= 220 and (_HEADING_NUMBER.match(compact) or (bbox[3] - bbox[1]) >= 15 and len(compact.split()) <= 16):
        return "heading"
    if compact.startswith("```"):
        return "code"
    if compact.count("|") >= 2 and compact.count("\n") >= 1:
        return "table"
    if any(line.count("\t") >= 2 for line in text.splitlines()):
        return "table"
    if _MATH_CUE.search(compact) and len(compact) < 800:
        return "math"
    return "paragraph"


def regions_from_pages(pages: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert extracted page regions to stable, bounded source records.

    Input regions must carry page number, text and a four-number bbox. Text is
    not normalized here: downstream extraction can report character fidelity
    separately from structural classification.
    """
    regions: List[Dict[str, Any]] = []
    for page in pages:
        page_number = page.get("page_number")
        page_width = float(page.get("width") or 0)
        page_height = float(page.get("height") or 0)
        for index, raw in enumerate(page.get("regions") or [], 1):
            text = str(raw.get("text") or "").strip("\n")
            bbox = raw.get("bbox")
            if (
                not text.strip()
                or not isinstance(bbox, (list, tuple))
                or len(bbox) != 4
                or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in bbox)
            ):
                continue
            x0, y0, x1, y1 = [round(float(v), 2) for v in bbox]
            if x1 <= x0 or y1 <= y0 or x0 < -1 or y0 < -1:
                continue
            if page_width and x1 > page_width + 2:
                continue
            if page_height and y1 > page_height + 2:
                continue
            digest = _hash(f"{page_number}\x1f{index}\x1f{x0}\x1f{y0}\x1f{x1}\x1f{y1}\x1f{text}")
            kind = _region_type(text, (x0, y0, x1, y1), page_height)
            confidence = 1.0
            status = "accepted"
            if kind == "empty" or len(re.sub(r"\W", "", text)) < MIN_MEANINGFUL_CHARS:
                kind, status, confidence = "unknown", "review_required", 0.0
            elif _suspicion(text):
                status, confidence = "review_required", 0.5
            if raw.get("extraction_method") == "ocr":
                status = "review_required"
                confidence = min(
                    confidence,
                    max(0.0, float(raw.get("ocr_confidence") or 0) / 100),
                )
            regions.append(
                {
                    "id": "region_" + digest,
                    "page": page_number,
                    "bbox": [x0, y0, x1, y1],
                    "readingOrder": index,
                    "type": kind,
                    "text": text[:20_000],
                    "extractionMethod": raw.get("extraction_method", "text"),
                    "confidence": round(confidence, 3),
                    "reviewRequired": status == "review_required",
                    "issues": _suspicion(text),
                }
            )
    return regions


def quality_summary(regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Four independent gates; none implies source-text correctness."""
    rows = list(regions)
    review = [row["id"] for row in rows if row.get("reviewRequired")]
    return {
        "sourceIntegrity": "verified" if rows else "unavailable",
        "extractionCompleteness": "partial" if review else "complete",
        "structuralValidity": "valid" if rows and all(row.get("bbox") for row in rows) else "invalid",
        "semanticFidelity": "review_required" if review else "deterministic_unverified",
        "humanReview": "required" if review else "not_requested",
        "reviewRegionIds": review[:500],
        "counts": {
            "regions": len(rows),
            "reviewRequired": len(review),
            "types": {name: sum(1 for row in rows if row.get("type") == name) for name in sorted({str(row.get("type")) for row in rows})},
        },
    }
