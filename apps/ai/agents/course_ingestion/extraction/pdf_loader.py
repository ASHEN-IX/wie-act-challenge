"""Bounded PDF extraction in a fresh, resource-limited Python process.

Untrusted PDF parsing and page extraction run only in the child. Starting a
fresh interpreter avoids inheriting the large address space of an AI worker.
"""

import json
import math
import re
import os
import subprocess
import sys
import unicodedata


class PdfValidationError(Exception):
    """Base error for PDF extraction failures in the ingestion pipeline."""


class EncryptedPdfError(PdfValidationError):
    """A password-protected PDF is not supported."""


class PdfParseTimeoutError(PdfValidationError):
    """Parsing exceeded the wall-clock sandbox timeout."""


class PdfParseLimitError(PdfValidationError):
    """Parsing exceeded a sandbox CPU, memory or output limit."""


MAX_PAGES = 2000
MAX_TEXT_BYTES = 8 * 1024 * 1024

# TeX Type 1 fonts commonly encode an accent as a separate, slightly
# overlapping glyph. Compose it only when the glyphs share a visual line and
# overlap at the baseline; a global accent replacement would damage code and
# mathematical primes.
_COMBINING_ACCENTS = {
    "´": "\u0301",
    "`": "\u0300",
    "ˆ": "\u0302",
    "¸": "\u0327",
    "¨": "\u0308",
    "~": "\u0303",
}
_MATH_FONTS = re.compile(r"(?:CM(?:MI|SY|EX|MS|BSY|EUF)|STIX|Math|CambriaMath|Asana|LatinModernMath)", re.I)
_SENTENCE_END = re.compile(r"[.!?;:]$|(?:[.!?;:]\s*[)'\"”’]*)$")
_SYMBOL_CUE = re.compile(r"[=<>∑∏∫√±≤≥∈∀∃⇒⇐→↦∂∞]")
_SEMANTIC_LABEL = re.compile(
    r"^(?:Définition|Definition|Théorème|Theoreme|Theorem|"
    r"Proposition|Lemme|Lemma|Corollaire|Corollary|Preuve|Proof|Exemple|Example|"
    r"Exercice|Exercise|Solution|Remarque|Remark)\b",
    re.I,
)


def _apply_resource_limits(max_memory_mb: int, max_cpu_s: int) -> None:
    """Constrain the fresh child before importing or invoking the PDF parser."""
    try:
        import resource
    except ImportError:
        return
    mem_bytes = max_memory_mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    resource.setrlimit(resource.RLIMIT_CPU, (max_cpu_s, max_cpu_s))


def _ensure_app_import_path() -> None:
    """Normalize imports for -I while preserving the existing package root.

    Python's isolated mode drops the script directory before the sandbox helper
    imports sibling extraction modules. The child command has already pinned
    both the parser path and app root, so prepend that containing app directory.
    """
    app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    if app_root not in sys.path:
        sys.path.insert(0, app_root)


def _pdf_glyph_names(document):
    """Map damaged ToUnicode glyphs back to their declared font identities."""
    import re

    from agents.course_ingestion.extraction.pdf_glyph_names import glyph_unicode

    mapping = {}
    for page in document:
        for font in page.get_fonts(full=True):
            xref = int(font[0])
            if xref in mapping:
                continue
            try:
                definition = document.xref_object(xref)
            except Exception:
                continue
            if "/ToUnicode" not in definition or "/Differences" not in definition:
                continue
            match = re.search(r"/Differences\s*\[(.*?)\]", definition, re.S)
            if not match:
                continue
            code = None
            row = {}
            for token in match.group(1).split():
                if token.isdigit():
                    code = int(token)
                elif token.startswith("/") and code is not None:
                    value = glyph_unicode(token[1:])
                    if value:
                        row[code] = value
                    code += 1
            if row:
                mapping[xref] = row
    return mapping


def _repair_font_glyphs(document, mapping):
    """Rewrite only derived in-memory CMaps; the original file is untouched."""
    import re

    for xref, chars in mapping.items():
        definition = document.xref_object(xref)
        target = re.search(r"/ToUnicode\s+(\d+)", definition)
        if not target:
            continue
        lines = [
            "/CIDInit /ProcSet findresource begin",
            "12 dict begin",
            "begincmap",
            "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
            "/CMapName /Adobe-Identity-UCS def",
            "/CMapType 2 def",
            "1 begincodespacerange",
            "<00><FF>",
            "endcodespacerange",
            f"{len(chars)} beginbfchar",
            *[f"<{code:02X}><{ord(value):04X}>" for code, value in sorted(chars.items())],
            "endbfchar",
            "endcmap",
            "CMapName currentdict /CMap defineresource pop",
            "end",
            "end",
        ]
        document.update_stream(
            int(target.group(1)), "\n".join(lines).encode()
        )


