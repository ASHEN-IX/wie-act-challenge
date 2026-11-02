"""Authorized, manifest-bound source crop validation."""

from pathlib import Path

import fitz
from fastapi import HTTPException

from services.api.routers.sources import RegionCropRequest, region_crop
from services.vector_store.revision_artifacts import byte_hash, manifest_digest


def _manifest(tmp_path, monkeypatch, pages=2):
    source = fitz.open()
    for number in range(pages):
        page = source.new_page()
        page.insert_text((72, 72), f"Page {number + 1}")
        if number == 1:
            page.draw_line((120, 120), (360, 120), width=0.4)
            page.draw_line((120, 300), (360, 300), width=0.4)
            page.draw_line((120, 120), (120, 300), width=0.4)
            page.draw_line((360, 120), (360, 300), width=0.4)
    original = tmp_path / "source.pdf"
    source.save(original)
    source.close()
    value = original.read_bytes()
    digest = byte_hash(value)
    root = tmp_path / "uploads"
    (root / "originals").mkdir(parents=True)
    (root / "originals" / digest[7:]).write_bytes(value)
    monkeypatch.setenv("INGEST_UPLOADS_DIR", str(root))
    manifest = {
        "courseId": "a" * 24,
        "revisionId": "rev_crop",
        "contentHash": digest,
        "documents": [{
            "documentId": "doc_" + "b" * 16,
            "storageRef": "originals/" + digest[7:],
            "contentHash": digest,
            "mediaType": "application/pdf",
        }],
    }
    manifest["manifestDigest"] = manifest_digest(manifest)
    return manifest


def test_crop_requires_a_verified_figure_region(tmp_path, monkeypatch):
    manifest = _manifest(tmp_path, monkeypatch)
    from services.vector_store.revision_artifacts import source_regions

    figures = [region for region in source_regions(manifest).values() if region["type"] == "figure"]
    assert len(figures) == 1
    request = RegionCropRequest(
        schemaVersion="1.0.0",
        **manifest,
        documentId=manifest["documents"][0]["documentId"],
        regionId=figures[0]["id"],
    )
    response = region_crop(request)
    assert response.media_type == "image/png"
    assert response.body.startswith(b"\x89PNG\r\n\x1a\n")
    assert response.headers["cache-control"] == "private, no-store"


def test_crop_rejects_foreign_region_and_forged_manifest(tmp_path, monkeypatch):
    manifest = _manifest(tmp_path, monkeypatch)
    try:
        region_crop(RegionCropRequest(
            schemaVersion="1.0.0", **manifest,
            documentId=manifest["documents"][0]["documentId"],
            regionId="region_" + "f" * 20,
        ))
    except HTTPException as error:
        assert error.status_code == 404
    else:
        raise AssertionError("foreign region was accepted")
    forged = {**manifest, "manifestDigest": "sha256:" + "0" * 64}
    try:
        region_crop(RegionCropRequest(
            schemaVersion="1.0.0", **forged,
            documentId=manifest["documents"][0]["documentId"],
            regionId="region_" + "f" * 20,
        ))
    except HTTPException as error:
        assert error.status_code == 503
    else:
        raise AssertionError("forged manifest was accepted")


def test_crop_accepts_math_but_rejects_invalid_geometry(tmp_path, monkeypatch):
    manifest = _manifest(tmp_path, monkeypatch)
    import services.api.routers.sources as sources

    region_id = 'region_' + 'a' * 20
    region = {'id': region_id, 'type': 'math', 'documentId': manifest['documents'][0]['documentId'],
              'page': 1, 'bbox': [60.0, 60.0, 180.0, 90.0]}
    monkeypatch.setattr(sources, 'source_regions', lambda _: {region_id: region})
    request = RegionCropRequest(schemaVersion='1.0.0', **manifest,
        documentId=manifest['documents'][0]['documentId'], regionId=region_id)
    assert region_crop(request).body.startswith(b'\x89PNG\r\n\x1a\n')
    region['bbox'] = [float('nan'), 60.0, 180.0, 90.0]
    try:
        region_crop(request)
    except HTTPException as error:
        assert error.status_code == 422
    else:
        raise AssertionError('non-finite geometry was accepted')


