"""Batch 4 RC: transient manifest-database outage during revision-bound ingestion.

The manifest guard fails closed. This file pins the *outage* semantics around
it, because failing closed is only half the requirement:

  * a transient outage must not publish a degraded artifact;
  * the revision must never reach the legacy parser;
  * failure must be terminal (dead-lettered), not retried in a loop that could
    duplicate ingestion once storage returns;
  * a genuinely legacy document (no `revisionId`) must still be processed.

Operator recovery is a deliberate resubmission, documented in
`reports/EDNOVA-BATCH4-PILOT-READINESS.md`. There is no automatic retry.
"""

from types import SimpleNamespace

import pytest

import workers.ingestion_worker as ingestion_worker
import agents.course_ingestion.parsing.layout_parser as layout_parser
from messaging.failures import RetryableError, TerminalError


def worker():
    instance = object.__new__(ingestion_worker.IngestionWorker)
    instance._course_title = "Course"
    return instance


class TestTransientOutage:
    """`db is None` is what a database outage looks like to the worker."""

    def test_outage_refuses_a_revision_bound_ingestion(self):
        request = SimpleNamespace(courseId="c" * 24, revisionId="rev_1", files=[], fileRef=None)
        with pytest.raises(TerminalError):
            worker()._parse_stage(request, None)

    def test_outage_never_reaches_the_legacy_parser(self, monkeypatch):
        reached = []
        monkeypatch.setattr(layout_parser, "detect_sections", lambda t: reached.append(t) or [])
        request = SimpleNamespace(courseId="c" * 24, revisionId="rev_1", files=[], fileRef=None)
        with pytest.raises(TerminalError):
            worker()._parse_stage(request, None)
        assert reached == []

    def test_failure_is_terminal_not_retryable(self):
        """Dead-letter, not retry.

        A retry would re-enter the same degraded path the moment storage
        returned, which is the silent downgrade the guard exists to prevent.
        `TerminalError` is the class the worker base routes to the DLQ instead
        of re-publishing for retry.
        """
        request = SimpleNamespace(courseId="c" * 24, revisionId="rev_1", files=[], fileRef=None)
        with pytest.raises(TerminalError) as raised:
            worker()._parse_stage(request, None)
        assert not isinstance(raised.value, RetryableError)

    def test_no_partial_artifact_is_returned(self):
        """No subtopics escape: the caller gets an exception, never a result."""
        request = SimpleNamespace(courseId="c" * 24, revisionId="rev_1", files=[], fileRef=None)
        with pytest.raises(TerminalError):
            result = worker()._parse_stage(request, None)
            pytest.fail(f"returned a degraded artifact: {result!r}")


class TestLegacyStillWorksDuringOutage:
    """A legacy document does not depend on the manifest, so an outage must not
    block it. This is the compatibility half of the guard."""

    def test_legacy_document_processes_while_the_manifest_store_is_down(self, monkeypatch):
        import agents.course_ingestion.parsing.section_builder as sb

        monkeypatch.setattr(
            layout_parser,
            "detect_sections",
            lambda text: [{"title": "Intro", "text": text, "lessons": []}],
        )
        monkeypatch.setattr(sb, "build_subtopics", lambda s: s)

        instance = worker()
        monkeypatch.setattr(instance, "_resolve_path", lambda m, r: "/tmp/legacy.txt")
        monkeypatch.setattr(instance, "_extract_text", lambda m, p: "Hello")

        request = SimpleNamespace(
            courseId="c" * 24,
            revisionId=None,  # legacy: no manifest required
            files=[SimpleNamespace(path="/tmp/legacy.txt", filename="legacy.txt")],
            fileRef=None,
        )
        subtopics, count, files = instance._parse_stage(request, None)
        assert count == 1
        assert subtopics[0]["title"] == "Intro"
