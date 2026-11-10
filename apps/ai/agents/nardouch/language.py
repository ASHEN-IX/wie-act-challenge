"""Reusable language policy. Detection is a hint; explicit preferences win."""

import json
import re
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict


class LanguagePreference(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    language: Literal["auto", "darija", "fr", "en", "mixed"] = "auto"
    script: Literal["auto", "arabizi", "arabic"] = "auto"


def language_instruction(preference: LanguagePreference, text: str) -> str:
    language = preference.language
    if language == "auto":
        if re.search(r"[\u0600-\u06ff]", text):
            language = "darija"
        elif re.search(
            r"\b(mafhemtech|tnajem|fasserli|fassarheli|chnowa|bech|3lech|derja|derja|n7eb)\b",
            text,
            re.I,
        ):
            language = "darija"
        else:
            language = "match the student's current language and code-switching"
    script = preference.script
    if script == "auto":
        script = "arabic" if re.search(r"[\u0600-\u06ff]", text) else "arabizi"
    script_rule = (
        "arabizi writing: Latin letters with digits for Arabic sounds (3, 7, 9), never Arabic script"
        if script == "arabizi"
        else "arabic script (Arabic letters)"
    )
    glossary = json.loads(Path(__file__).with_name("glossary.json").read_text())
    return (
        f"Response language: {language}. For Darija use {script_rule}. "
        "Honor explicit language requests and word corrections in the conversation. "
        "Allow natural French/English code-switching; preserve scientific terms, symbols, "
        "identifiers and code exactly. Do not invent dialect expressions; ask a short "
        "clarification if a word is unclear. Do not transliterate code. "
        f"Terminology to preserve when used: {json.dumps(glossary, ensure_ascii=False)}"
    )
