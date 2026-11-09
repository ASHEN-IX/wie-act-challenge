"""Three-crop Gemini research harness; never called by ingestion or publication.

Requires a fresh operator-created, key-bound free-tier attestation AND the
shared LLM operator approval and durable budget. No fallback calls.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import stat
import time
from pathlib import Path

from agents.course_ingestion.enrichment.recognition_proposal import SourceReference, create_proposal
from utils import llm_client

ALIAS = "course_multimodal_prototype"
SOURCE_HASH = "ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02"
DATASET_HASH = "9011cdc2c0d8c6362ca4c587067b4713828136bd7cfe5023ecb3a048da81b2cf"
CASE_IDS = ("eq-000", "eq-063", "eq-017")
MAX_OUTPUT_TOKENS = 512
# Conservative accounting reservation, not a provider-enforced input cap.
RESERVED_TOKENS = 65536
DATA = Path(__file__).resolve().parents[1] / "extraction/benchmarks/formula"
PDF = DATA.parent / "reference-course.pdf"
PROMPT = ("Transcribe only the mathematical expression visible in the image. "
          "Preserve all symbols, bounds and ordering. Do not infer missing content. "
          "If the crop is incomplete or ambiguous, return unresolved with empty content. "
          "Return JSON status, representation, content, uncertainty; representation is latex.")


class ResearchUnavailable(RuntimeError):
    pass


def _hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _check_attestation(path: Path, key: str, now: float | None = None) -> None:
    """Validate operator-created evidence; this is not a provider billing API."""
    now = time.time() if now is None else now
    try:
        if path.is_symlink():
            raise ValueError()
        s = path.stat()
        if not stat.S_ISREG(s.st_mode) or s.st_uid != os.geteuid() or s.st_mode & 0o077:
            raise ValueError()
        evidence = json.loads(path.read_text())
        checked = float(evidence["checked_at_unix"])
        if (evidence["free_tier"] is not True or evidence["billing_attached"] is not False
            or evidence["source_sha256"] != SOURCE_HASH
            or evidence["key_sha256"] != _hash(key.encode())
            or not isinstance(evidence["project_id"], str) or not evidence["project_id"]
            or not isinstance(evidence["verified_by"], str) or not evidence["verified_by"]
            or not 0 <= now - checked <= 3600
            or evidence["owner_consent"] is not True):
            raise ValueError()
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
        raise ResearchUnavailable("Fresh owner and free-tier evidence unavailable") from None


def _reserve_tokens(approval: dict) -> bool:
    """Reserve a conservative token allowance in the existing budget.

    The API owns the ledger and makes the reservation atomic; anything but a
    clear yes denies the call.
    """
    if type(approval.get("maxTokens")) is not int or approval["maxTokens"] < RESERVED_TOKENS:
        return False
    from services import api_service

    return api_service.budget_reserve_tokens(approval, RESERVED_TOKENS)


def _load_cases():
    """Verify source, crop pixels and bounds against the pinned local PDF."""
    import fitz
    if _hash(PDF.read_bytes()) != SOURCE_HASH:
        raise ResearchUnavailable("Reference PDF integrity check failed")
    dataset_bytes = (DATA / "dataset.json").read_bytes()
    if _hash(dataset_bytes) != DATASET_HASH:
        raise ResearchUnavailable("Benchmark dataset integrity check failed")
    dataset = json.loads(dataset_bytes)
    cases = {case["id"]: case for case in dataset["cases"] if case["id"] in CASE_IDS}
    if set(cases) != set(CASE_IDS):
        raise ResearchUnavailable("Benchmark cases missing")
    out = []
    with fitz.open(PDF) as pdf:
        for case_id in CASE_IDS:
            case = cases[case_id]
            if case["document_sha256"] != SOURCE_HASH:
                raise ResearchUnavailable("Source identity mismatch")
            page = pdf[case["page"] - 1]
            bbox = fitz.Rect(case["crop_bbox"])
            if not page.rect.contains(bbox) or bbox.is_empty:
                raise ResearchUnavailable("Invalid crop bounds")
            image = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=bbox, alpha=False).tobytes("png")
            crop = DATA / "crops" / (case_id + ".png")
            if _hash(image) != _hash(crop.read_bytes()) or len(image) > 1_000_000:
                raise ResearchUnavailable("Crop integrity check failed")
            out.append((case, image))
    return out


def _run_locked(attestation: Path, output: Path) -> None:
    """Execute at most three sequential calls; abort on the first failure."""
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise ResearchUnavailable("Gemini credential unavailable")
    _check_attestation(attestation, key)
    approval = llm_client._approval(ALIAS)
    if (not approval or approval["maxRequests"] > 3 or
        type(approval.get("maxTokens")) is not int):
        raise ResearchUnavailable("Operator approval or durable budget unavailable")
    route = llm_client._deployment(ALIAS)["model"]
    if not route.startswith("gemini/") or route != approval["model"]:
        raise ResearchUnavailable("Approved model mismatch")
    cases = _load_cases()
    # O_EXCL prevents accidental overwrite of previous research results.
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with os.fdopen(fd, "w") as result_file:
            from google import genai
            from google.genai import types
            from agents.course_ingestion.enrichment.recognition_proposal import ModelResponse
            client = genai.Client(api_key=key, http_options=types.HttpOptions(
                timeout=30000, retry_options=types.HttpRetryOptions(attempts=1)))
            result_file.write(json.dumps({"status": "started", "cases": list(CASE_IDS)}) + "\n")
            result_file.flush()
            for case, image in cases:
                _check_attestation(attestation, key)
                reserved = llm_client._reserve_approved_call(ALIAS)
                if (reserved != approval or not llm_client._budget_still_active(approval)
                    or not _reserve_tokens(approval) or llm_client._approval(ALIAS) != approval
                    or not llm_client._budget_still_active(approval)):
                    raise ResearchUnavailable("Approval or budget reservation unavailable")
                try:
                    response = client.models.generate_content(
                        model=route.split("/", 1)[1],
                        contents=[PROMPT, types.Part.from_bytes(data=image, mime_type="image/png")],
                        config=types.GenerateContentConfig(temperature=0, max_output_tokens=MAX_OUTPUT_TOKENS,
                            response_mime_type="application/json", response_json_schema=ModelResponse.model_json_schema()))
                    usage = response.usage_metadata
                    tokens = getattr(usage, "total_token_count", None) if usage else None
                    if not isinstance(tokens, int) or tokens < 0 or tokens > RESERVED_TOKENS:
                        raise ResearchUnavailable("Provider token usage unavailable or exceeded reservation")
                    if llm_client._approval(ALIAS) != approval or not llm_client._budget_still_active(approval):
                        raise ResearchUnavailable("Approval revoked during inference")
                    source = SourceReference(document_id="doc_" + SOURCE_HASH[:16], revision_id="research-reference",
                        source_sha256="sha256:" + SOURCE_HASH, region_id=case["region_id"], page=case["page"],
                        bbox=tuple(float(v) for v in case["region_bbox"]))
                    proposal = create_proposal(response.text or "", source=source, provider="gemini", model=route)
                    record = {"case_id": case["id"], "crop_sha256": _hash(image), "crop_bbox": case["crop_bbox"],
                        "baseline": case["baseline_text"], "model_version": response.model_version,
                        "usage": {"total_tokens": tokens, "reserved_tokens": RESERVED_TOKENS,
                                  "provider_cost_usd": None}, "proposal": proposal}
                    result_file.write(json.dumps(record, ensure_ascii=False) + "\n")
                    result_file.flush()
                    os.fsync(result_file.fileno())
                except ResearchUnavailable:
                    raise
                except Exception:
                    # Provider errors can contain credentials or user data; never log them.
                    raise ResearchUnavailable("Provider request or response validation failed") from None
            result_file.write(json.dumps({"status": "completed"}) + "\n")
            result_file.flush()
    finally:
        # fdopen owns the descriptor after entering its context.
        try:
            os.close(fd)
        except OSError:
            pass


def run(attestation: Path, output: Path) -> None:
    """Serialize this research harness on this host, including across outputs."""
    lock_path = Path("/tmp") / f"ednova-gemini-research-{os.geteuid()}.lock"
    lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        metadata = os.fstat(lock_fd)
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.geteuid() or metadata.st_mode & 0o077:
            raise ResearchUnavailable("Research lock unavailable")
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ResearchUnavailable("Another research run is active") from None
        _run_locked(attestation, output)
    finally:
        os.close(lock_fd)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--attestation", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        run(args.attestation, args.output)
    except ResearchUnavailable as error:
        parser.exit(2, f"Research unavailable: {error}\n")
