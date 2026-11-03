"""Versioned detector evidence; mathematical correctness remains unverified."""
import hashlib
import json
import unicodedata
from pathlib import Path

import fitz
import pytest

from agents.course_ingestion.extraction.layout import regions_from_pages
from agents.course_ingestion.extraction.pdf_loader import (
    _v2_expand_over_math_glyphs,
    extract_pages_from_pdf_sandboxed,
)
from services.vector_store.revision_artifacts import manifest_digest, source_regions

BASE = Path(__file__).parents[1] / 'extraction' / 'benchmarks'
PDF = BASE / 'reference-course.pdf'


def test_v2_primary_region_recovers_final_summand_preserves_all_v1_region_text():
    legacy = extract_pages_from_pdf_sandboxed(str(PDF))
    updated = extract_pages_from_pdf_sandboxed(str(PDF), extraction_version='2.0')
    assert len(legacy) == len(updated) == 20
    regions = regions_from_pages(updated)
    candidates = [r for r in regions if r['page'] == 1 and r['type'] == 'math'
                  and 448 < r['bbox'][1] < 453 and r['bbox'][0] > 200]
    assert len(candidates) == 1
    target = candidates[0]
    assert target['bbox'][2] >= 346.14
    assert 'lim' in target['text'] and 'up.' in target['text']
    assert target['reviewRequired'] and 'math_reading_order_unverified' in target['issues']
    # V2 may restructure bands (absorb scripts, split prose, reorder rows),
    # so content preservation is asserted line by line: every non-empty V1
    # line must survive verbatim inside one line of some V2 region text.
    for before, after in zip(legacy, updated):
        v2_lines = [line for r in after['regions'] for line in r['text'].splitlines()]
        for region in before['regions']:
            for line in region['text'].splitlines():
                if line.strip():
                    assert any(line in v2_line for v2_line in v2_lines)
    with fitz.open(PDF) as doc:
        assert all(doc[r['page'] - 1].rect.contains(fitz.Rect(r['bbox'])) for r in regions)


def test_ambiguous_multiline_and_mixed_source_is_marked_not_verified():
    pages = extract_pages_from_pdf_sandboxed(str(PDF), extraction_version='2.0')
    regions = regions_from_pages(pages)
    # The long page-19 derivation and the page-20 final example stay available;
    # grouping and reading order remain an explicit human-review concern.
    for page in (19, 20):
        math = [r for r in regions if r['page'] == page and r['type'] == 'math']
        assert math and all(r['reviewRequired'] and 'math_boundary_unverified' in r['issues'] for r in math)
    assert any('finalement' in unicodedata.normalize('NFKC', r['text']).lower() for r in regions if r['page'] == 20)


def test_manifest_version_resolves_legacy_and_v2_independently(tmp_path, monkeypatch):
    value = PDF.read_bytes()
    hashed = 'sha256:' + hashlib.sha256(value).hexdigest()
    originals = tmp_path / 'originals'; originals.mkdir()
    (originals / hashed[7:]).write_bytes(value)
    monkeypatch.setenv('INGEST_UPLOADS_DIR', str(tmp_path))
    document = {'documentId':'doc_' + hashed[7:23], 'storageRef':'originals/' + hashed[7:],
                'contentHash':hashed, 'mediaType':'application/pdf'}
    def manifest(doc):
        m = {'courseId':'a'*24, 'revisionId':'old', 'contentHash':hashed, 'documents':[doc]}
        m['manifestDigest'] = manifest_digest(m)
        return m
    old = manifest(document)
    new = manifest({**document, 'extractionVersion':'2.0'})
    before = source_regions(old)
    after = source_regions(new)
    assert old['manifestDigest'] != new['manifestDigest']
    assert before and after and set(before).isdisjoint(after)
    assert source_regions(old) == before
    with pytest.raises(ValueError):
        source_regions({**old, 'documents':new['documents']})
    invalid = manifest({**document, 'extractionVersion':'9.0'})
    with pytest.raises(ValueError):
        source_regions(invalid)


# ---------------------------------------------------------------------------
# Synthetic regression fixtures. Each page isolates one detector decision; the
# assertions cover grouping labels, structural evidence and text preservation,
# never mathematical correctness.
# ---------------------------------------------------------------------------


def _pages_from(path, version):
    return extract_pages_from_pdf_sandboxed(str(path), extraction_version=version)