def _union(boxes):
    return [
        round(min(box[0] for box in boxes), 2),
        round(min(box[1] for box in boxes), 2),
        round(max(box[2] for box in boxes), 2),
        round(max(box[3] for box in boxes), 2),
    ]


def _compose_line(line):
    """Compose accents from overlapping char boxes, not character labels."""
    spans = line.get("spans") or []
    chars = []
    for span in spans:
        font = str(span.get("font") or "")
        for entry in span.get("chars") or []:
            chars.append({"c": str(entry.get("c") or ""), "bbox": list(entry.get("bbox") or span.get("bbox") or [0, 0, 0, 0]), "font": font})
    output = []
    index = 0
    while index < len(chars):
        current = chars[index]
        code = current["c"]
        if code in _COMBINING_ACCENTS:
            target = next((n for n in range(index + 1, min(index + 3, len(chars))) if chars[n]["c"].strip()), None)
            if target is not None and chars[target]["c"].isalpha() and abs(chars[target]["bbox"][0] - current["bbox"][0]) < 6:
                target_char = chars[target]
                output.append(unicodedata.normalize("NFC", target_char["c"] + _COMBINING_ACCENTS[code]))
                index = target + 1
                continue
        output.append(code)
        index += 1
    return "".join(output)


def _text_lines(page):
    """Return visual lines with geometry and font provenance.

    PyMuPDF's block segmentation does not represent LaTeX's split numerator,
    denominator and script boxes. Reading the lines independently prevents
    unrelated prose from being merged, while a later grouping step can retain
    a formula as one region.
    """
    result = []
    for block in page.get_text("rawdict", sort=True).get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines") or []:
            bbox = [float(value) for value in line.get("bbox") or []]
            if len(bbox) != 4:
                continue
            text = _compose_line(line).strip()
            if not text:
                continue
            spans = line.get("spans") or []
            font = max(
                spans,
                key=lambda span: len(str(span.get("text") or "")),
                default={"font": "", "size": 0},
            )
            result.append(
                {
                    "text": text,
                    "source_text": _compose_line(line).rstrip("\r\n"),
                    "bbox": [round(value, 2) for value in bbox],
                    "font": str(font.get("font") or ""),
                    "size": round(float(font.get("size") or 0), 2),
                    "math": bool(_MATH_FONTS.search(str(font.get("font") or ""))),
                }
            )
    return result


def _line_kind(line, left, right):
    """Classify only visible evidence, never a bare digit or symbol.

    A large glyph box is common for superscripts and equation delimiters. Font
    height alone cannot distinguish those from a section title, so headings
    require a bold font, a numbered section pattern, or a short semantic label.
    """
    text = line["text"]
    compact = " ".join(text.split())
    matchable = _normalise_label(compact)
    font = str(line.get("font") or "")
    bold = bool(re.search(r"(?:cmbx|bold|semibold|black|demi)", font, re.I))
    if _SEMANTIC_LABEL.match(matchable):
        return "semantic"
    if re.match(r"^(?:Figure|Fig\.|Tableau|Table)\s+\d+", compact, re.I):
        return "figure_caption"
    words = len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]{2,}", compact))
    cues = len(_SYMBOL_CUE.findall(compact))
    line_word_count = len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]{2,}", line["text"]))
    # Numbered exercises are prose even when their wording contains a symbol.
    exercise_item = bool(re.match(r"^(?:\d+(?:\.\d+)?(?:\s+bis)?[.)]|[-—•])\s+", compact, re.I))
    # Glyph names are not a reliable equation signal in older TeX fonts: most
    # body glyphs in this document use CMR10/CMMI10 even inside prose. Use the
    # run's horizontal extent and word boundaries only after explicit headings
    # have been considered below.
    numbered_heading = bool(
        re.match(r"^(?:\d+\.){1,3}\d*\s+[A-Za-zÀ-ÖØ-öø-ÿ]", compact)
    )
    if (
        not exercise_item
        and
        numbered_heading
        and len(compact) < 140
        and not _SENTENCE_END.search(compact)
        and words <= 10
    ):
        return "heading"
    # Diagram labels connected by ASCII arrows are ordinary technical text;
    # multiple prose words and a non-math font do not establish an equation.
    if "->" in compact and words >= 2 and not line.get("math") and not re.search(r"[=∑∏∫√≤≥∀∃∈]", compact.replace("->", "")):
        return "paragraph"
    if not exercise_item and words <= 7 and not (bold and len(compact.split()) >= 5) and (
        (cues >= 1 and (words <= 1 or cues >= 2))
        or line.get("math_ratio", 0) >= 0.35
    ):
        return "math"
    if exercise_item:
        return "paragraph"
    if words >= 5 or _SENTENCE_END.search(compact):
        # A wrapped display title is still a title. The merge above requires
        # the same bold font, large size, left alignment and adjacent lines;
        # only that explicit geometry overrides the lexical prose guard.
        if (
            bold
            and float(line.get("size") or 0) >= 16
            and len(line.get("parts") or []) >= 2
            and len(compact) < 140
        ):
            return "heading"
        return "paragraph"
    if (
        len(compact) < 140
        and re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]{3,}", compact)
        and (
            re.match(r"^(?:Chapitre|Chapter|#+)\b", compact, re.I)
            or numbered_heading
            or (bold and len(compact.split()) <= 12 and not compact.endswith((",", ";")))
        )
    ):
        return "heading"
    if compact.startswith("```"):
        return "code"
    return "paragraph"


