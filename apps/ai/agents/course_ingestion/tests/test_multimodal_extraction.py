"""Batch 2 regression tests against generated and reference PDFs."""

from pathlib import Path

import fitz

from agents.course_ingestion.extraction import pdf_loader
from agents.course_ingestion.extraction.layout import (
    LAYOUT_VERSION,
    regions_from_pages,
    region_quality,
)
from agents.course_ingestion.extraction.table_fallback import table_from_region
from agents.course_ingestion.normalization.canonical_document import (
    build_canonical_document,
)


REFERENCE = Path(__file__).parents[1] / "extraction" / "benchmarks" / "reference-course.pdf"


def _extract(path):
    return pdf_loader.extract_pages_from_pdf_sandboxed(str(path))


def test_reference_preserves_quantifiers_accents_and_canonical_geometry():
    pages = _extract(REFERENCE)
    assert len(pages) == 20
    page = pages[0]["text"]
    assert "Séries" in page
    assert "∀ε > 0" in page
    assert "∃Nε ∈N" in page
    assert "⇒" in page and "≤ε" in page
    regions = regions_from_pages(pages)
    assert any(
        region["type"] == "math" and "∀ε" in region["text"] and region["page"] == 1
        for region in regions
    )
    assert any(
        region["type"] == "semantic" and "3.2.1" in region["text"] and "Dé" in region["text"]
        for region in regions
    )
    assert any(
        region["type"] == "heading" and region["text"] == "3.3 Notions de convergence"
        for region in regions
    )
    assert any(
        region["type"] == "heading"
        and region["text"] == "Fonctions déﬁnies par des intégrales à paramètre"
        and region["page"] == 11
        for region in regions
    )
    assert all(region["bbox"] and region["id"].startswith("region_") for region in regions)


def test_reference_retains_only_the_real_framed_algorithm():
    regions = regions_from_pages(_extract(REFERENCE))
    figures = [region for region in regions if region["type"] == "figure"]
    assert len(figures) == 1
    assert figures[0]["page"] == 2
    assert figures[0]["bbox"] == [122.92, 105.72, 463.08, 392.31]
    assert figures[0]["text"] == ""
    assert figures[0]["reviewRequired"] is True


def test_page_frame_and_rule_decorations_are_not_figures(tmp_path):
    path = tmp_path / "rules.pdf"
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Section title")
    page.draw_line((72, 83), (513, 83), width=0.4)
    page.draw_line((72, 200), (513, 200), width=0.4)
    page.draw_line((72, 83), (72, 200), width=0.4)
    page.draw_line((513, 83), (513, 200), width=0.4)
    document.save(path)
    document.close()
    figures = [region for region in regions_from_pages(_extract(path)) if region["type"] == "figure"]
    assert figures == []


def test_bounded_vector_figure_survives_and_quality_requires_review():
    regions = regions_from_pages(_extract(REFERENCE))
    quality = region_quality(regions)
    assert LAYOUT_VERSION == "1.1.0"
    assert quality["publicationState"] == "review_required"
    assert quality["semanticFidelity"] == "review_required"
    assert quality["sourceIntegrity"] == "verified"
    assert any(region["type"] == "figure" for region in regions)


def test_math_grouping_stops_before_a_prose_paragraph(tmp_path):
    path = tmp_path / "display.pdf"
    document = fitz.open()
    page = document.new_page()
    page.insert_text((180, 100), "x = y", fontname="symb")
    page.insert_text((72, 125), "A prose sentence follows the equation and ends here.", fontname="helv")
    document.save(path)
    document.close()
    regions = regions_from_pages(_extract(path))
    assert [region["type"] for region in regions] == ["math", "paragraph"]
    assert regions[0]["text"] == "x = y"


def test_malformed_pdf_is_rejected(tmp_path):
    path = tmp_path / "malformed.pdf"
    path.write_bytes(b"%PDF-1.7\nnot a real object graph")
    try:
        _extract(path)
    except pdf_loader.PdfValidationError:
        pass
    else:
        raise AssertionError("malformed PDF was accepted")


