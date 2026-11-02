import json
import pytest
from pydantic import ValidationError

from agents.course_ingestion.enrichment.recognition_proposal import SourceReference, create_proposal


def source():
    return SourceReference(document_id="doc_" + "a" * 16, revision_id="revision-1", source_sha256="sha256:" + "b" * 64, region_id="region_" + "c" * 20, page=1, bbox=(1., 2., 30., 40.))


def response(**updates):
    value = {"status": "proposed", "representation": "latex", "content": r"x^{2}", "uncertainty": []}
    return json.dumps({**value, **updates})


def test_proposal_is_source_bound_and_never_verified():
    proposal = create_proposal(response(), source=source(), provider="gemini", model="example")
    assert proposal["source"]["region_id"] == source().region_id
    assert proposal["review_disposition"] == "pending"
    assert proposal["validation"]["mathematical_correctness"] == "not_verified"
    assert proposal["proposal_sha256"] == create_proposal(response(), source=source(), provider="gemini", model="example")["proposal_sha256"]


def test_untrusted_identity_and_review_are_rejected():
    with pytest.raises(ValidationError):
        create_proposal(response(review_disposition="accepted"), source=source(), provider="gemini", model="example")
    with pytest.raises(ValidationError):
        create_proposal(response(region_id="foreign"), source=source(), provider="gemini", model="example")


def test_unresolved_and_latex_warnings_are_not_verification():
    unresolved = create_proposal(response(status="unresolved", content=""), source=source(), provider="gemini", model="example")
    assert unresolved["response"]["status"] == "unresolved"
    warned = create_proposal(response(content=r"\\input{secret"), source=source(), provider="gemini", model="example")
    assert set(warned["validation"]["syntax_warnings"]) == {"unbalanced_braces", "unsupported_latex_command"}


def test_limits_and_geometry():
    with pytest.raises(ValueError):
        create_proposal("x" * 32769, source=source(), provider="gemini", model="example")
    with pytest.raises(ValidationError):
        SourceReference.model_validate({**source().model_dump(), "bbox": (3., 2., 1., 4.)})