def _normalise_label(value):
    """Normalise only matching text; source output remains unchanged."""
    value = unicodedata.normalize("NFKC", value)
    return value.replace("ﬁ", "fi").replace("ﬂ", "fl")


def _horizontal_gap(a, b):
    if a[2] < b[0]:
        return b[0] - a[2]
    if b[2] < a[0]:
        return a[0] - b[2]
    return 0.0


def _vertical_gap(a, b):
    return max(a["bbox"][1], b["bbox"][1]) - min(a["bbox"][3], b["bbox"][3])


def _merge_visual_rows(lines):
    """Rejoin word-sized visual spans that share a text baseline.

    PyMuPDF sometimes emits every word in an equation as a separate line. A
    bounded horizontal gap keeps the running header and page number separate.
    """
    rows = []
    for line in sorted(lines, key=lambda item: ((item["bbox"][1] + item["bbox"][3]) / 2, item["bbox"][0])):
        center = (line["bbox"][1] + line["bbox"][3]) / 2
        target = None
        for row in reversed(rows[-4:]):
            row_center = (row["bbox"][1] + row["bbox"][3]) / 2
            same_baseline = abs(center - row_center) <= max(1.8, min(line["size"], 12) * 0.17)
            side_by_side = (
                _horizontal_gap(row["bbox"], line["bbox"]) <= 56
                and (
                    row["bbox"][2] < line["bbox"][0] + 2
                    or line["bbox"][2] < row["bbox"][0] + 2
                )
                and _vertical_gap(row, line) <= 5
            )
            vertical_ok = same_baseline or side_by_side
            if not vertical_ok:
                continue
            if _horizontal_gap(row["bbox"], line["bbox"]) <= 56:
                target = row
                break
        if target is None:
            rows.append({**line, "parts": [line]})
            continue
        target["text"] = (target["text"].rstrip() + " " + line["text"].lstrip()).strip()
        target["bbox"] = _union([target["bbox"], line["bbox"]])
        target["parts"].append(line)
        target["math_ratio"] = sum(part["bbox"][2] - part["bbox"][0] for part in target["parts"] if part["math"]) / max(1, target["bbox"][2] - target["bbox"][0])
        target["math"] = any(part["math"] for part in target["parts"])
    return rows


def _merge_wrapped_titles(rows):
    """Join a display title split across adjacent bold visual lines.

    Large TeX titles can wrap after a full-width first line. The continuation
    has the same font and size, aligns with the title's left edge and sits less
    than one line below it. Requiring all four signals avoids joining distinct
    headings or a running header to a chapter title.
    """
    merged = []
    for row in rows:
        previous = merged[-1] if merged else None
        if previous:
            bold = bool(
                re.search(
                    r"(?:cmbx|bold|semibold|black|demi)",
                    str(row.get("font") or ""),
                    re.I,
                )
            )
            same_title_style = (
                bold
                and row.get("font") == previous.get("font")
                and float(row.get("size") or 0) >= 16
                and abs(float(row.get("size") or 0) - float(previous.get("size") or 0)) <= 0.2
                and _vertical_gap(previous, row) <= 8
                and abs(row["bbox"][0] - previous["bbox"][0]) <= 3
            )
            if same_title_style:
                previous["text"] = previous["text"].rstrip() + " " + row["text"].lstrip()
                previous["bbox"] = _union([previous["bbox"], row["bbox"]])
                previous["parts"].extend(row.get("parts", [row]))
                continue
        merged.append({**row, "parts": list(row.get("parts", [row]))})
    return merged