def test_table_reconstruction_requires_explicit_cells_and_preserves_headers():
    table = table_from_region(
        "| Nom | Valeur |\n| --- | --- |\n| alpha | 1 |\n| beta | 2 |"
    )
    assert table == {
        "type": "table",
        "columns": ["Nom", "Valeur"],
        "rows": [["alpha", "1"], ["beta", "2"]],
    }
    assert table_from_region("a | b\nc | d") is None


def test_canonical_projection_keeps_table_source_and_review_state():
    lesson = {
        "id": "sub_table",
        "title": "Data",
        "full_content": "| Nom | Valeur |\n| --- | --- |\n| alpha | 1 |",
        "source_spans": [
            {
                "chunkId": "chk_table",
                "documentId": "doc_course",
                "pageNumber": 3,
                "lineStart": 1,
                "lineEnd": 3,
            }
        ],
        "source_regions": [
            {
                "id": "region_table",
                "page": 3,
                "bbox": [72, 72, 400, 150],
                "type": "table",
                "text": "| Nom | Valeur |\n| --- | --- |\n| alpha | 1 |",
                "chunkId": "chk_table",
                "documentId": "doc_course",
                "readingOrder": 1,
                "confidence": 0.5,
                "reviewRequired": True,
                "issues": ["ambiguous_table"],
            }
        ],
    }
    canonical = build_canonical_document(
        "64a000000000000000000001",
        "Course",
        [{"id": "topic", "title": "Chapter", "subtopics": [lesson]}],
    )
    blocks = canonical["chapters"][0]["lessons"][0]["blocks"]
    table = next(block for block in blocks if block["type"] == "table")
    assert table["columns"] == ["Nom", "Valeur"]
    assert table["rows"] == [["alpha", "1"]]
    assert table["verification"] == "source_review_required"
    assert canonical["quality"]["publicationState"] == "review_required"


def test_page_scoped_ocr_fallback_keeps_provenance(tmp_path, monkeypatch):
    from agents.course_ingestion.extraction import ocr

    scanned = tmp_path / "scan.pdf"
    document = fitz.open()
    document.new_page().draw_line((72, 72), (300, 72), width=2)
    document.save(scanned)
    document.close()
    monkeypatch.setattr(ocr, "_ocr_page", lambda page, directory: ("Local OCR evidence", 81.5))
    pages = pdf_loader._extract_pages(str(scanned))
    assert pages[0]["extraction_method"] == "ocr"
    assert pages[0]["ocr_confidence"] == 81.5
    assert pages[0]["review_required"] is True
    assert "Local OCR evidence" in pages[0]["text"]
    assert pages[0]["regions"][0]["region_type"] == "paragraph"


def test_representative_prose_table_and_code_shapes_remain_distinct(tmp_path):
    path = tmp_path / "mixed.pdf"
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "A prose paragraph explains the application before its example.", fontname="helv")
    page.insert_text((72, 112), "| Input | Result |", fontname="cour")
    page.insert_text((72, 124), "| --- | --- |", fontname="cour")
    page.insert_text((72, 136), "| x | 1 |", fontname="cour")
    page.insert_text((72, 176), "```python", fontname="cour")
    page.insert_text((72, 188), "return value + 1", fontname="cour")
    page.insert_text((72, 200), "```", fontname="cour")
    page.insert_text((72, 240), "The prose after the example remains separate.", fontname="helv")
    document.save(path)
    document.close()
    regions = regions_from_pages(_extract(path))
    assert any(region["type"] == "paragraph" for region in regions)
    tables = [region for region in regions if region["type"] == "table"]
    assert len(tables) == 1
    assert tables[0]["text"].splitlines() == [
        "| Input | Result |",
        "| --- | --- |",
        "| x | 1 |",
    ]
    assert tables[0]["reviewRequired"] is True
    assert len([region for region in regions if region["type"] == "code"]) == 1
    assert regions[-1]["type"] == "paragraph"


