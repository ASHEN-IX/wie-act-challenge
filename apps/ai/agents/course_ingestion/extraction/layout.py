"""Format-aware document regions with source geometry and review states.

The original file is never modified. Region text and bounding boxes are kept
for downstream canonical blocks, while uncertain regions remain inspectable.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from typing import Any, Dict, Iterable, List, Sequence


LAYOUT_VERSION = "1.1.0"
MIN_MEANINGFUL_CHARS = 3
_HEADING_NUMBER = re.compile(r"^(?:#{1,4}\s+|(?:\d+\.){1,3}\d*\s+)\S")
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


def _region_type(
    text: str, bbox: Sequence[float], declared_type: str = ""
) -> str:
    compact = " ".join(text.split())
    matchable = unicodedata.normalize("NFKC", compact)
    if not compact:
        return "empty"
    if _FIGURE_CAPTION.match(compact):
        return "figure_caption"
    if compact.startswith(("```", "~~~")):
        return "code"
    if declared_type == "math":
        return "math"
    if declared_type == "heading":
        return "heading"
    if declared_type in {"semantic", "definition", "figure_caption"}:
        return declared_type
    if declared_type in {"paragraph", "table", "code"}:
        return declared_type
    if _EDU_LABEL.match(matchable):
        return "definition" if matchable.lower().startswith(("définition", "definition")) else "semantic"
    if (
        _MATH_CUE.search(compact)
        and len(compact) < 800
        and len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]{2,}", compact)) < 8
    ):
        return "math"
    if len(compact) <= 220 and _HEADING_NUMBER.match(compact):
        return "heading"
    if re.fullmatch(r"\|(?:[^|\n]*\|){2,}", compact):
        return "table"
    if any(line.count("\t") >= 2 for line in text.splitlines()):
        return "table"
    return "paragraph"


def regions_from_pages(pages: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert extracted page regions to stable, bounded source records.

    Input regions must carry page number, text and a four-number bbox. Text is
    not normalized here: downstream extraction can report character fidelity
    separately from structural classification.
    """
    regions: List[Dict[str, Any]] = []
    for page_index, page in enumerate(pages, 1):
        page_number = page.get("page_number")
        page_width = float(page.get("width") or 0)
        page_height = float(page.get("height") or 0)
        for index, raw in enumerate(page.get("regions") or [], 1):
            text = str(raw.get("text") or "").strip("\n")
            bbox = raw.get("bbox")
            declared_type = str(raw.get("region_type") or "")
            is_figure = declared_type == "figure"
            if (
                (not text.strip() and not is_figure)
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
            version = page.get("extractionVersion", "1.0")
            identity = f"{page_number if page_number is not None else page_index}\x1f{index}\x1f{x0}\x1f{y0}\x1f{x1}\x1f{y1}\x1f{text}"
            digest = _hash(("v2\x1f" if version == "2.0" else "") + identity)
            kind = declared_type if declared_type in {
                "heading", "paragraph", "semantic", "definition", "math",
                "figure", "figure_caption", "table", "code",
            } else _region_type(text, (x0, y0, x1, y1), declared_type)
            confidence = 1.0
            status = "accepted"
            short_content = len(re.sub(r"\W", "", text)) < MIN_MEANINGFUL_CHARS
            if not is_figure and kind not in {"math", "table", "code"} and short_content:
                kind, status, confidence = "unknown", "review_required", 0.0
            if kind == "table" and short_content:
                # A short numeric or delimiter row is valid table evidence. Keep
                # its type so adjacent rows can be reconstructed, but require a
                # human to confirm cell meaning and row boundaries.
                status, confidence = "review_required", min(confidence, 0.5)
            if kind == "math" and not _MATH_CUE.search(text):
                kind, status, confidence = "unknown", "review_required", 0.0
            if kind == "math":
                # Geometry can identify an equation without verifying its
                # symbol order, scripts or fractions against the source.
                status, confidence = "review_required", min(confidence, 0.5)
            if _suspicion(text):
                status, confidence = "review_required", 0.5
            if raw.get("extraction_method") == "ocr":
                status = "review_required"
                confidence = min(
                    confidence,
                    max(0.0, float(raw.get("ocr_confidence") or 0) / 100),
                )
            if is_figure or raw.get("extraction_method") in ("image", "vector"):
                status = "review_required"
                confidence = 0.0
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
                    "issues": list(dict.fromkeys([*_suspicion(text), *(raw.get("region_issues") or [])])),
                    **({"extractionVersion": "2.0"} if version == "2.0" else {}),
                    "lineCount": int(raw.get("line_count") or 0),
                }
            )
    return _merge_table_fragments(_merge_math_fragments(regions))


