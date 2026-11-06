"""Conservative pronunciation formatting; never modifies stored educational text.

Only deterministic, unambiguous initialisms are expanded. Arabizi and formulas remain
unchanged: automatic transliteration could change identifiers or mathematical meaning.
"""

import re

PRONUNCIATIONS = {"LIFO": "L I F O", "FIFO": "F I F O"}


def adapt_for_speech(text):
    return re.sub(r"\b(LIFO|FIFO)\b", lambda m: PRONUNCIATIONS[m[0]], text)


def prepare_piper_text(text):
    """No Arabizi guessing. Unreviewed glossary entries are documentation only."""
    import json
    from pathlib import Path
    from .voice import VoiceUnavailable

    if not re.search(r"[\u0600-\u06ff]", text) or "[[" in text or "```" in text:
        raise VoiceUnavailable(
            "This answer has no reliable Arabic speech form; read the original text."
        )
    entries = json.loads(
        Path(__file__).with_name("pronunciation_glossary.json").read_text()
    )
    for entry in entries:
        if entry["nativeSpeakerReviewed"] and entry["meaningReviewed"]:
            text = re.sub(
                r"(?<![\w])" + re.escape(entry["display"]) + r"(?![\w])",
                lambda _: entry["speech"],
                text,
            )
    return text