def test_region_inspection_binds_crop_and_rejects_nonmath(tmp_path, monkeypatch):
    import services.api.routers.sources as sources
    manifest = _manifest(tmp_path, monkeypatch)
    region_id = 'region_' + 'b' * 20
    region = {'id': region_id, 'type': 'math', 'documentId': manifest['documents'][0]['documentId'],
              'page': 1, 'bbox': [60.0, 60.0, 180.0, 90.0], 'text': 'x = 1'}
    monkeypatch.setattr(sources, 'source_regions', lambda _: {region_id: region})
    request = RegionCropRequest(schemaVersion='1.0.0', **manifest,
        documentId=manifest['documents'][0]['documentId'], regionId=region_id)
    result = sources.region_inspect(request)
    assert result['documentHash'] == manifest['documents'][0]['contentHash']
    assert result['text'] == 'x = 1'
    assert result['cropHash'].startswith('sha256:')
    region['type'] = 'paragraph'
    try:
        sources.region_inspect(request)
    except HTTPException as error:
        assert error.status_code == 422
    else:
        raise AssertionError('non-math region was accepted')


def test_mock_proposal_requires_explicit_test_mode(tmp_path, monkeypatch):
    import services.api.routers.sources as sources
    manifest = _manifest(tmp_path, monkeypatch)
    region_id = 'region_' + 'b' * 20
    region = {'id': region_id, 'type': 'math', 'documentId': manifest['documents'][0]['documentId'],
              'page': 1, 'bbox': [60.0, 60.0, 180.0, 90.0], 'text': 'x = 1'}
    monkeypatch.setattr(sources, 'source_regions', lambda _: {region_id: region})
    req = RegionCropRequest(schemaVersion='1.0.0', **manifest,
        documentId=manifest['documents'][0]['documentId'], regionId=region_id)
    monkeypatch.setenv('NODE_ENV', 'production')
    monkeypatch.setenv('FORMULA_MOCK_PROVIDER', '1')
    try:
        sources.validate_formula_proposal(req)
    except HTTPException as error:
        assert error.status_code == 404
    else:
        raise AssertionError('mock enabled in production')
    monkeypatch.setenv('NODE_ENV', 'test')
    result = sources.validate_formula_proposal(req)
    assert result['proposal']['review_disposition'] == 'pending'
    assert result['proposal']['response']['content'] == 'x^2'


def test_crop_renderer_limits_timeout_and_output(tmp_path, monkeypatch):
    import subprocess
    from types import SimpleNamespace
    from agents.course_ingestion.extraction import pdf_loader
    calls = []
    def timed(*args, **kwargs):
        calls.append((args, kwargs))
        raise subprocess.TimeoutExpired(args[0], kwargs['timeout'])
    monkeypatch.setattr(pdf_loader.subprocess, 'run', timed)
    import pytest
    with pytest.raises(pdf_loader.PdfParseTimeoutError):
        pdf_loader.render_region_sandboxed('not-opened.pdf', 1, [0, 0, 20, 20])
    assert calls[0][1]['timeout'] == 12
    assert '--crop' in calls[0][0][0] and '-I' in calls[0][0][0]
    def oversized(*args, **kwargs):
        kwargs['stdout'].write(b'\x89PNG\r\n\x1a\n' + b'x' * (4 * 1024 * 1024))
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(pdf_loader.subprocess, 'run', oversized)
    with pytest.raises(pdf_loader.PdfParseLimitError):
        pdf_loader.render_region_sandboxed('not-opened.pdf', 1, [0, 0, 20, 20])


