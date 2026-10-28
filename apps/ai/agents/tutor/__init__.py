"""Tutor package for course-grounded Q&A and verification (ED-10)."""
from agents.tutor.grounding import (
    TutorQuestionInput,
    TutorAnswerResult,
    CitationResult,
    answer_grounded_question,
    verify_citations,
)

__all__ = [
    "TutorQuestionInput",
    "TutorAnswerResult",
    "CitationResult",
    "answer_grounded_question",
    "verify_citations",
]

