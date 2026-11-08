"""Strict request/response contracts for the course draft reviewer.

The reviewer may only *rename* chapters and lessons and *rewrite objectives*. It
cannot add, remove, merge or reorder structure and cannot touch source text, so
every id in a proposal must already exist in the request.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Language = Literal["en", "fr", "ar", "ary"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LessonIn(_Strict):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(max_length=400)
    excerpt: str = Field(default="", max_length=1500)
    objectives: list[str] = Field(default_factory=list, max_length=8)


class ChapterIn(_Strict):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(max_length=400)
    lessons: list[LessonIn] = Field(max_length=40)


class ReviewRequest(_Strict):
    courseTitle: str = Field(min_length=1, max_length=300)
    language: Language = "en"
    chapters: list[ChapterIn] = Field(min_length=1, max_length=30)


class ChapterOut(_Strict):
    id: str
    title: str = Field(min_length=3, max_length=120)


class LessonOut(_Strict):
    id: str
    title: str = Field(min_length=3, max_length=120)
    objectives: list[str] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def _objectives_bounded(self) -> "LessonOut":
        for text in self.objectives:
            if not 12 <= len(text.strip()) <= 240:
                raise ValueError("objective length out of range")
        return self


class Proposal(_Strict):
    chapters: list[ChapterOut] = Field(max_length=30)
    lessons: list[LessonOut] = Field(max_length=200)
    notes: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _notes_bounded(self) -> "Proposal":
        if any(len(n) > 300 for n in self.notes):
            raise ValueError("note too long")
        return self


class ReviewResponse(_Strict):
    status: Literal["proposed", "unavailable", "invalid"]
    proposal: Proposal | None = None
    reason: str = ""
    executionMode: Literal["REAL_APPROVED", "MOCK_TEST", "DETERMINISTIC_FALLBACK", "UNAVAILABLE"]