def _figure_candidates(page, captions=()):
    """Return bounded picture/image frames and reject page decorations."""
    import fitz

    drawings = [drawing for drawing in page.get_drawings() if drawing.get("rect") is not None]
    images = []
    for image in page.get_images(full=True):
        try:
            images.extend(rect for rect in page.get_image_rects(image[0]) if rect.width >= 24 and rect.height >= 24)
        except Exception:
            continue
    candidates = list(images)
    for drawing in drawings:
        rect = drawing.get("rect")
        if (
            rect.width >= 24
            and rect.height >= 24
            and rect.width * rect.height >= 3000
            and (len(drawing.get("items") or []) >= 2 or (any(item[0] == "re" for item in drawing.get("items") or []) and any(min(abs(c[1]-rect.y1), abs(rect.y0-c[3])) <= 60 and min(c[2],rect.x1) > max(c[0],rect.x0) for c in captions)))
            and not (rect.width >= page.rect.width * 0.85 and rect.height >= page.rect.height * 0.75)
        ):
            candidates.append(rect)

    horizontal = [rect for rect in (drawing.get("rect") for drawing in drawings) if rect and rect.width >= 40 and rect.height <= 2]
    vertical = [rect for rect in (drawing.get("rect") for drawing in drawings) if rect and rect.height >= 40 and rect.width <= 2]
    for top in horizontal:
        for bottom in horizontal:
            if bottom.y0 - top.y0 < 40 or abs(bottom.x0 - top.x0) > 3 or abs(bottom.x1 - top.x1) > 3:
                continue
            frame = fitz.Rect(top.x0, top.y0, top.x1, bottom.y0)
            # Four exactly aligned rules form a frame. Wide boxed theorem
            # paragraphs at the page margins are section decoration, not media.
            if frame.width >= page.rect.width * 0.68:
                continue
            left_edge = any(abs(rule.x0 - frame.x0) <= 3 and abs(rule.y0 - frame.y0) <= 3 and abs(rule.y1 - frame.y1) <= 3 for rule in vertical)
            right_edge = any(abs(rule.x0 - frame.x1) <= 3 and abs(rule.y0 - frame.y0) <= 3 and abs(rule.y1 - frame.y1) <= 3 for rule in vertical)
            if left_edge and right_edge:
                candidates.append(frame)
                break
    unique = []
    seen = set()
    for rect in candidates:
        key = tuple(round(value, 1) for value in (rect.x0, rect.y0, rect.x1, rect.y1))
        if key not in seen:
            seen.add(key)
            unique.append(rect)
    return unique, {tuple(round(value, 1) for value in (rect.x0, rect.y0, rect.x1, rect.y1)) for rect in images}


def _append_math_band(regions, candidates):
    if not candidates:
        return
    ordered = sorted(
        candidates,
        key=lambda item: (
            round(((item["bbox"][1] + item["bbox"][3]) / 2) / 4),
            item["bbox"][0],
        ),
    )
    regions.append(
        {
            "text": "\n".join(item["text"] for item in ordered),
            "bbox": _union([item["bbox"] for item in ordered]),
            "kind": "math",
            "lines": ordered,
        }
    )


def _flow_words(line):
    """Count lexical words without treating a formula's variables as prose."""
    return len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]{2,}", line["text"]))


def _prose_line(line, column_width, *, start=False):
    """A geometric prose boundary independent of font encoding.

    Running prose is usually a lexical run wider than 20% of the text column.
    Headings and centred equations can contain several words, so the caller
    classifies those before requesting this boundary check. A sentence ending
    is strongest; five words or 60 characters is the conservative fallback for
    source lines with unusual punctuation.
    """
    text = line["text"].strip()
    words = _flow_words(line)
    width = line["bbox"][2] - line["bbox"][0]
    if words >= 3 and _SENTENCE_END.search(text):
        return True
    return words >= 5 and width >= column_width * 0.20 and len(text) >= 36


def _formula_run(rows, start, left, right):
    """Identify a complete display-equation run before grouping prose.

    Display equations can start with an ordinary text-font phrase such as
    ``somme de la série, et on note``. The formula itself is centred or forms a
    short bracketed run; the following paragraph returns to the text column.
    Two independent prose signals (sentence punctuation or column-wide lexical
    prose) end the equation band. Short lower limit rows remain attached.
    """
    column_width = max(1.0, right - left)
    run = [rows[start]]
    previous = rows[start]
    top = previous["bbox"][1]
    equation_bottom = previous["bbox"][3]
    for candidate in rows[start + 1 : start + 12]:
        if _vertical_gap(previous, candidate) > 9:
            break
        words = _flow_words(candidate)
        width = candidate["bbox"][2] - candidate["bbox"][0]
        centred = candidate["bbox"][0] > left + column_width * 0.12
        lexical_prose = _prose_line(candidate, column_width, start=False)
        # A formula may contain a short explanatory word (``lim``, ``soit``)
        # but full sentences are always source prose.
        sentence_prose = words >= 3 and bool(_SENTENCE_END.search(candidate["text"]))
        if _area_overlap(candidate["bbox"], [left, top, right, equation_bottom]) <= 0:
            if candidate["bbox"][1] > equation_bottom + 2:
                break
        if sentence_prose and not candidate["math"]:
            break
        if lexical_prose and not centred and not candidate["math"]:
            break
        # A full-width prose line after a centred display ends the equation,
        # even when a mathematical word appears inside it.
        if lexical_prose:
            break
        # A sentence is prose unless it is a compact equation and its words
        # are mathematical identifiers rather than sentence vocabulary.
        if (
            words >= 3
            and len(candidate["text"]) > 90
            and not (candidate.get("math_ratio", 0) >= 0.65)
        ):
            break
        run.append(candidate)
        previous = candidate
        equation_bottom = max(equation_bottom, candidate["bbox"][3])
    return run


