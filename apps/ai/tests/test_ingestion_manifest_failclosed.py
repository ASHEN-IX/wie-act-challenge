"""Batch 4 release-integrity: a revision-bound ingestion must not degrade.

`_parse_stage` chose its extraction path with:

    if db is not None and request.revisionId:   # build the manifest
        ...
    if manifest:                                # source-aware parser
        ...
    else:                                       # legacy text parser
        all_sections.extend(detect_sections(text))

When the database was unavailable (`db is None`), the manifest was never built,
the condition failed, and a *modern* revision-bound request silently took the
legacy branch. That branch cannot produce chapters or source regions, so the
resulting artifact lost chapter identity, source-region provenance, extraction
review and formula review — and was still publishable. A former Batch 3 QA run
hit exactly this: `ingest_parse_path=legacy` for a revision that required the
manifest.

The correction fails closed: a request carrying `revisionId` with no manifest
is refused. Genuinely legacy documents (no `revisionId`) keep working.
"""

from types import SimpleNamespace

import pytest

import workers.ingestion_worker as ingestion_worker
from messaging.failures import TerminalError

# `_parse_stage` imports these inside the function body, so they must be patched
# at their defining module rather than on the worker module.
import agents.course_ingestion.parsing.layout_parser as layout_parser
import agents.course_ingestion.parsing.section_builder as section_builder


def request(revision_id=None, files=None):
    return SimpleNamespace(
        courseId="0123456789abcdef01234567",
        revisionId=revision_id,
        files=files or [],
        fileRef=None,
    )


def worker():
    """Build the worker without its constructor's external dependencies."""
    instance = object.__new__(ingestion_worker.IngestionWorker)
    instance._course_title = "Course"
    return instance


MODERN = request(revision_id="rev_1")


class TestRevisionBoundIngestionFailsClosed:
    def test_refuses_when_the_manifest_is_missing(self):
        with pytest.raises(TerminalError) as raised:
            worker()._parse_stage(MODERN, None)
        assert "manifest unavailable" in str(raised.value).lower()

    def test_does_not_fall_back_to_the_legacy_parser(self, monkeypatch):
        """The legacy parser must not run at all for a revision-bound request."""
        called = []
        monkeypatch.setattr(
            layout_parser, "detect_sections", lambda text: called.append(text) or []
        )
        with pytest.raises(TerminalError):
            worker()._parse_stage(MODERN, None)
        assert called == [], "legacy parser ran for a revision-bound ingestion"

    def test_refusal_is_terminal_not_retryable(self):
        """A missing manifest is a deployment fault, not a transient one.

        Retrying would re-run the same degraded path once storage recovered,
        which is precisely the silent downgrade this guard prevents.
        """
        with pytest.raises(TerminalError):
            worker()._parse_stage(MODERN, None)


class TestLegacyDocumentsRemainSupported:
    def test_a_document_without_a_revision_uses_the_legacy_parser(self, monkeypatch):
        """No `revisionId` means a genuinely legacy document — supported."""
        sections = [{"title": "Intro", "text": "Hello", "lessons": []}]
        monkeypatch.setattr(layout_parser, "detect_sections", lambda text: sections)
        monkeypatch.setattr(section_builder, "build_subtopics", lambda s: s)

        instance = worker()
        monkeypatch.setattr(
            instance,
            "_resolve_path",
            lambda meta, file_ref: "/tmp/legacy.txt",
        )
        monkeypatch.setattr(instance, "_extract_text", lambda meta, path: "Hello")

        subtopics, count, files = instance._parse_stage(
            request(files=[SimpleNamespace(path="/tmp/legacy.txt", filename="legacy.txt")]),
            None,
        )
        assert count == 1
        assert files == ["/tmp/legacy.txt"]
        assert subtopics[0]["title"] == "Intro"

    def test_a_revision_bound_request_with_a_manifest_uses_the_source_parser(self, monkeypatch):
        """The modern path is unchanged when the manifest is present."""
        import agents.course_ingestion.parsing.semantic_structure as semantic
        import services.vector_store.revision_artifacts as artifacts

        monkeypatch.setattr(artifacts, "extract_documents", lambda m: (["body"], [{"page": 1}]))
        monkeypatch.setattr(artifacts, "original_path", lambda d: "source.pdf")
        monkeypatch.setattr(
            semantic,
            "detect_sections_with_sources",
            lambda pairs: [{"title": "Chapter 1", "lessons": []}],
        )
        monkeypatch.setattr(section_builder, "build_subtopics", lambda s: s)

        manifest = {"documents": [{"storageRef": "x"}]}
        subtopics, count, files = worker()._parse_stage(MODERN, manifest)
        assert count == 1
        assert files == ["source.pdf"]
        assert subtopics[0]["title"] == "Chapter 1"
