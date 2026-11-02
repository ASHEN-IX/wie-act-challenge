"""Keep the review set linked to source bytes and valid crop geometry."""
import hashlib
import json
from pathlib import Path
import fitz

ROOT = Path(__file__).parents[1] / 'extraction' / 'benchmarks'


def test_formula_samples_have_valid_source_geometry_and_pending_review():
    data = json.loads((ROOT / 'formula/dataset.json').read_text())
    pdf_path = ROOT / data['source']
    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    assert data['region_count'] == 85
    assert len(data['cases']) == 16
    with fitz.open(pdf_path) as pdf:
        for case in data['cases']:
            assert case['document_sha256'] == digest
            assert case['annotation_status'] == 'pending_review'
            assert case['reviewer'] is None
            page = pdf[case['page'] - 1]
            bbox = fitz.Rect(case['region_bbox'])
            assert not bbox.is_empty and page.rect.contains(bbox)
            crop = ROOT / 'formula' / case['crop']
            assert crop.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')


def test_pending_annotations_are_not_claimed_as_verified():
    data = json.loads((ROOT / 'formula/annotations.pending.json').read_text())
    assert data['status'] == 'pending_review'
    assert data['reviewer'] is None
    assert len(data['annotations']) >= 8
