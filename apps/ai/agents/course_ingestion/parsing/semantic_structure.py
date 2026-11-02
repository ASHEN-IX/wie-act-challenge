"""Deterministic, source-backed structures for course ingestion.

Only Markdown-like structures with an unambiguous boundary are extracted.
Each item retains the verified chunk, page and one-based line range. No model
is asked to infer a source location, and malformed tables stay as text.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Tuple


_IMAGE = re.compile(r"^!\[([^\]]{0,500})\]\(([^)\s]{1,2048})\)$")
_MEDIA_SUFFIX = re.compile(
    r"\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm)(?:[?#].*)?$", re.I
)
_MAPPING_MARKER = re.compile(
    r"^\[\[ednova:topic=[^\]/\s]{1,96}(?:/subtopic=[^\]\s]{1,96})?\]\]$"
)
_CHAPTER_NUMBER = re.compile(r"^(?:Chapitre|CHAPITRE|Chapter|CHAPTER)\s+([0-9IVXLC]+)\b")
# A chapter can wrap over two short extracted lines. Prefer a complete title
# over an ambiguous preface, while retaining a genuinely short preface.
_CHAPTER_TITLE_MAX_LINES = 2
_SECTION_NUMBER = re.compile(r"^\d+(?:\.\d+){0,2}$")


def _source_section_title(title: str) -> bool:
    """Whether a parser title is an explicit source section, not a fragment."""
    return bool(re.match(r"^#{1,6}\s+\S", title.strip()) or _SECTION_NUMBER.match(title.split()[0] if title.split() else ""))


def _running_header(line: str) -> bool:
    """Recognize a repeated PDF running head without hiding document titles."""
    # Current PDF extractors commonly put the page number on its own line, so
    # relying only on a trailing number misses every running head. The chapter
    # marker plus a title or page marker is sufficient here; a standalone
    # chapter heading is handled earlier as a real boundary.
    match = _CHAPTER_NUMBER.match(line)
    if not match:
        return False
    tail = line[match.end() :].strip(" .-–—:")
    # Running heads from TeX PDFs are all caps; a document chapter title keeps
    # its prose casing. Page numbers are frequently a separate extracted line.
    return bool(
        re.search(r"\d{1,4}$", tail)
        or (tail and any(letter.isalpha() for letter in tail) and not any(letter.islower() for letter in tail))
    )


def _numbered_section(line: str, allow_top_level: bool = False) -> bool:
    """Recognize section prose, excluding equations and numbered exercises."""
    match = re.match(r"^(\d+)\.(\d+)(?:\.(\d+))?(?:\s+(.+))?$", line)
    top = re.match(r"^(\d+)\s+(.+)$", line) if allow_top_level else None
    if top:
        value = top.group(2).strip()
    elif not match or re.match(r"^\d+\.\d+\.\d+\.\d+", line):
        return False
    else:
        value = (match.group(4) or "").strip()
    if not value:
        return True
    if value.endswith((".", ",", ";", ":")):
        return False
    # Exercise and equation output often starts with variable symbols or is a
    # short label. A course section has ordinary prose in its title.
    if len(value) < 3 or len(value.split()) > 18:
        return False
    if re.search(r"[=+×÷<>∑∏∂ΣΠ∫∈⇒⇔]", value):
        return False
    return sum(ch.isalpha() for ch in value) >= 3


def _leading_section_number(line: str) -> str:
    match = re.match(r"^(\d+(?:\.\d+){0,2})(?:\s+|$)", line)
    return match.group(1) if match else ""


def _cells(line: str) -> List[str] | None:
    value = line.strip()
    if "|" not in value:
        return None
    cells = [cell.strip() for cell in value.strip("|").split("|")]
    if len(cells) < 2 or all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
        return None
    return cells


def _table_divider(line: str) -> bool:
    return bool(
        re.fullmatch(r"\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?", line.strip())
    )


def extract_blocks(text: str) -> List[Dict]:
    """Return typed blocks with exact line spans.

    This is intentionally conservative. It extracts headings, fenced code,
    standalone formulas, tables and source media references. Lists and prose
    are handled by the reading projection, so ingestion does not duplicate
    content it cannot validate yet.
    """
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: List[Dict] = []
    code: Dict | None = None
    index = 0
    while index < len(lines):
        raw = lines[index].rstrip()
        stripped = raw.strip()
        line = index + 1
        if code is not None:
            if stripped.startswith("```"):
                value = "\n".join(code.pop("lines")).strip()[:20000]
                if value:
                    code.update({"type": "code", "code": value, "lineEnd": line})
                    blocks.append(code)
                code = None
            else:
                code["lines"].append(raw)
            index += 1
            continue
        fence = re.match(r"^```([\w+#.-]{0,24})$", stripped)
        if fence:
            code = {
                "type": "code",
                "language": fence.group(1) or "text",
                "lines": [],
                "lineStart": line,
            }
            index += 1
            continue
        heading = re.match(r"^(#{1,6})\s+(.+)$", raw)
        if heading:
            blocks.append(
                {
                    "type": "heading",
                    "level": min(4, len(heading.group(1))),
                    "text": heading.group(2).strip()[:500],
                    "lineStart": line,
                    "lineEnd": line,
                }
            )
            index += 1
            continue
        formula = re.fullmatch(r"\$\$\s*([^$\n]{1,600})\s*\$\$", stripped)
        if formula:
            blocks.append(
                {
                    "type": "math",
                    "expression": formula.group(1).strip(),
                    "notation": "latex",
                    "lineStart": line,
                    "lineEnd": line,
                }
            )
            index += 1
            continue
        columns = _cells(raw)
        divider = (
            _table_divider(lines[index + 1]) if index + 1 < len(lines) else False
        )
        if columns and divider:
            # start is a zero-based row cursor; the reported lineStart is
            # converted from that same cursor so no off-by-one enters evidence.
            start = index
            row_index = start + 2
            rows: List[List[str]] = []
            while row_index < len(lines):
                row = _cells(lines[row_index])
                if row is None or all(re.fullmatch(r":?-{3,}:?", c) for c in row):
                    break
                if len(row) != len(columns):
                    break
                rows.append(row)
                row_index += 1
            if rows and all(len(row) == len(columns) for row in rows):
                blocks.append(
                    {
                        "type": "table",
                        "caption": "Table from source",
                        "columns": columns[:20],
                        "rows": rows[:100],
                        "lineStart": start + 1,
                        "lineEnd": row_index,
                    }
                )
                index = row_index
                continue
        media = _IMAGE.fullmatch(stripped)
        if (
            media
            and _MEDIA_SUFFIX.search(media.group(2))
            and not re.match(r"^(?:https?:)?//|^data:", media.group(2), re.I)
        ):
            blocks.append(
                {
                    "type": "media",
                    "mediaType": "image",
                    "sourceRef": media.group(2),
                    "alt": media.group(1) or "Source image",
                    "lineStart": line,
                    "lineEnd": line,
                }
            )
        index += 1
    if code is not None:
        value = "\n".join(code.pop("lines")).strip()[:20000]
        if value:
            code.update(
                {"type": "code", "code": value, "lineEnd": len(lines), "unterminated": True}
            )
            blocks.append(code)
    return blocks


def detect_sections_with_sources(
    passages: Iterable[Tuple[str, Dict]],
) -> List[Dict]:
    """Detect section headings without discarding chunk provenance.

    Input is (text, metadata) for each byte-verified passage. Headings use the
    same conservative rules as the legacy parser, while each content line keeps
    its originating chunk and page. The returned subtopics therefore have exact
    source spans rather than page-relative ``section_N`` guesses.
    """
    materialised = list(passages)
    sections: List[Dict] = []
    current = {
        "title": "",
        "chapter": "",
        "content": [],
        "source_spans": [],
        "blocks": [],
        "_chapter_preface": [],
    }

    def new_section(title: str = "", chapter: str = "") -> Dict:
        return {
            "title": title,
            "chapter": chapter,
            "content": [],
            "source_spans": [],
            "blocks": [],
            "_chapter_preface": [],
        }

    def append_current():
        if current["title"] or current["content"] or current.get("_section_number"):
            preface_words = len(" ".join(current["content"]).split())
            if current.get("_chapter_preface") and preface_words < 12:
                return
            sections.append(
                {
                    **current,
                    "title": current["title"]
                    or current.get("_section_number", "")
                    or "Course material",
                    "content": list(current["content"]),
                    "source_spans": list(current["source_spans"]),
                    "blocks": list(current["blocks"]),
                }
            )

    chapter = ""
    pending_chapter_title: List[str] | None = None

    def finish_chapter_title() -> None:
        nonlocal chapter, pending_chapter_title
        if pending_chapter_title:
            chapter = chapter.split(":", 1)[0] + ": " + " ".join(
                pending_chapter_title
            )
        pending_chapter_title = None

    for text, meta in materialised:
        lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        for offset, raw in enumerate(lines):
            line = raw.strip()
            if not line:
                continue
            # PDF mathematical glyphs may decode to a leading hash. Only
            # treat Markdown syntax as structural when the layout extractor
            # agrees, or when no region classification is available (TXT/MD).
            region_type = meta.get("region_type")
            markdown = (
                re.match(r"^(#{1,6})\s+\S", line)
                if not region_type or region_type == "heading"
                else None
            )
            chapter_heading = re.match(
                r"^(?:Chapitre|CHAPITRE|Chapter|CHAPTER)\s+([0-9IVXLC]+)(?:\s*[-–—:.])?\s*(.*)$",
                line,
            )
            numbered_heading = _numbered_section(line, allow_top_level=region_type == "heading") and (
                not region_type or region_type == "heading"
            )
            if pending_chapter_title is not None:
                # A wrapped title ends at the next structural marker. Page
                # numbers and repeated running heads never become its title.
                if re.fullmatch(r"\d+", line) or _running_header(line):
                    continue
                if markdown or chapter_heading or numbered_heading:
                    finish_chapter_title()
                else:
                    pending_chapter_title.append(line)
                    if len(pending_chapter_title) >= _CHAPTER_TITLE_MAX_LINES:
                        finish_chapter_title()
                    continue
            # PDF text extraction can put a section number on its own line.
            # The following line is its title, not the first paragraph.
            if (
                re.fullmatch(
                    r"\d+\.\d+(?:\.\d+)?",
                    current.get("_section_number", ""),
                )
                and not current["title"]
                and not current["content"]
            ):
                current["title"] = f"{current['_section_number']} {line}"
                continue
            if _MAPPING_MARKER.fullmatch(line):
                # A source declaration is metadata for the verified passage,
                # never a heading or visible line of section content.
                continue
            if (
                re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", line)
                or re.fullmatch(r"\d+", line)
                or _running_header(line)
            ):
                continue
            if markdown:
                append_current()
                current = new_section(line, chapter)
                continue
            if chapter_heading:
                number, title = chapter_heading.groups()
                title = title.strip()
                if _running_header(line):
                    continue
                append_current()
                current = new_section("", "")
                current["_chapter_preface"] = [line]
                chapter = f"Chapter {number}" + (f": {title}" if title else "")
                if not title:
                    pending_chapter_title = []
                continue
            if numbered_heading and not current["title"]:
                append_current()
                current = new_section("", chapter)
                current["_section_number"] = _leading_section_number(line)
                value = line[len(current["_section_number"]) :].strip() if current["_section_number"] else ""
                if value:
                    current["title"] = f"{current['_section_number']} {value.strip()}"
                continue
            if numbered_heading and current["title"]:
                # A numbered title is a real boundary only when it follows text
                # from the previous lesson. Exercise lines are short and end in
                # punctuation, while running captions and equations never define
                # a curriculum unit.
                append_current()
                value = line[len(_leading_section_number(line)) :].strip() if _leading_section_number(line) else line
                current = new_section("", chapter)
                current["_section_number"] = _leading_section_number(line)
                if value:
                    current["title"] = f"{current['_section_number']} {value.strip()}"
                continue
            current["content"].append(line)
            current["source_spans"].append(
                {
                    "chunkId": meta["chunk_id"],
                    "documentId": meta["document_id"],
                    "pageNumber": meta.get("page_number"),
                    "lineStart": offset + 1,
                    "lineEnd": offset + 1,
                    **(
                        {
                            "regionId": meta["region_id"],
                            "bbox": meta["bbox"],
                            "regionType": meta["region_type"],
                            "extractionMethod": meta.get("extraction_method"),
                        }
                        if meta.get("region_id") and meta.get("bbox")
                        else {}
                    ),
                }
            )
    append_current()
    finish_chapter_title()

    # Attach every extracted region to the section that owns its exact
    # source line. This keeps page geometry and review state on the canonical
    # source block rather than synthesizing it later from chunk offsets.
    passages_by_region = {
        (meta["document_id"], meta.get("region_id")): (text, meta)
        for text, meta in materialised
        if meta.get("region_id")
    }
    for section in sections:
        known_regions = set()
        section["source_regions"] = []
        for span in section["source_spans"]:
            region_id = span.get("regionId")
            passage = passages_by_region.get((span["documentId"], region_id))
            if not region_id or not passage or region_id in known_regions:
                continue
            text, meta = passage
            known_regions.add(region_id)
            section["source_regions"].append(
                {
                    "id": region_id,
                    "page": meta.get("page_number"),
                    "bbox": span.get("bbox"),
                    "type": span.get("regionType"),
                    "text": text,
                    "extractionMethod": span.get("extractionMethod"),
                    "chunkId": meta["chunk_id"],
                    "documentId": meta["document_id"],
                    "readingOrder": meta.get("reading_order"),
                    "confidence": meta.get("region_confidence"),
                    "reviewRequired": meta.get("review_required", False),
                    "issues": meta.get("region_issues", []),
                }
            )

    # Empty-text figures are not searchable passages. Attach them to a nearby
    # caption (or nearest source region), rather than the first lesson on a page.
    media_items = {}
    for _, meta in materialised:
        for media in meta.get("source_media_regions") or []:
            media_items[(meta["document_id"], media["id"])] = media
    for (document_id, region_id), media in media_items.items():
        candidates = [(section, r) for section in sections for r in section["source_regions"]
                      if r.get("documentId") == document_id and r.get("page") == media.get("page") and r.get("bbox")]
        if not candidates:
            continue
        captions = [(section,r) for section,r in candidates if r.get("type") == "figure_caption"
                    and min(abs(r["bbox"][1]-media["bbox"][3]), abs(media["bbox"][1]-r["bbox"][3])) <= 100]
        section, anchor = min(captions or candidates, key=lambda item: abs((item[1]["bbox"][1]+item[1]["bbox"][3])-(media["bbox"][1]+media["bbox"][3])))
        section["source_regions"].append({**media, "chunkId":anchor["chunkId"], "documentId":document_id})
    document_order = {meta["document_id"]:i for i,(_,meta) in enumerate(materialised)}
    for section in sections:
        section["source_regions"].sort(key=lambda r: (document_order.get(r.get("documentId"),0), r.get("page") or 0,
            (r.get("bbox") or [0,0])[1], (r.get("bbox") or [0])[0]))

    # Extract each chunk as a whole so fenced code and tables cannot lose their
    # internal boundaries. A block is attached only when every source line it
    # occupies belongs to one detected section.
    for text, meta in materialised:
        candidates = extract_blocks(text)
        for section in sections:
            owned = {
                (span["chunkId"], span["lineStart"])
                for span in section["source_spans"]
            }
            for block in candidates:
                required = {
                    (meta["chunk_id"], line)
                    for line in range(block["lineStart"], block["lineEnd"] + 1)
                }
                if not required.issubset(owned):
                    continue
                section["blocks"].append(
                    {
                        **{k: v for k, v in block.items() if k not in {"lineStart", "lineEnd"}},
                        "chunkId": meta["chunk_id"],
                        "documentId": meta["document_id"],
                        "pageNumber": meta.get("page_number"),
                        "lineStart": block["lineStart"],
                        "lineEnd": block["lineEnd"],
                    }
                )
    return sections