def _area_overlap(a, b):
    width = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    height = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    return width * height


def _merge_math_fragments(regions):
    """Merge only spatially adjacent equation fragments.

    Superscripts and limits are emitted on a different baseline than their
    base. The equation region already carries a spatial envelope. A fragment
    may join when its centre lies inside that envelope or within a small
    vertical margin, and it must stay in the same visual flow. Prose regions
    are never candidates, even if they contain a mathematical symbol.
    """
    # Regions from layout.py have readingOrder. The loader's internal regions
    # can be merged before that projection, using geometry as a stable order.
    ordered = sorted(
        regions,
        key=lambda row: (
            row.get("readingOrder", 0),
            row["bbox"][1],
            row["bbox"][0],
        ),
    )
    output = []
    for region in ordered:
        if region["type"] == "math" and output:
            previous = output[-1]
            if previous["type"] == "math":
                a = previous["bbox"]
                b = region["bbox"]
                gap = max(0.0, max(a[1], b[1]) - min(a[3], b[3]))
                centre = (b[0] + b[2]) / 2
                envelope = [min(a[0], b[0]), a[1] - 4, max(a[2], b[2]), a[3] + 4]
                within = envelope[0] - 2 <= centre <= envelope[2] + 2
                if gap <= 4 and within:
                    previous["bbox"] = [
                        round(min(a[0], b[0]), 2),
                        round(min(a[1], b[1]), 2),
                        round(max(a[2], b[2]), 2),
                        round(max(a[3], b[3]), 2),
                    ]
                    previous["text"] = previous["text"].rstrip() + "\n" + region["text"].lstrip()
                    continue
        # A short subscript fragment is part of the equation above when it sits
        # beneath the formula's horizontal footprint. Run only once per region.
        if region["type"] == "math" and output and output[-1]["type"] == "math":
            previous = output[-1]
            a, b = previous["bbox"], region["bbox"]
            overlap = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
            if b[1] <= a[3] + 5 and overlap >= min(b[2] - b[0], 8) * 0.5:
                previous["bbox"] = [
                    round(min(a[0], b[0]), 2),
                    round(min(a[1], b[1]), 2),
                    round(max(a[2], b[2]), 2),
                    round(max(a[3], b[3]), 2),
                ]
                previous["text"] = previous["text"].rstrip() + "\n" + region["text"].lstrip()
                continue
        output.append({**region, "bbox": list(region["bbox"])})
    for reading_order, region in enumerate(output, 1):
        region["readingOrder"] = reading_order
    return output