def _regions_from(path, version="2.0"):
    return regions_from_pages(_pages_from(path, version))


def _math(path):
    return [r for r in _regions_from(path) if r["type"] == "math"]


def _math_page(spec):
    """Build one deterministic synthetic page for a fixture name."""
    import os

    document = fitz.open()
    if spec == "edge":
        page = document.new_page(width=240, height=200)
        page.insert_text((190, 100), "xy = 0000", fontname="helv", fontsize=13)
    else:
        page = document.new_page()
        if spec == "absorb":
            page.insert_text((104, 96), "lim up.", fontname="helv", fontsize=9)
            page.insert_text((100, 110), "x = y", fontname="helv", fontsize=13)
            page.insert_text((72, 112), "Some ends here.", fontname="helv", fontsize=11)
        elif spec == "split":
            page.insert_text((180, 100), "x = y", fontname="helv", fontsize=13)
            page.insert_text((72, 110), "So, after that, some values", fontname="helv", fontsize=11)
            page.insert_text((72, 124), "As x = y.", fontname="helv", fontsize=11)
            page.insert_text((180, 160), "z = w", fontname="helv", fontsize=13)
        elif spec == "mixed":
            # Same baseline as the equation but separated horizontally by more
            # than the visual-row merge window: one band, two rows, mixed prose.
            page.insert_text((100, 100), "x = y", fontname="helv", fontsize=13)
            page.insert_text((200, 100), "Since the sum equals", fontname="helv", fontsize=11)
        elif spec == "ambig":
            page.insert_text((100, 110), "x = y", fontname="helv", fontsize=11)
            page.insert_text((104, 112.6), "w = z", fontname="helv", fontsize=11)
        elif spec == "multi":
            page.insert_text((100, 100), "x = y", fontname="helv", fontsize=13)
            page.insert_text((104, 112), "z = w", fontname="helv", fontsize=13)
        elif spec == "sep":
            page.insert_text((180, 100), "x = y", fontname="symb", fontsize=12)
            page.insert_text((72, 125), "A prose sentence follows the equation and ends here.", fontname="helv", fontsize=11)
            page.insert_text((180, 150), "z = w", fontname="symb", fontsize=12)
        else:
            raise AssertionError("unknown fixture")
    directory = os.environ.get("EDNOVA_MATHFixture_DIR")
    path = Path(directory or ".") / f"math-{spec}.pdf"
    document.save(str(path))
    document.close()
    return path


def test_v2_limit_fragment_row_joins_the_display_band(tmp_path):
    # The limit fragment sits directly above the band and outside the V1 run,
    # so V1 lost its connection to the formula while V2 re-attaches it.
    path = _math_page("absorb")
    math = _math(path)
    assert len(math) == 1
    band = math[0]
    assert band["text"] == "lim up.\nx = y"
    assert band["bbox"][1] <= 97.0  # fragment geometry joins the band bbox
    assert band["mathGrouping"] == "single_expression"
    assert "math_absorbed_fragment" in band["issues"]
    assert band["reviewRequired"]
    # V1 keeps the prose-classified fragment away from the formula.
    legacy = regions_from_pages(_pages_from(path, "1.0"))
    assert any(r["type"] == "paragraph" and r["text"] == "lim up." for r in legacy)


def test_v2_wrapped_prose_leaves_the_display_band():
    path = _math_page("split")
    math = _math(path)
    prose = [r for r in _regions_from(path) if r["type"] == "paragraph"]
    assert len(math) == 2 and len(prose) == 1
    # Every V1 line survives; the band no longer carries sentence text.
    legacy = regions_from_pages(_pages_from(path, "1.0"))
    legacy_math = [r for r in legacy if r["type"] == "math"]
    # V1 keeps the wrapped prose row welded to the band, and the lower
    # "z = w" formula stays its own region.
    assert len(legacy_math) == 2
    assert "So, after that, some values" in legacy_math[0]["text"]
    assert "As x = y." in legacy_math[0]["text"]
    assert math[0]["text"] == "x = y"
    assert "math_band_split" in math[0]["issues"]
    # The wrapped prose row joined the same paragraph and its '=' cue puts it
    # under explicit mixed-content review.
    assert prose[0]["text"] == "So, after that, some values As x = y."
    assert "math_inline_mixed" in prose[0]["issues"]
    assert "z = w" == math[-1]["text"]