def test_reference_regions_survive_manifest_sections_and_canonical(tmp_path, monkeypatch):
    from services.vector_store.revision_artifacts import byte_hash, manifest_digest, extract_documents, source_regions
    from agents.course_ingestion.parsing.semantic_structure import detect_sections_with_sources
    from agents.course_ingestion.parsing.section_builder import build_subtopics

    value = REFERENCE.read_bytes()
    digest = byte_hash(value)
    root = tmp_path / "uploads"
    (root / "originals").mkdir(parents=True)
    (root / "originals" / digest[7:]).write_bytes(value)
    monkeypatch.setenv("INGEST_UPLOADS_DIR", str(root))
    manifest = {
        "courseId": "a" * 24, "revisionId": "rev_benchmark", "contentHash": digest,
        "documents": [{"documentId": "doc_reference", "contentHash": digest,
                       "storageRef": "originals/" + digest[7:], "mediaType": "application/pdf"}],
    }
    manifest["manifestDigest"] = manifest_digest(manifest)
    chunks, metas = extract_documents(manifest)
    assert all(meta.get("region_id") and meta.get("region_type") for meta in metas)
    sections = detect_sections_with_sources(zip(chunks, metas))
    lessons = build_subtopics(sections)
    assert len(lessons) == 16
    assert not any(lesson["title"].startswith("# f") for lesson in lessons)
    document = build_canonical_document("a" * 24, "Reference", [
        {"id": "chapter", "title": "Source", "subtopics": lessons}
    ])
    blocks = [block for chapter in document["chapters"] for lesson in chapter["lessons"] for block in lesson["blocks"]]
    media = [block for block in blocks if block["type"] == "media"]
    assert len(media) == 1
    assert media[0]["page"] == 2
    assert media[0]["regionId"] in source_regions(manifest)
    assert any(block["type"] == "math" and block["reviewRequired"] for block in blocks)
    assert any(block["type"] == "definition" for block in blocks)


def test_separate_prose_table_and_programming_documents(tmp_path):
    import json
    fixtures = json.loads(REFERENCE.with_name('representative-fixtures.json').read_text())
    for fixture in fixtures:
        path = tmp_path / (fixture['name'] + '.pdf')
        with fitz.open() as pdf:
            page = pdf.new_page()
            for index, line in enumerate(fixture['lines']):
                page.insert_text((72, 72 + index * 16), line,
                                 fontname='helv' if fixture['name'] == 'prose' else 'cour')
            pdf.save(path)
        regions = regions_from_pages(_extract(path))
        candidates = [r for r in regions if r['type'] == fixture['expectedType']]
        assert candidates, fixture['name']
        if fixture['name'] == 'table':
            table = table_from_region(candidates[0]['text'])
            assert table['columns'] == fixture['expectedColumns']
            assert table['rows'] == fixture['expectedRows']
        else:
            assert any(fixture['expectedText'] in r['text'] for r in candidates)


def test_networking_fixture_preserves_indentation_spaced_table_and_rectangle():
    """Authored representative fixture, not an independent real-world corpus."""
    path = REFERENCE.with_name('networking-qa.pdf')
    regions = regions_from_pages(_extract(path))
    code = next(r for r in regions if r['type'] == 'code')
    assert code['text'] == '```python\ndef acknowledge(sequence):\n    if sequence < 0:\n        return None\n    return sequence + 1\n```'
    table = table_from_region(next(r for r in regions if r['type'] == 'table')['text'])
    assert table['columns'] == ['Message', 'Purpose']
    assert table['rows'] == [['SYN', 'Open'], ['ACK', 'Confirm']]
    assert len([r for r in regions if r['type'] == 'figure']) == 1
    assert any(r['type'] == 'figure_caption' for r in regions)
    assert not any(r['type'] == 'math' and 'Sender' in r['text'] for r in regions)
    assert len([r for r in regions if r['type'] == 'heading']) == 2
