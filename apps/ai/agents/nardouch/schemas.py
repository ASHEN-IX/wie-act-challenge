from typing import Literal
from pydantic import Field
from agents.tutor.grounding import StrictModel, TutorQuestionInput, CitationResult
from .language import LanguagePreference

SpeechLanguage = Literal["ar", "fr", "en"]
Mode = Literal["explain", "socratic", "practice", "peer"]


class Turn(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class TurnRequest(StrictModel):
    grounding: TutorQuestionInput
    mode: Mode = "explain"
    language: LanguagePreference = Field(default_factory=LanguagePreference)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    objective: str = Field(default="", max_length=2000)
    traceId: str = Field(pattern=r"^[a-f0-9-]{36}$")


class GeneratedAnswer(StrictModel):
    displayText: str = Field(min_length=1, max_length=12000)
    speechText: str | None = Field(default=None, max_length=600)
    speechLanguage: SpeechLanguage | None = None
    sourceIds: list[int] = Field(max_length=5)
    followups: list[str] = Field(max_length=3)


class TurnResponse(StrictModel):
    displayText: str
    speechText: str
    speechLanguage: SpeechLanguage | None = None
    followups: list[str]
    citations: list[CitationResult]
    evidenceStatus: Literal["source_linked", "missing_context"]
    mode: Mode
    language: LanguagePreference
    usage: dict