def test_v2_centred_prose_row_inside_a_band_is_mixed_prose():
    path = _math_page("mixed")
    math = _math(path)
    assert len(math) == 1
    assert math[0]["mathGrouping"] == "mixed_prose"
    assert "math_prose_contamination" in math[0]["issues"]
    assert "Since the sum equals" in math[0]["text"]


def test_v2_same_baseline_rows_are_structurally_ambiguous():
    path = _math_page("ambig")
    math = _math(path)
    assert len(math) == 1
    assert math[0]["mathGrouping"] == "structurally_ambiguous"
    assert "math_grouping_ambiguous" in math[0]["issues"]
    assert math[0]["text"] == "x = y\nw = z"


def test_v2_stacked_math_rows_group_as_one_derivation():
    path = _math_page("multi")
    math = _math(path)
    assert len(math) == 1
    assert math[0]["mathGrouping"] == "multiline_derivation"
    assert not [i for i in math[0]["issues"] if i.startswith("math_grouping")]


def test_v2_expressions_around_prose_stay_separate_and_ordered():
    path = _math_page("sep")
    regions = _regions_from(path)
    assert [(r["type"], r.get("mathGrouping")) for r in regions] == [
        ("math", "single_expression"),
        ("paragraph", None),
        ("math", "single_expression"),
    ]
    assert regions[0]["text"] == "x = y" and regions[2]["text"] == "z = w"
    assert regions[1]["text"].startswith("A prose sentence")
    assert regions[0]["readingOrder"] < regions[1]["readingOrder"] < regions[2]["readingOrder"]
    assert all(r["reviewRequired"] for r in regions if r["type"] == "math")
    for r in regions:
        if r["type"] == "math":
            assert "math_boundary_unverified" in r["issues"]
            assert "math_reading_order_unverified" in r["issues"]


def test_v2_page_edge_math_is_bounded_by_the_page():
    path = _math_page("edge")
    math = _math(path)
    assert len(math) == 1
    with fitz.open(path) as document:
        rect = document[0].rect
    assert math[0]["bbox"][2] <= rect.x1 + 0.01
    assert math[0]["bbox"][2] >= rect.x1 - 1.5  # the band reaches the edge


def test_v2_identity_is_stable_and_version_salted():
    path = _math_page("sep")
    first = _regions_from(path)
    second = regions_from_pages(_pages_from(path, "2.0"))
    assert [r["id"] for r in first] == [r["id"] for r in second]
    for r in first:
        assert r["id"].startswith("region_") and r["page"] == 1
    # Version salt: identical content still resolves distinct versioned ids.
    legacy = regions_from_pages(_pages_from(path, "1.0"))
    assert {r["id"] for r in first}.isdisjoint({r["id"] for r in legacy})


def test_v2_expand_growth_is_bounded_and_never_hops_to_unrelated_glyphs():
    # Band spans (10,0)-(210,4); the chain starts exactly at the band edge.
    band = [10.0, 0.0, 210.0, 4.0]
    glyphs = [[210.0, 0.5, 224.0, 3.5], [224.0, 0.2, 300.0, 3.0]]
    assert _v2_expand_over_math_glyphs(band, glyphs) is True
    assert band[2] == 300.0  # chained within the limit cap
    # A glyph with no vertical envelope cannot extend the band.
    band = [10.0, 0.0, 210.0, 4.0]
    glyphs = [[210.0, 10.0, 224.0, 14.0]]
    band_before = list(band)
    assert _v2_expand_over_math_glyphs(band, glyphs) is False
    assert band == band_before
    # A single hop beyond the bounded limit is refused.
    band = [10.0, 0.0, 210.0, 4.0]
    glyphs = [[210.0, 0.5, 340.0, 3.5]]
    assert _v2_expand_over_math_glyphs(band, glyphs) is False
    assert band[2] == 210.0


def test_v1_still_matches_published_reference_output():
    """Historical extractions must stay reproducible: V1 output is frozen."""
    frozen = regions_from_pages(_pages_from(PDF, "1.0"))
    assert sum(1 for r in frozen if r["type"] == "math") == 85
    assert len(frozen) == 510
    assert any(r["id"] == "region_42116d94dec3d2a81d58" for r in frozen)
    # Re-running yields the identical identity set.
    assert [r["id"] for r in regions_from_pages(_pages_from(PDF, "1.0"))] == [
        r["id"] for r in frozen
    ]