def _page_regions(page):
    """Group visual lines into bounded source regions.

    A prose region can only contain contiguous text lines from the same visual
    flow. Display formulas are grouped by their shared horizontal extent and
    short vertical gaps. The PDF's own image and vector regions are retained
    as media candidates; no text is invented for a drawing.
    """
    lines = _text_lines(page)
    if not lines:
        rows = []
    else:
        rows = _merge_wrapped_titles(_merge_visual_rows(lines))
    rows.sort(key=lambda item: (round(item["bbox"][1], 1), item["bbox"][0]))
    # A scanned page can have no native text layer. Its drawing geometry is
    # still retained and OCR is invoked after this region pass.
    left = min((line["bbox"][0] for line in lines), default=page.rect.x0)
    right = max((line["bbox"][2] for line in lines), default=page.rect.x1)
    result = []
    index = 0
    column_width = max(1.0, right - left)
    inside_code = False
    while index < len(rows):
        line = rows[index]
        kind = _line_kind(line, left, right)
        is_fence = line["text"].strip().startswith(("```", "~~~"))
        if inside_code or is_fence:
            kind = "code"
            line = {**line, "text": line.get("source_text", line["text"])}
        if is_fence:
            inside_code = not inside_code
        if kind == "math" and _prose_line(line, column_width, start=True):
            kind = "paragraph"
        if kind != "math":
            if (
                result
                and result[-1]["kind"] in ("paragraph", "semantic")
                and kind in ("paragraph", "semantic")
            ):
                previous = result[-1]
                pbox = previous["bbox"]
                gap = _vertical_gap(previous, line)
                same_flow = -2.0 <= gap <= max(6.5, min(9.5, line["size"] * 1.0))
                previous_last = previous["lines"][-1].get("bbox") if previous["lines"] else pbox
                if same_flow and previous_last and abs(line["bbox"][0] - previous_last[0]) <= 8:
                    previous["text"] += " " + line["text"]
                    previous["bbox"] = _union([pbox, line["bbox"]])
                    previous["lines"].extend(line.get("parts", [line]))
                    index += 1
                    continue
            result.append(
                {
                    "text": line["text"],
                    "bbox": line["bbox"],
                    "kind": (
                        "table"
                        if re.fullmatch(r"\|(?:[^|\n]*\|){2,}", line["text"].strip())
                        else kind
                    ),
                    "lines": list(line.get("parts", [line])),
                }
            )
            index += 1
            continue

        # A display equation is a bounded run of rows. It may include a
        # separate lower limit or denominator, but a column-wide sentence ends
        # the run. This prevents prose from entering a math block.
        band = _formula_run(rows, index, left, right)
        cursor = index + len(band)
        _append_math_band(result, band)
        index = cursor
    clean = []
    for region in result:
        clean.append(
            {
                "text": region["text"].rstrip("\r\n") if region["kind"] == "code" else region["text"].strip(),
                "bbox": _union([region["bbox"]] + [line["bbox"] for line in region["lines"]]),
                "extraction_method": "text",
                "region_type": region["kind"],
                "line_count": len(region["lines"]),
            }
        )
    candidates, image_keys = _figure_candidates(page, [r["bbox"] for r in clean if r["region_type"] == "figure_caption"])
    for rect in candidates:
        key = tuple(round(value, 1) for value in (rect.x0, rect.y0, rect.x1, rect.y1))
        bbox = [round(float(rect.x0), 2), round(float(rect.y0), 2), round(float(rect.x1), 2), round(float(rect.y1), 2)]
        if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
            continue
        clean.append(
            {
                "text": "",
                "bbox": bbox,
                "extraction_method": "image" if key in image_keys else "vector",
                "region_type": "figure",
                "line_count": 0,
            }
        )
    return clean


def _page_regions_v2(page):
    """Group overlapping short mathematical fragments conservatively.

    V2 is explicitly selected: V1 remains reproducible for historical
    artifacts. The text of absorbed fragments is retained verbatim; its
    mathematical reading order is not inferred or certified.
    """
    regions = _page_regions(page)
    used = set()
    for index, target in enumerate(regions):
        if target.get("region_type") != "math":
            continue
        a = target["bbox"]
        fragments = []
        for n, other in enumerate(regions):
            if n == index or n in used or other.get("region_type") != "paragraph":
                continue
            text = str(other.get("text") or "").strip()
            b = other["bbox"]
            overlap_y = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
            overlap_x = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
            words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]{2,}", text)
            if (len(text) > 30 or len(words) > 2 or
                overlap_y < 0.6 * max(1.0, min(a[3]-a[1], b[3]-b[1])) or
                overlap_x < 0.5 * max(1.0, min(a[2]-a[0], b[2]-b[0])) or
                b[0] < a[0]-24 or b[2] > a[2]+24):
                continue
            # Require math-like evidence or a short script wholly inside the
            # envelope; sentence-like prose is never absorbed.
            if len(text) > 2 and not re.search(r"[=+−∑∫∞<>]|\blim\b", text):
                continue
            if re.search(r"[.!?]$", text) and len(words) >= 2 and "lim" not in text:
                continue
            fragments.append((n, other))
        if fragments:
            target["bbox"] = _union([a] + [other["bbox"] for _, other in fragments])
            target["text"] = "\n".join([str(other["text"]) for _, other in fragments] + [target["text"]])
            target["line_count"] = int(target.get("line_count") or 0) + sum(int(other.get("line_count") or 0) for _, other in fragments)
            used.update(n for n, _ in fragments)
        target["region_issues"] = ["math_boundary_unverified", "math_reading_order_unverified"]
    return [region for n, region in enumerate(regions) if n not in used]


