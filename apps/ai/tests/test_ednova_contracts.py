"""Same golden JSON as TypeScript: strict validation and relational parity."""
import json
from pathlib import Path
import pytest
from contracts.ednova import (CONTRACTS, parse_contract, validate_activity_context,
    validate_submission, parse_recipient, compare_attempt, validate_proposal)
from messaging.envelope import AiJobEnvelope, AiResultEnvelope
from workers.schemas import SearchRequest

FIXTURES = json.loads((Path(__file__).resolve().parents[3] / 'docs/contracts/ednova-v1-fixtures.json').read_text())["fixtures"]


def check(f):
    operation = f.get('operation')
    if operation == 'compare':
        assert compare_attempt(f['previous'], f['payload']) == f['expected']
    elif operation == 'activityContext':
        validate_activity_context(f['payload'], f['context'])
    elif operation == 'submission':
        validate_submission(f['payload'], f['definition'])
    elif operation == 'recipient':
        parse_recipient(f['contract'], f['payload'], f['recipient'])
    elif operation == 'proposal':
        validate_proposal(f['payload'], f['context'])
    else:
        parse_contract(f['contract'], f['payload'])


@pytest.mark.parametrize('fixture', FIXTURES, ids=lambda f: f['name'])
def test_shared_fixture(fixture):
    if fixture['valid']:
        check(fixture)
        parsed = parse_contract(fixture['contract'], fixture['payload'])
        assert parse_contract(fixture['contract'], json.loads(json.dumps(parsed))) == parsed
    else:
        with pytest.raises(ValueError):
            check(fixture)


def test_h2_revision_identity_is_a_course_scoped_tag():
    context = next(f['payload'] for f in FIXTURES if f['name'] == 'authorized published context')
    activity = next(f['payload'] for f in FIXTURES if f['name'] == 'interactive quiz')
    assert context['revisionId'] == 'rev_synthetic_1'
    with pytest.raises(ValueError):
        validate_activity_context({**activity, 'revisionId': 'rev_other'}, context)
    internal_id = next(f['payload'] for f in FIXTURES if f['name'] == 'resolution internal persistence id rejected')
    with pytest.raises(ValueError):
        parse_contract('SourceResolution', internal_id)


def test_t1_does_not_make_a_global_attempt_id_the_receipt_identity():
    submission = next(f['payload'] for f in FIXTURES if f['name'] == 'private submission')
    def attempt(user_id):
        return {
            'schemaVersion': '1.0.0',
            'visibility': 'recipient_only',
            'userId': user_id,
            'submission': submission,
            'status': 'submitted',
            'submittedAt': '2026-10-23T12:00:00.000Z',
            'payloadHash': 'sha256:' + 'a' * 64,
        }
    assert parse_recipient('PrivateAttempt', attempt('learner_a'), 'learner_a')
    assert parse_contract('PrivateAttempt', attempt('learner_b'))
    with pytest.raises(ValueError):
        parse_recipient('PrivateAttempt', attempt('learner_b'), 'learner_a')


def test_t3_accepts_max_bounded_private_guidance_and_rejects_overflow():
    graded = next(f['payload'] for f in FIXTURES if f['name'] == 'private graded result')
    bounded = {
        **graded,
        'socraticHint': 'a' * 8000,
        'recommendedNextStep': {
            'type': 'advance',
            'nextObjectiveId': 'obj_next',
            'title': 't' * 200,
        },
    }
    assert parse_contract('AssessmentResult', bounded)
    with pytest.raises(ValueError):
        parse_contract('AssessmentResult', {**bounded, 'socraticHint': 'a' * 8001})


def test_timestamps_require_ascii_digits():
    context = next(f['payload'] for f in FIXTURES if f['name'] == 'authorized published context')
    with pytest.raises(ValueError):
        parse_contract('PublishedContext', {**context, 'publishedAt': '٢٠٢٦-10-23T12:00:00.000Z'})


def test_all_definitions_have_golden_examples():
    assert set(CONTRACTS) == {f['contract'] for f in FIXTURES if f['valid']}


def test_existing_worker_envelope_and_payload():
    base = dict(messageId='7c9e6679-7425-40de-944b-e07fc1f90ae7', correlationId='0f8e2d1a-3b4c-4d6e-8f80-91a2b3c4d5e6', type='study.search.query', version='1', requestId='synthetic_request', timestamp='2026-10-23T12:00:00.000Z')
    AiJobEnvelope.model_validate({**base, 'userId': 'learner_synthetic', 'payload': {'query': 'Synthetic query'}})
    SearchRequest.model_validate({'query': 'Synthetic query'})
    AiResultEnvelope.model_validate({**base, 'status': 'completed', 'payload': {'answer': 'Synthetic response'}})
    with pytest.raises(ValueError):
        AiJobEnvelope.model_validate({**base, 'type': 'activity.accept.evidence', 'userId': 'learner_synthetic', 'payload': {}})


def test_exported_json_schema_has_no_drift():
    from contracts.export_ednova_schema import schema_document
    artifact = Path(__file__).resolve().parents[3] / 'docs/contracts/ednova-v1.schema.json'
    assert json.loads(artifact.read_text()) == schema_document()

    context = next(f['payload'] for f in FIXTURES if f['name'] == 'authorized published context')
    with pytest.raises(ValueError):
        parse_contract('PublishedContext', {**context, 'publishedAt': '0000-01-01T00:00:00.000Z'})
