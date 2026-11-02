import json
import pytest

from agents.course_ingestion.enrichment.recognition_proposal import SourceReference
from agents.course_ingestion.enrichment.recognition_provider import RecognitionRequest, RecognitionResult, project_proposal


def source():
    return SourceReference(document_id='doc_' + 'a' * 16, revision_id='rev-1',
        source_sha256='sha256:' + 'b' * 64, region_id='region_' + 'c' * 20,
        page=1, bbox=(1., 2., 3., 4.))


def result():
    return RecognitionResult(json.dumps({'status': 'proposed', 'representation': 'latex',
        'content': 'x^2', 'uncertainty': []}), 'gemini', 'example', 'v1')


def request(course='course-1', image=b'\x89PNG\r\n\x1a\nexample'):
    return RecognitionRequest(source(), course, image, 'x2')


def test_proposal_is_bound_to_course_revision_crop_and_model():
    first = project_proposal(request(), result())
    assert first['review_disposition'] == 'pending'
    assert first['validation']['mathematical_correctness'] == 'not_verified'
    assert first['proposal_sha256'] != project_proposal(request('course-2'), result())['proposal_sha256']
    assert first['proposal_sha256'] != project_proposal(request(image=b'\x89PNG\r\n\x1a\nother'), result())['proposal_sha256']
    changed = RecognitionRequest(source().model_copy(update={'revision_id': 'rev-2'}), 'course-1', request().image_png, 'x2')
    assert first['proposal_sha256'] != project_proposal(changed, result())['proposal_sha256']


def test_bad_crop_is_rejected():
    with pytest.raises(ValueError):
        request(image=b'not a png')