def _merge_table_fragments(
    regions: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Join adjacent source rows that form one explicit pipe-delimited table.

    PDF rows arrive as separate text boxes. Merging is limited to two table
    rows with horizontally overlapping geometry and a small vertical gap. A
    paragraph or heading between rows remains a hard boundary, and unrelated
    regions are never absorbed into the table.
    """
    merged: List[Dict[str, Any]] = []
    for region in regions:
        if (
            region.get("type") == "table"
            and merged
            and merged[-1].get("type") == "table"
            and merged[-1].get("page") == region.get("page")
        ):
            previous = merged[-1]
            a, b = previous["bbox"], region["bbox"]
            overlap = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
            row_width = max(1.0, min(a[2] - a[0], b[2] - b[0]))
            vertical = max(0.0, b[1] - a[3])
            if overlap >= min(row_width * 0.5, 18) and vertical <= max(8, min(18, (b[3] - b[1]) * 1.25)):
                previous["bbox"] = [
                    round(min(a[0], b[0]), 2),
                    round(min(a[1], b[1]), 2),
                    round(max(a[2], b[2]), 2),
                    round(max(a[3], b[3]), 2),
                ]
                previous["text"] = (
                    previous["text"].rstrip() + "\n" + region["text"].lstrip()
                )
                previous["reviewRequired"] = bool(
                    previous.get("reviewRequired") or region.get("reviewRequired")
                )
                previous["confidence"] = min(
                    float(previous.get("confidence") or 0),
                    float(region.get("confidence") or 0),
                )
                previous["issues"] = list(
                    dict.fromkeys(
                        [*previous.get("issues", []), *region.get("issues", [])]
                    )
                )
                previous["lineCount"] = int(previous.get("lineCount") or 0) + int(
                    region.get("lineCount") or 0
                )
                continue
        merged.append(region)
    return merged


def _merge_math_fragments(
    regions: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Join adjacent glyph clusters that form one source equation.

    The merge is restricted to math regions whose source geometry overlaps or
    whose vertical distance is tiny. It cannot pull a prose paragraph into a
    formula; formula recognition remains explicitly plain-text and unverified.
    If PDF object order places a limit after one short prose line, the limit is
    returned to the equation envelope but the prose stays in reading order.
    """
    merged: List[Dict[str, Any]] = []
    for region in regions:
        if (
            region.get("type") == "math"
            and merged
            and merged[-1].get("type") == "math"
            and merged[-1].get("page") == region.get("page")
        ):
            previous = merged[-1]
            a, b = previous["bbox"], region["bbox"]
            width = max(1.0, max(a[2], b[2]) - min(a[0], b[0]))
            overlap = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
            vertical = max(0.0, max(a[1], b[1]) - min(a[3], b[3]))
            if vertical <= 5 and overlap >= min(width * 0.18, 18):
                previous["bbox"] = [
                    round(min(a[0], b[0]), 2),
                    round(min(a[1], b[1]), 2),
                    round(max(a[2], b[2]), 2),
                    round(max(a[3], b[3]), 2),
                ]
                previous["text"] = (
                    previous["text"].rstrip() + "\n" + region["text"].lstrip()
                )
                continue
        merged.append(region)
    # Inline code should not be split into three visible regions by delimiter
    # rows. Keep the delimiters and the source code together for the existing
    # Markdown block parser.
    code_merged: List[Dict[str, Any]] = []
    inside_fence = False
    for region in merged:
        if inside_fence and code_merged[-1].get("page") != region.get("page"):
            inside_fence = False
        is_fence = region.get("type") == "code" and region.get("text", "").strip().startswith(("```", "~~~"))
        if is_fence and not inside_fence:
            code_merged.append(region)
            inside_fence = True
            continue
        if inside_fence and code_merged:
            previous = code_merged[-1]
            previous["text"] = previous["text"].rstrip("\r\n") + "\n" + region["text"]
            previous["bbox"] = [
                round(min(previous["bbox"][0], region["bbox"][0]), 2),
                round(min(previous["bbox"][1], region["bbox"][1]), 2),
                round(max(previous["bbox"][2], region["bbox"][2]), 2),
                round(max(previous["bbox"][3], region["bbox"][3]), 2),
            ]
            if is_fence:
                inside_fence = False
            continue
        code_merged.append(region)
    merged = code_merged
    return merged


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


def region_quality(regions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Bounded quality states stored with a canonical document.

    A manifest checksum does not establish that every glyph and equation was
    read correctly. Fidelity remains explicitly unverified even when every
    region has valid source geometry.
    """
    summary = quality_summary(regions)
    return {
        "schemaVersion": "1.0.0",
        "sourceIntegrity": summary["sourceIntegrity"],
        "extractionCompleteness": summary["extractionCompleteness"],
        "structuralValidity": summary["structuralValidity"],
        "semanticFidelity": summary["semanticFidelity"],
        "humanReview": summary["humanReview"],
        "publicationState": "review_required" if summary["reviewRegionIds"] else "ready_for_instructor_review",
        "reviewRegionIds": summary["reviewRegionIds"],
        "counts": summary["counts"],
    }
