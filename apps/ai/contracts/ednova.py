"""ED-26 review candidate. Pydantic mirror of shared/ednova/contracts.ts.
Golden fixtures exercise both implementations; existing wire formats are unchanged.
"""
import json
import math
import re
from datetime import datetime
from typing import Annotated, Literal, Union
from bloom.taxonomy import BLOOM_LEVELS
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, AfterValidator, BeforeValidator, model_validator


def text_valid(value: str) -> str:
    if not value or any(0xD800 <= ord(c) <= 0xDFFF for c in value):
        raise ValueError("INVALID_CONTRACT")
    return value


def txt(maximum=128, pattern=None):
    return Annotated[str, Field(min_length=1, max_length=maximum, pattern=pattern), AfterValidator(text_valid)]


Id = txt(128, r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
CourseId = txt(36, r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
UUID = txt(36, r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
Hash = txt(71, r"^sha256:[a-f0-9]{64}$")
Version = Literal["1.0.0"]


def json_integer(value):
    # JSON has one number type. Match JS safe-integer semantics without accepting
    # booleans or strings through Pydantic coercion.
    if type(value) is float and math.isfinite(value) and value.is_integer():
        return int(value)
    return value


JsonInt = Annotated[int, BeforeValidator(json_integer)]
Seq = Annotated[JsonInt, Field(ge=1, le=9007199254740991)]
Score = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Phase = Literal["idle", "peer_discussion", "individual_attempt", "debrief"]
Bloom = Literal[tuple(BLOOM_LEVELS)]
Failure = Literal["UNAUTHORIZED", "UNPUBLISHED", "UNAVAILABLE", "REVOKED", "STALE_REVISION", "UNSUPPORTED_VERSION"]


def valid_time(v):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z", v):
        raise ValueError("INVALID_CONTRACT")
    datetime.strptime(v, "%Y-%m-%dT%H:%M:%S.%fZ")
    return v


Time = Annotated[str, Field(min_length=24, max_length=24, pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$"), AfterValidator(valid_time)]


def unique(items, key):
    if len({key(v) for v in items}) != len(items):
        raise ValueError("INVALID_CONTRACT")
    return items


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Pin(Strict):
    courseId: CourseId
    revisionId: Id
    contentHash: Hash


class SourceRef(Strict):
    documentId: Id
    pageNumber: Annotated[JsonInt, Field(ge=1, le=100000)] | None
    contentHash: Hash
    provenance: Literal["extracted", "manual", "ai_generated"]
    locationKnown: bool

    @model_validator(mode="after")
    def location(self):
        if self.locationKnown != (self.pageNumber is not None):
            raise ValueError("INVALID_CONTRACT")
        return self


Sources = Annotated[list[SourceRef], Field(min_length=1, max_length=32), AfterValidator(lambda v: unique(v, lambda x: (x.documentId, x.pageNumber)))]


class Objective(Strict):
    objectiveId: Id
    statement: txt(2000)
    bloomLevel: Bloom


class Topic(Strict):
    topicId: Id
    title: txt(200)
    objectives: Annotated[list[Objective], Field(min_length=1, max_length=50)]


class PublishedContext(Pin):
    schemaVersion: Version
    visibility: Literal["authorized_learner"]
    title: txt(200)
    isPublished: bool = Field(json_schema_extra={"const": True})
    sources: Sources
    publishedAt: Time
    authorizedDocumentIds: Annotated[list[Id], Field(min_length=1, max_length=32), AfterValidator(lambda v: unique(v, lambda x: x))]
    topics: Annotated[list[Topic], Field(min_length=1, max_length=50)]

    @model_validator(mode="after")
    def published(self):
        if not self.isPublished or any(s.documentId not in self.authorizedDocumentIds for s in self.sources):
            raise ValueError("INVALID_CONTRACT")
        return self


class Allowed(Strict):
    schemaVersion: Version
    decision: Literal["allowed"]
    userId: Id
    pin: Pin
    grant: Literal["personal_owner", "active_enrollment", "assigned_instructor"]
    checkedAt: Time


class Denied(Strict):
    schemaVersion: Version
    decision: Literal["denied"]
    code: Failure
    retryable: bool


AccessDecision = Union[Allowed, Denied]


def same_pin(a, b):
    return all(getattr(a, k) == getattr(b, k) for k in ("courseId", "revisionId", "contentHash"))


class SourceResolution(Strict):
    schemaVersion: Version
    visibility: Literal["server_only"]
    pin: Pin
    access: AccessDecision
    sources: Sources
    vectorIndexRef: txt(280, r"^faiss/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-zA-Z0-9][a-zA-Z0-9_-]*\.faiss$")

    @model_validator(mode="after")
    def binding(self):
        if not isinstance(self.access, Allowed) or not same_pin(self.pin, self.access.pin) or self.vectorIndexRef != f"faiss/{self.pin.courseId}/{self.pin.revisionId}.faiss":
            raise ValueError("INVALID_CONTRACT")
        return self


class Excerpt(Strict):
    documentId: Id
    text: txt(8000)


class GroundingContext(Strict):
    schemaVersion: Version
    visibility: Literal["service_only"]
    pin: Pin
    sources: Sources
    excerpts: Annotated[list[Excerpt], Field(min_length=1, max_length=32)]

    @model_validator(mode="after")
    def binding(self):
        if any(not any(s.documentId == e.documentId for s in self.sources) for e in self.excerpts):
            raise ValueError("INVALID_CONTRACT")
        return self


class EditorContext(Pin):
    schemaVersion: Version
    visibility: Literal["editor_only"]
    status: Literal["draft", "published", "deprecated"]
    reviewStatus: Literal["unreviewed", "reviewed"]
    sources: Sources

    @model_validator(mode="after")
    def review(self):
        if self.status != "draft" and self.reviewStatus != "reviewed":
            raise ValueError("INVALID_CONTRACT")
        return self


class Constraints(Strict):
    maxAttempts: Annotated[JsonInt, Field(ge=1, le=20)]
    allowCalculator: bool


class Option(Strict):
    id: Id
    label: txt(1000)


class QuizData(Strict):
    question: txt(4000)
    options: Annotated[list[Option], Field(min_length=2, max_length=20), AfterValidator(lambda v: unique(v, lambda x: x.id))]
    isMultiSelect: bool


class Step(Strict):
    stepId: Id
    prompt: txt(4000)


class ProblemData(Strict):
    problem: txt(8000)
    steps: Annotated[list[Step], Field(min_length=1, max_length=20), AfterValidator(lambda v: unique(v, lambda x: x.stepId))]


class ActivityBase(Pin):
    schemaVersion: Version
    activityId: Id
    activityRevision: Id
    componentVersion: Version
    objectiveId: Id
    title: txt(200)
    instructions: txt(4000)
    timeLimitSeconds: Annotated[JsonInt, Field(ge=1, le=86400)] | None
    visibility: Literal["public"]
    language: txt(35, r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
    sourceRefs: Sources
    constraints: Constraints


class Quiz(ActivityBase):
    activityType: Literal["InteractiveQuiz"]
    presentationData: QuizData


class Problem(ActivityBase):
    activityType: Literal["GuidedProblem"]
    presentationData: ProblemData


ActivityDefinition = Union[Quiz, Problem]


class ActivityRef(Pin):
    activityId: Id
    activityRevision: Id
    activityType: Literal["InteractiveQuiz", "GuidedProblem"]


class ServerEvaluationDefinition(Strict):
    schemaVersion: Version
    visibility: Literal["server_only"]
    activity: ActivityRef
    evaluationRef: Id
    evaluatorType: Literal["deterministic_rubric", "llm_evaluation"]
    rubricVersion: Id
    rubric: txt(16000)
    answerKey: Annotated[list[txt(4000)], Field(min_length=1, max_length=20)]


class QuizAnswers(Strict):
    selectedOptionIds: Annotated[list[Id], Field(min_length=1, max_length=20), AfterValidator(lambda v: unique(v, lambda x: x))]


class StepAnswer(Strict):
    stepId: Id
    answer: txt(8000)


class ProblemAnswers(Strict):
    steps: Annotated[list[StepAnswer], Field(min_length=1, max_length=20), AfterValidator(lambda v: unique(v, lambda x: x.stepId))]


class AttemptSubmission(Strict):
    schemaVersion: Version
    attemptId: UUID
    activity: ActivityRef
    roomId: Id | None
    timeSpentSeconds: Annotated[JsonInt, Field(ge=0, le=86400)]
    answers: Union[QuizAnswers, ProblemAnswers]

    @model_validator(mode="after")
    def answer_type(self):
        if (self.activity.activityType == "InteractiveQuiz") != isinstance(self.answers, QuizAnswers):
            raise ValueError("INVALID_CONTRACT")
        return self


class PrivateAttempt(Strict):
    schemaVersion: Version
    visibility: Literal["recipient_only"]
    userId: Id
    submission: AttemptSubmission
    status: Literal["in_progress", "submitted", "graded"]
    submittedAt: Time
    payloadHash: Hash


class RecommendedNextStep(Strict):
    type: Literal["advance"]
    nextObjectiveId: Id
    title: txt(200)


class Graded(Strict):
    schemaVersion: Version
    visibility: Literal["recipient_only"]
    userId: Id
    attemptId: UUID
    activity: ActivityRef
    status: Literal["graded"]
    score: Score
    isCorrect: bool
    feedback: txt(8000)
    socraticHint: txt(8000) | None
    recommendedNextStep: RecommendedNextStep | None
    bloomLevelDemonstrated: Bloom
    evidenceId: Id | None
    evaluatedAt: Time


class Unresolved(Strict):
    schemaVersion: Version
    visibility: Literal["recipient_only"]
    userId: Id
    attemptId: UUID
    activity: ActivityRef
    status: Literal["pending", "rejected", "failed", "unavailable"]
    code: Literal["PENDING", "INVALID_SUBMISSION", "STALE_REVISION", "REVOKED", "UNSUPPORTED_VERSION", "UNAVAILABLE", "EVALUATION_FAILED", "UNCERTAIN"]
    retryable: bool

    @model_validator(mode="after")
    def state(self):
        codes = {"pending": ["PENDING"], "unavailable": ["UNAVAILABLE", "UNCERTAIN"], "failed": ["EVALUATION_FAILED"], "rejected": ["INVALID_SUBMISSION", "STALE_REVISION", "REVOKED", "UNSUPPORTED_VERSION"]}
        if self.code not in codes[self.status]:
            raise ValueError("INVALID_CONTRACT")
        return self


AssessmentResult = Union[Graded, Unresolved]


class Evaluator(Strict):
    type: Literal["deterministic_rubric", "llm_evaluation"]
    model: Id | None
    validationVersion: Id
    executionMode: Literal["REAL_APPROVED", "MOCK_TEST", "DETERMINISTIC_FALLBACK"]


class AcceptedEvidence(Strict):
    schemaVersion: Version
    evidenceVersion: Version
    evidenceId: Id
    visibility: Literal["server_only"]
    userId: Id
    attemptId: UUID
    activity: ActivityRef
    objectiveId: Id
    status: Literal["accepted"]
    bloomLevel: Bloom
    score: Score
    masteryAchieved: bool
    evaluator: Evaluator
    timestamp: Time

    @model_validator(mode="after")
    def provenance(self):
        if self.evaluator.type == "llm_evaluation" and (not self.evaluator.model or self.evaluator.executionMode != "REAL_APPROVED"):
            raise ValueError("INVALID_CONTRACT")
        return self


class EvidenceAccepted(Strict):
    schemaVersion: Version
    status: Literal["accepted"]
    evidence: AcceptedEvidence


class EvidenceRejected(Strict):
    schemaVersion: Version
    status: Literal["rejected", "unavailable"]
    attemptId: UUID
    code: Literal["UNVALIDATED", "UNCERTAIN", "REVOKED", "STALE_REVISION", "UNAVAILABLE"]
    retryable: bool


EvidenceDecision = Union[EvidenceAccepted, EvidenceRejected]


class PublicCompletion(Strict):
    schemaVersion: Version
    visibility: Literal["public"]
    completionId: Id
    roomId: Id
    activity: ActivityRef
    publicSubmissionsCount: Annotated[JsonInt, Field(ge=0, le=10)]


class RewardReference(Strict):
    schemaVersion: Version
    visibility: Literal["server_only"]
    userId: Id
    evidenceId: Id
    completionId: Id | None
    rewardCandidateId: Id
    policyVersion: Id
    eventKey: txt(512)
    finalAwardId: Id | None

    @model_validator(mode="after")
    def key(self):
        if self.eventKey != f"xp:{self.userId}:{self.evidenceId}":
            raise ValueError("INVALID_CONTRACT")
        return self


class Member(Strict):
    userId: Id
    name: txt(200)
    role: Literal["host", "participant"]
    isOnline: bool
    isSpeaking: bool
    hasSubmitted: bool


class RoomActivityState(Strict):
    schemaVersion: Version
    type: Literal["ROOM_ACTIVITY_STATE"]
    roomId: Id
    seq: Seq
    presenterUserId: Id
    currentPhase: Phase
    pin: Pin | None
    activity: ActivityRef | None
    publicSubmissionsCount: Annotated[JsonInt, Field(ge=0, le=10)]
    participants: Annotated[list[Member], Field(min_length=1, max_length=10)]

    @model_validator(mode="after")
    def relationships(self):
        unique(self.participants, lambda p: p.userId)
        if (self.activity and (self.pin is None or not same_pin(self.pin, self.activity))) or not any(p.userId == self.presenterUserId for p in self.participants) or self.publicSubmissionsCount > len(self.participants):
            raise ValueError("INVALID_CONTRACT")
        return self


class SelectActivityCommand(Strict):
    schemaVersion: Version
    commandId: UUID
    expectedSeq: Seq
    roomId: Id
    action: Literal["DISPLAY_ACTIVITY"]
    activity: ActivityRef


class Dialogue(Strict):
    speaker: txt(200)
    text: txt(2000)


class FacilitatorContext(Strict):
    schemaVersion: Version
    visibility: Literal["service_only"]
    roomId: Id
    seq: Seq
    pin: Pin | None
    activity: ActivityRef | None
    currentPhase: Phase
    publicSubmissionsCount: Annotated[JsonInt, Field(ge=0, le=10)]
    recentDialogue: Annotated[list[Dialogue], Field(max_length=20)]

    @model_validator(mode="after")
    def binding(self):
        if self.activity and (self.pin is None or not same_pin(self.pin, self.activity)):
            raise ValueError("INVALID_CONTRACT")
        return self


Strategy = Literal["PEER_CHALLENGE", "SOCRATIC_NUDGE", "CONCEPT_PROMPT", "INCLUSIVE_INVITATION", "CONSENSUS_CHECK", "DISAGREEMENT_RESOLUTION"]


class UIProposal(Strict):
    action: Literal["DISPLAY_ACTIVITY"]
    activity: ActivityRef


class FacilitatorProposal(Strict):
    schemaVersion: Version
    status: Literal["proposed"]
    interventionId: Id
    roomId: Id
    expectedSeq: Seq
    pin: Pin | None
    strategy: Strategy
    messageText: txt(2000)
    proposedUICommand: UIProposal | None
    cooldownSeconds: Annotated[JsonInt, Field(ge=0, le=300)]

    @model_validator(mode="after")
    def binding(self):
        if self.proposedUICommand and (self.pin is None or not same_pin(self.pin, self.proposedUICommand.activity)):
            raise ValueError("INVALID_CONTRACT")
        return self


class ValidatedProposal(Strict):
    schemaVersion: Version
    interventionId: Id
    roomId: Id
    status: Literal["validated"]
    expectedSeq: Seq


class AcceptedProposal(Strict):
    schemaVersion: Version
    interventionId: Id
    roomId: Id
    status: Literal["accepted"]
    commandId: UUID
    seq: Seq


class RejectedProposal(Strict):
    schemaVersion: Version
    interventionId: Id | None
    roomId: Id
    status: Literal["rejected"]
    code: Literal["UNAUTHORIZED", "UNPUBLISHED", "REVOKED", "UNSUPPORTED_VERSION"]


class StaleProposal(Strict):
    schemaVersion: Version
    interventionId: Id | None
    roomId: Id
    status: Literal["stale"]
    code: Literal["STALE_REVISION"]


class UnavailableProposal(Strict):
    schemaVersion: Version
    interventionId: Id | None
    roomId: Id
    status: Literal["unavailable"]
    code: Literal["UNAVAILABLE"]


ProposalDecision = Union[ValidatedProposal, AcceptedProposal, RejectedProposal, StaleProposal, UnavailableProposal]


class PrivateHelpRequest(Strict):
    schemaVersion: Version
    requestId: UUID
    activity: ActivityRef
    roomId: Id | None
    userQuestion: txt(4000)


class PrivateHelp(Strict):
    schemaVersion: Version
    visibility: Literal["recipient_only"]
    userId: Id
    requestId: UUID
    activity: ActivityRef
    status: Literal["available", "unavailable"]
    tutorResponse: txt(8000) | None

    @model_validator(mode="after")
    def content(self):
        if (self.status == "available") != (self.tutorResponse is not None):
            raise ValueError("INVALID_CONTRACT")
        return self


CONTRACTS = {name: TypeAdapter(globals()[name]) for name in (
    "PublishedContext", "AccessDecision", "SourceResolution", "GroundingContext", "EditorContext",
    "ActivityDefinition", "ServerEvaluationDefinition", "AttemptSubmission", "PrivateAttempt", "AssessmentResult",
    "AcceptedEvidence", "EvidenceDecision", "PublicCompletion", "RewardReference", "RoomActivityState",
    "SelectActivityCommand", "FacilitatorContext", "FacilitatorProposal", "ProposalDecision", "PrivateHelpRequest", "PrivateHelp"
)}


def parse_contract(name, value):
    try:
        if len(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")) > 65536:
            raise ValueError("INVALID_CONTRACT")
        return CONTRACTS[name].validate_python(value, strict=True).model_dump(mode="json")
    except (ValueError, TypeError, KeyError) as exc:
        raise ValueError("INVALID_CONTRACT") from exc


def validate_activity_context(value, context):
    a = parse_contract("ActivityDefinition", value)
    c = parse_contract("PublishedContext", context)
    if any(a[k] != c[k] for k in ("courseId", "revisionId", "contentHash")) or any(s["documentId"] not in c["authorizedDocumentIds"] or not any(r["documentId"] == s["documentId"] and r["contentHash"] == s["contentHash"] for r in c["sources"]) for s in a["sourceRefs"]) or not any(o["objectiveId"] == a["objectiveId"] for t in c["topics"] for o in t["objectives"]):
        raise ValueError("INVALID_CONTRACT")
    return a


def validate_submission(value, definition):
    s, a = parse_contract("AttemptSubmission", value), parse_contract("ActivityDefinition", definition)
    if any(s["activity"][k] != a[k] for k in ("courseId", "revisionId", "contentHash", "activityId", "activityRevision", "activityType")):
        raise ValueError("INVALID_CONTRACT")
    if a["activityType"] == "InteractiveQuiz":
        ids = s["answers"]["selectedOptionIds"]
        if (not a["presentationData"]["isMultiSelect"] and len(ids) != 1) or any(x not in [o["id"] for o in a["presentationData"]["options"]] for x in ids):
            raise ValueError("INVALID_CONTRACT")
    elif any(x["stepId"] not in [step["stepId"] for step in a["presentationData"]["steps"]] for x in s["answers"]["steps"]):
        raise ValueError("INVALID_CONTRACT")
    return s


def parse_recipient(name, value, authenticated_user_id):
    if name not in ("PrivateAttempt", "AssessmentResult", "PrivateHelp"):
        raise ValueError("INVALID_CONTRACT")
    result = parse_contract(name, value)
    if result["userId"] != authenticated_user_id:
        raise ValueError("INVALID_CONTRACT")
    return result


def compare_attempt(previous, retry):
    a, b = parse_contract("AttemptSubmission", previous), parse_contract("AttemptSubmission", retry)
    return "new" if a["attemptId"] != b["attemptId"] else "identical" if a == b else "conflict"


def validate_proposal(value, context):
    p, c = parse_contract("FacilitatorProposal", value), parse_contract("FacilitatorContext", context)
    if p["roomId"] != c["roomId"] or p["expectedSeq"] != c["seq"] or p["pin"] != c["pin"]:
        raise ValueError("INVALID_CONTRACT")
    return p