def test_math_context_recovers_adjacent_glyphs_without_changing_exact_crop():
    import json
    from agents.course_ingestion.extraction.pdf_loader import _math_context_bbox, render_region_sandboxed

    base = Path(__file__).parents[1] / "extraction" / "benchmarks"
    cases = json.loads((base / "formula" / "dataset.json").read_text())["cases"]
    case = next(item for item in cases if item["id"] == "eq-001")
    pdf = base / "reference-course.pdf"
    with fitz.open(pdf) as doc:
        page = doc[case["page"] - 1]
        before = case["region_bbox"]
        after = _math_context_bbox(page, before)
        assert after[2] >= 346.14  # original PDF's final summand and punctuation
        assert after[2] - before[2] <= 24
        assert after[1] == before[1] and after[3] == before[3]
        assert page.rect.contains(fitz.Rect(after))
        # The next prose paragraph starts lower and must not be absorbed.
        assert after[3] < 490
    original = render_region_sandboxed(str(pdf), case["page"], before)
    contextual = render_region_sandboxed(str(pdf), case["page"], before, math_context=True)
    assert original != contextual
    assert original.startswith(b"\x89PNG") and contextual.startswith(b"\x89PNG")
    assert original == render_region_sandboxed(str(pdf), case["page"], before, math_context=False)


def test_reference_formula_region_ids_remain_resolvable():
    import json
    from agents.course_ingestion.extraction.pdf_loader import extract_pages_from_pdf_sandboxed
    from agents.course_ingestion.extraction.layout import regions_from_pages

    base = Path(__file__).parents[1] / "extraction" / "benchmarks"
    cases = json.loads((base / "formula" / "dataset.json").read_text())["cases"]
    regions = regions_from_pages(extract_pages_from_pdf_sandboxed(str(base / "reference-course.pdf")))
    by_id = {region["id"]: region for region in regions}
    for case in cases:
        region = by_id[case["region_id"]]
        assert region["page"] == case["page"]
        assert region["bbox"] == case["region_bbox"]


def test_context_view_is_opt_in_and_keeps_exact_recognition_crop(tmp_path, monkeypatch):
    from services.api.routers import sources
    from agents.course_ingestion.extraction import pdf_loader

    manifest = _manifest(tmp_path, monkeypatch)
    rid = "region_" + "a" * 20
    document_id = manifest["documents"][0]["documentId"]
    monkeypatch.setattr(sources, "source_regions", lambda _: {
        rid: {"documentId": document_id, "page": 1, "bbox": [1, 1, 20, 20], "type": "math"}
    })
    calls = []
    def render(_path, _page, _bbox, **kwargs):
        calls.append(kwargs)
        return b"\x89PNG\r\n\x1a\n"
    monkeypatch.setattr(pdf_loader, "render_region_sandboxed", render)
    args = dict(schemaVersion="1.0.0", **manifest, documentId=document_id, regionId=rid)
    region_crop(RegionCropRequest(**args))
    region_crop(RegionCropRequest(**args, view="math_context"))
    sources.region_inspect(RegionCropRequest(**args, view="math_context"))
    assert calls == [{}, {"math_context": True}, {}]


def test_context_limits_growth_and_ignores_prose_font_at_page_edge():
    from agents.course_ingestion.extraction.pdf_loader import _math_context_bbox

    class Page:
        rect = fitz.Rect(0, 0, 100, 100)
        def get_text(self, *_args, **_kwargs):
            return {"blocks": [{"lines": [{"spans": [
                {"font": "CMMI10", "chars": [{"c": "x", "bbox": [96, 10, 99.8, 20]}]},
                {"font": "Times-Roman", "chars": [{"c": "a", "bbox": [91, 10, 95, 20]}]},
            ]}]}]}

    # The adjacent mathematical glyph is included and clipped to the page;
    # an ordinary-font word on the other edge is not absorbed as context.
    assert _math_context_bbox(Page(), [95, 10, 96, 20]) == [95.0, 10, 100.0, 20]