def _extract_pages(pdf_path: str, extraction_version="1.0"):
    import fitz

    document = fitz.open(pdf_path)
    try:
        if document.needs_pass:
            raise EncryptedPdfError("PDF is encrypted/password-protected")
        if len(document) > MAX_PAGES:
            raise PdfParseLimitError("PDF exceeds page limit")
        glyphs = _pdf_glyph_names(document)
        if glyphs:
            _repair_font_glyphs(document, glyphs)
        pages = []
        total = 0
        for number, page in enumerate(document, 1):
            native_text = page.get_text(sort=True)
            text = native_text
            method = "text"
            confidence = None
            timeline = ["pdf_text"]
            regions = _page_regions_v2(page) if extraction_version == "2.0" else _page_regions(page)
            if regions:
                # Reading order comes from the bounded region builder. The
                # raw page stream remains available in the original artifact.
                text = "\n\n".join(
                    str(region["text"])
                    for region in regions
                    if region.get("text", "").strip()
                )
            # A page can contain embedded text while its visible content needs
            # OCR (for example, a scan with a hidden watermark). Fall back at
            # page scope, never by rescanning the whole document.
            visible = page.get_text("blocks", sort=True)
            meaningful = sum(
                len("".join(c for c in str(block[4]) if c.isalnum()))
                for block in visible
                if len(block) >= 7 and block[6] == 0
            )
            if meaningful < 3 or not regions:
                from agents.course_ingestion.extraction.ocr import _ocr_page
                import tempfile

                with tempfile.TemporaryDirectory(prefix="ednova-region-") as directory:
                    fallback, confidence = _ocr_page(page, directory)
                if fallback.strip():
                    text, method = fallback, "ocr"
                    timeline.append("ocr")
                    regions = [
                        {
                            "text": fallback,
                            "bbox": [round(page.rect.x0, 2), round(page.rect.y0, 2), round(page.rect.x1, 2), round(page.rect.y1, 2)],
                            "extraction_method": "ocr",
                            "ocr_confidence": confidence,
                            "region_type": "paragraph",
                        }
                    ]
            total += len(text.encode("utf8"))
            if total > MAX_TEXT_BYTES:
                raise PdfParseLimitError("PDF exceeds extracted text limit")
            pages.append(
                {
                    "page_number": number,
                    "text": text,
                    "width": round(page.rect.width, 2),
                    "height": round(page.rect.height, 2),
                    "regions": regions,
                    "extraction_method": method,
                    "ocr_confidence": confidence if method == "ocr" else None,
                    "review_required": method == "ocr",
                    "timeline": timeline,
                    "glyphRepairs": len(glyphs),
                    "sourcePageText": native_text,
                    **({"extractionVersion": "2.0"} if extraction_version == "2.0" else {}),
                }
            )
        return pages
    finally:
        document.close()


def extract_pages_from_pdf_sandboxed(
    pdf_path: str, timeout_s: int = 45, max_memory_mb: int = 512, *, extraction_version: str = "1.0"
):
    """Return page text, layout regions and geometry from a bounded child."""
    if extraction_version not in ("1.0", "2.0"):
        raise ValueError("Unsupported extraction version")
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-I",
                os.path.abspath(__file__),
                "--sandbox",
                pdf_path,
                str(max_memory_mb),
                str(max(1, math.ceil(timeout_s))),
                *(["2.0"] if extraction_version == "2.0" else []),
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise PdfParseTimeoutError("PDF parsing exceeded sandbox timeout") from None
    except OSError:
        raise PdfValidationError("PDF sandbox could not start") from None
    if result.returncode != 0:
        raise PdfParseLimitError(
            "PDF parsing aborted inside sandbox (CPU/memory limits)"
        )
    try:
        response = json.loads(result.stdout)
        if response.get("status") == "ok":
            pages = response["pages"]
            if (
                not isinstance(pages, list)
                or len(pages) > MAX_PAGES
                or any(
                    not isinstance(p, dict)
                    or type(p.get("page_number")) is not int
                    or p["page_number"] != i
                    or not isinstance(p.get("text"), str)
                    or not isinstance(p.get("regions"), list)
                    for i, p in enumerate(pages, 1)
                )
            ):
                raise ValueError("Malformed sandbox result")
            return pages
        if response.get("kind") == "EncryptedPdfError":
            raise EncryptedPdfError("PDF is encrypted/password-protected")
        if response.get("kind") == "PdfParseLimitError":
            raise PdfParseLimitError("PDF exceeds sandbox limits")
    except (ValueError, TypeError, KeyError, AttributeError):
        raise PdfValidationError("Invalid PDF sandbox response") from None
    raise PdfValidationError("PDF parsing failed")


def extract_text_from_pdf_sandboxed(
    pdf_path: str, timeout_s: int = 45, max_memory_mb: int = 512
) -> str:
    return "".join(
        text
        for page in extract_pages_from_pdf_sandboxed(
            pdf_path, timeout_s, max_memory_mb
        )
        for text in [page["text"]]
    )


