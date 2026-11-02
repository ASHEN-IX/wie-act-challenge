"""Versioned canonical learning document shared by ingestion and the reader.

The original artifact remains the authority. This model preserves complete
lesson prose and typed structure without claiming to repair extraction. Stable
identifiers are derived from content, not list position, so a repeated parse
and an instructor edit retain the same source identity.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, Iterable, List


CANONICAL_DOCUMENT_VERSION = "1.0.0"


def stable_id(prefix: str, *parts: object) -> str:
    raw = "\x1f".join(str(part) for part in parts)
    return f"{prefix}_{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:20]}"


def source_block(subtopic: Dict[str, Any]) -> Dict[str, Any]:
    spans = subtopic.get("source_spans") or []
    subtopic_id = str(subtopic.get("id") or "")
    document_id = str(spans[0].get("documentId") if spans else "")
    return {
        "id": stable_id("blk", subtopic_id, "source", document_id),
        "type": "source_lesson",
        "text": str(subtopic.get("full_content") or ""),
        "evidence": spans,
        "provenance": "extracted",
        "verification": "source_backed",
    }


def objective_blocks(subtopic: Dict[str, Any]) -> List[Dict[str, Any]]:
    subtopic_id = str(subtopic.get("id") or "")
    blocks: List[Dict[str, Any]] = []
    for objective in subtopic.get("learning_objectives") or []:
        text = str(objective.get("statement") or objective.get("text") or "").strip()
        if not text:
            continue
        blocks.append(
            {
                "id": stable_id("blk", subtopic_id, "objective", text),
                "type": "callout",
                "kind": "note",
                "title": "Learning objective",
                "text": text,
                "evidence": [],
                "provenance": str(objective.get("provenance") or "ai_generated"),
                "verification": "generated_review_required",
            }
        )
    return blocks


def build_canonical_document(
    course_id: str, course_title: str, topics: Iterable[Any]
) -> Dict[str, Any]:
    """Build an additive document. It does not alter or delete source spans."""
    chapters = []
    for topic_index, topic in enumerate(topics, 1):
        if hasattr(topic, "model_dump"):
            topic = topic.model_dump(mode="json")
        topic_id = str(topic.get("id") or stable_id("chapter", topic.get("title", topic_index)))
        lessons = []
        for lesson in topic.get("subtopics") or []:
            if hasattr(lesson, "model_dump"):
                lesson = lesson.model_dump(mode="json")
            lesson_id = str(lesson.get("id") or stable_id("lesson", lesson.get("title", "")))
            structured = [
                block
                for block in lesson.get("structured_blocks") or []
                if isinstance(block, dict) and block.get("type") in {
                    "heading", "code", "math", "table", "media"
                }
            ]
            lessons.append(
                {
                    "id": lesson_id,
                    "title": str(lesson.get("title") or "Untitled lesson"),
                    "summary": str(lesson.get("summary") or ""),
                    "source_spans": list(lesson.get("source_spans") or []),
                    "blocks": [
                        source_block(lesson),
                        *structured,
                        *objective_blocks(lesson),
                    ],
                }
            )
        chapters.append(
            {
                "id": topic_id,
                "title": str(topic.get("title") or f"Chapter {topic_index}"),
                "lessons": lessons,
            }
        )
    return {
        "schemaVersion": CANONICAL_DOCUMENT_VERSION,
        "courseId": course_id,
        "title": course_title,
        "chapters": chapters,
        "provenance": {"content": "extracted", "structure": "deterministic"},
        "verification": "source_text_unverified",
    }


def retrieval_units(document: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Deterministically derive searchable units from canonical block text.

    Source lessons stay whole where possible; remaining blocks are packed by
    paragraph boundaries. Every unit points to the canonical blocks it covers.
    """
    units: List[Dict[str, Any]] = []
    for chapter in document.get("chapters", []):
        for lesson in chapter.get("lessons", []):
            source = next(
                (
                    b
                    for b in lesson.get("blocks", [])
                    if b.get("type") == "source_lesson"
                ),
                None,
            )
            if not source or not str(source.get("text") or "").strip():
                continue
            text = str(source["text"])
            parts = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
            if not parts:
                continue
            # Split only at paragraph boundaries, and only if a single source
            # lesson would exceed the embedding window.
            if len(text) <= 2000:
                groups = [parts]
            else:
                groups = []
                current: List[str] = []
                size = 0
                for part in parts:
                    if current and size + len(part) > 1800:
                        groups.append(current)
                        current, size = [], 0
                    current.append(part)
                    size += len(part) + 2
                if current:
                    groups.append(current)
            spans = source.get("evidence") or []
            for index, group in enumerate(groups, 1):
                units.append(
                    {
                        "id": stable_id("unit", source["id"], index),
                        "text": "\n\n".join(group),
                        "documentIds": sorted({str(s.get("documentId")) for s in spans if s.get("documentId")}),
                        "blockIds": [source["id"]],
                        "chunkIds": sorted({str(s.get("chunkId")) for s in spans if s.get("chunkId")}),
                        "chapterId": chapter["id"],
                        "lessonId": lesson["id"],
                    }
                )
    return units
