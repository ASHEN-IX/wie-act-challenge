import pytest
from agents.course_ingestion.tests.test_region_crop import _manifest
from services.vector_store.revision_artifacts import extract_documents, canonical_units_for_index


def test_reviewed_formula_index_retains_source_binding_and_disposition(tmp_path, monkeypatch):
    manifest = _manifest(tmp_path, monkeypatch)
    chunks, metas = extract_documents(manifest)
    meta = metas[0]
    review = {'state': 'accepted', 'proposalIdentity': 'sha256:' + 'a' * 64,
              'documentHash': meta['content_hash'], 'cropHash': 'sha256:' + 'b' * 64, 'reviewer': 'fixture'}
    unit = {'text': 'Instructor-reviewed representation: x=1\nOriginal extraction: x1',
            'documentIds': [meta['document_id']], 'blockIds': ['block'], 'chunkIds': [meta['chunk_id']],
            'lessonId': 'lesson', 'formulaReview': review}
    texts, indexed = canonical_units_for_index(manifest, [unit])
    assert texts == [unit['text']]
    assert indexed[0]['representation'] == 'instructor_reviewed'
    assert indexed[0]['formula_review'] == review
    assert indexed[0]['revision_id'] == manifest['revisionId']
    with pytest.raises(ValueError):
        canonical_units_for_index(manifest, [{**unit, 'chunkIds': ['foreign']}])
    with pytest.raises(ValueError):
        canonical_units_for_index(manifest, [{**unit, 'formulaReview': {**review, 'state': 'pending'}}])