def _sandbox_main():
    try:
        _ensure_app_import_path()
        _apply_resource_limits(int(sys.argv[3]), int(sys.argv[4]))
        version = sys.argv[5] if len(sys.argv) == 6 else "1.0"
        if version not in ("1.0", "2.0"):
            raise ValueError("Unsupported extraction version")
        result = {"status": "ok", "pages": _extract_pages(sys.argv[2], version)}
    except BaseException as exc:
        result = {"status": "error", "kind": type(exc).__name__}
    sys.stdout.write(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__" and len(sys.argv) in (5, 6) and sys.argv[1] == "--sandbox":
    _sandbox_main()


def render_region_sandboxed(pdf_path, page_number, bbox, timeout_s=12, *, math_context=False):
    """Render in a fresh limited child, without loading a PDF in the API process."""
    import tempfile
    with tempfile.TemporaryFile() as output:
        try:
            result = subprocess.run(
                [sys.executable, "-I", os.path.abspath(__file__), "--crop", pdf_path, "256", "10"],
                input=json.dumps({"page": page_number, "bbox": bbox, "math_context": math_context}).encode(),
                stdout=output, stderr=subprocess.DEVNULL, timeout=timeout_s, check=False,
            )
        except subprocess.TimeoutExpired:
            raise PdfParseTimeoutError("Source crop timed out") from None
        if result.returncode == 22:
            raise ValueError("Invalid source geometry")
        if result.returncode:
            raise PdfParseLimitError("Source crop exceeded parser limits")
        output.seek(0)
        data = output.read(4 * 1024 * 1024 + 1)
    if len(data) > 4 * 1024 * 1024 or not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise PdfParseLimitError("Invalid or oversized source crop")
    return data


def _math_context_bbox(page, bbox):
    """Expand a display crop over adjacent mathematical glyphs, not prose.

    This provides source context, not a proof of a complete equation. Original
    region geometry and its identity remain unchanged. Limit growth and require
    math-font evidence and vertical overlap with the original band.
    """
    import fitz
    original = fitz.Rect(*bbox)
    glyphs = []
    for block in page.get_text("rawdict", sort=True).get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if not _MATH_FONTS.search(str(span.get("font") or "")):
                    continue
                for char in span.get("chars", []):
                    if not str(char.get("c") or "").strip():
                        continue
                    box = fitz.Rect(char.get("bbox", (0, 0, 0, 0)))
                    overlap = max(0, min(box.y1, original.y1) - max(box.y0, original.y0))
                    if box.width > 0 and box.height > 0 and overlap >= box.height * .6:
                        glyphs.append(box)
    left, right = original.x0, original.x1
    for _ in range(12):
        candidates = [b for b in glyphs if b.x0 >= right - .1 and 0 <= b.x0 - right <= 3
                      and b.x1 <= original.x1 + 24]
        if not candidates:
            break
        right = max(right, min(candidates, key=lambda b: b.x0).x1)
    for _ in range(12):
        candidates = [b for b in glyphs if b.x1 <= left + .1 and 0 <= left - b.x1 <= 3
                      and b.x0 >= original.x0 - 24]
        if not candidates:
            break
        left = min(left, max(candidates, key=lambda b: b.x1).x0)
    # Add a small margin only on sides where glyphs were actually recovered.
    return [round(max(page.rect.x0, left - (1 if left < original.x0 else 0)), 2),
            bbox[1], round(min(page.rect.x1, right + (1 if right > original.x1 else 0)), 2), bbox[3]]


def _crop_main():
    try:
        _apply_resource_limits(int(sys.argv[3]), int(sys.argv[4]))
        import resource
        resource.setrlimit(resource.RLIMIT_FSIZE, (4 * 1024 * 1024, 4 * 1024 * 1024))
        import fitz
        request = json.loads(sys.stdin.buffer.read(4096))
        with fitz.open(sys.argv[2]) as pdf:
            number, bbox = request["page"], request["bbox"]
            if type(number) is not int or not 1 <= number <= len(pdf):
                raise ValueError()
            page = pdf[number - 1]
            if not isinstance(bbox, list) or len(bbox) != 4 or any(type(x) not in (int, float) or not math.isfinite(x) for x in bbox):
                raise ValueError()
            x0,y0,x1,y1 = bbox
            if x0 < 0 or y0 < 0 or x1 <= x0 or y1 <= y0 or x1 > page.rect.width + 2 or y1 > page.rect.height + 2 or (x1-x0)*(y1-y0) > page.rect.width*page.rect.height*.8:
                raise ValueError()
            if request.get("math_context") is True:
                bbox = _math_context_bbox(page, bbox)
            clip = fitz.Rect(*bbox)
            scale = min(2., 1600 / max(clip.width, clip.height, 1))
            image = page.get_pixmap(matrix=fitz.Matrix(scale,scale), clip=clip, alpha=False)
            if image.width * image.height > 4_000_000:
                raise ValueError()
            data = image.tobytes("png")
            if len(data) > 4 * 1024 * 1024:
                raise ValueError()
            sys.stdout.buffer.write(data)
    except ValueError:
        sys.exit(22)
    except BaseException:
        sys.exit(1)


if __name__ == "__main__" and len(sys.argv) == 5 and sys.argv[1] == "--crop":
    _crop_main()
