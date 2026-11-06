"""Consented local ASR benchmark / real-model smoke. No mock inference.

Manifest: {"consent": true, "cases": [{"id":"...", "audio":"clip.wav",
"reference":"...", "languageMix":["ar-TN","fr"], "technicalTerms":["stack"]}]}
Audio paths are relative to the manifest, with the same input WAV limits as UI.
Normalization: Unicode NFC + whitespace only; retain case, punctuation, diacritics,
Arabizi digits and Arabic letter distinctions. Report this strict WER explicitly.
"""

import argparse
import base64
import json
import os
from pathlib import Path
import time
import unicodedata
from agents.nardouch.voice import TranscriptionRequest, transcribe, VoiceUnavailable
from agents.nardouch.local_speech import shutdown


def normalize(text):
    return " ".join(unicodedata.normalize("NFC", text).split())


def wer(reference, predicted):
    a, b = normalize(reference).split(), normalize(predicted).split()
    if not a:
        return None
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        current = [i]
        for j, y in enumerate(b, 1):
            current.append(
                min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (x != y))
            )
        previous = current
    return previous[-1] / len(a)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("manifest")
    p.add_argument("--output", required=True)
    args = p.parse_args()
    source = Path(args.manifest).resolve()
    data = json.loads(source.read_text())
    if data.get("consent") is not True:
        p.error("Explicit informed recording/benchmark consent required")
    rows = []
    try:
        for case in data["cases"]:
            audio = (source.parent / case["audio"]).resolve()
            if not audio.is_relative_to(source.parent):
                p.error("Audio must be within the benchmark directory")
            start = time.perf_counter()
            row = {
                **case,
                "predicted": None,
                "humanNaturalness": None,
                "humanIntelligibility": None,
                "educationalCorrectness": None,
                "semanticPreservation": None,
            }
            try:
                predicted = transcribe(
                    TranscriptionRequest(
                        audioBase64=base64.b64encode(audio.read_bytes()).decode(),
                        consent=True,
                    )
                )
                terms = case.get("technicalTerms", [])
                row.update(
                    predicted=predicted,
                    wer=wer(case["reference"], predicted),
                    technicalTermOmissionRate=(
                        sum(term not in predicted for term in terms) / len(terms)
                        if terms
                        else None
                    ),
                    status="ok",
                )
            except (VoiceUnavailable, ValueError, OSError):
                row["status"] = "unavailable"
            row["durationSeconds"] = time.perf_counter() - start
            rows.append(row)
    finally:
        shutdown()
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as out:
        json.dump(
            {
                "normalization": "NFC + whitespace only; strict case/punctuation",
                "cases": rows,
            },
            out,
            ensure_ascii=False,
            indent=2,
        )


if __name__ == "__main__":
    main()
