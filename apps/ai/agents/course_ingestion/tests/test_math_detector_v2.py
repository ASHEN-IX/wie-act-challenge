"""Versioned detector evidence; mathematical correctness remains unverified."""
import hashlib
import json
import unicodedata
from pathlib import Path

import fitz
import pytest

from agents.course_ingestion.extraction.layout import regions_from_pages
from agents.course_ingestion.extraction.pdf_loader import extract_pages_from_pdf_sandboxed
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
    for before, after in zip(legacy, updated):
        for region in before['regions']:
            text = region['text']
            if text.strip():
                assert any(text in r['text'] for r in after['regions'])
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
