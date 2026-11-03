"""Bounded schemas for the Visual Learning Lab planner.

The model returns *configuration*, never code. Everything it may return is
described here, and every value is checked twice: structurally by pydantic and
domain-wise by `validate_scenario` / by the Node gateway (authoritative).
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Engine = Literal["weighted_graph", "parameter_model", "spatial_3d", "function_plot"]

NODE_ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$"
MAX_NODES = 10
MIN_NODES = 2
MAX_EDGES = 20
MIN_WEIGHT = 1
MAX_WEIGHT = 99


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class GraphNode(StrictModel):
    id: Annotated[str, Field(min_length=1, max_length=16, pattern=NODE_ID)]
    label: Annotated[str, Field(min_length=1, max_length=40)]


class GraphEdge(StrictModel):
    source: Annotated[str, Field(min_length=1, max_length=16, pattern=NODE_ID)]
    target: Annotated[str, Field(min_length=1, max_length=16, pattern=NODE_ID)]
    weight: Annotated[int, Field(ge=MIN_WEIGHT, le=MAX_WEIGHT)]


class WeightedGraphScenario(StrictModel):
    nodes: Annotated[list[GraphNode], Field(min_length=MIN_NODES, max_length=MAX_NODES)]
    edges: Annotated[list[GraphEdge], Field(min_length=1, max_length=MAX_EDGES)]
    source: Annotated[str, Field(min_length=1, max_length=16, pattern=NODE_ID)]
    target: Annotated[str, Field(min_length=1, max_length=16, pattern=NODE_ID)]

    @model_validator(mode="after")
    def consistent(self) -> "WeightedGraphScenario":
        ids = [node.id for node in self.nodes]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate node identifiers")
        known = set(ids)
        if self.source not in known or self.target not in known:
            raise ValueError("source/target must be configured nodes")
        if self.source == self.target:
            raise ValueError("source and target must differ")
        pairs: set[tuple[str, str]] = set()
        for edge in self.edges:
            if edge.source not in known or edge.target not in known:
                raise ValueError("edge references an unknown node")
            if edge.source == edge.target:
                raise ValueError("self-loops are unsupported")
            pair = tuple(sorted((edge.source, edge.target)))
            if pair in pairs:
                raise ValueError("duplicate undirected edge")
            pairs.add(pair)
        return self


class ParameterValues(StrictModel):
    force: Annotated[float, Field(ge=0, le=200, allow_inf_nan=False)]
    mass: Annotated[float, Field(ge=0.5, le=50, allow_inf_nan=False)]


class ParameterScenario(StrictModel):
    modelId: Literal["newtons_second_law"]
    values: ParameterValues


class SpatialValues(StrictModel):
    speed: Annotated[float, Field(ge=5, le=50, allow_inf_nan=False)]
    elevation: Annotated[float, Field(ge=5, le=85, allow_inf_nan=False)]
    heading: Annotated[float, Field(ge=0, le=359, allow_inf_nan=False)]
    gravity: Annotated[float, Field(ge=1.5, le=25, allow_inf_nan=False)]


class SpatialScenario(StrictModel):
    sceneId: Literal["projectile_3d"]
    values: SpatialValues


class FunctionValues(StrictModel):
    a: Annotated[float, Field(ge=-5, le=5, allow_inf_nan=False)]
    b: Annotated[float, Field(ge=-10, le=10, allow_inf_nan=False)]
    c: Annotated[float, Field(ge=-10, le=10, allow_inf_nan=False)]

    @model_validator(mode="after")
    def a_is_nonzero(self) -> "FunctionValues":
        if self.a == 0:
            raise ValueError("a must not be 0")
        return self


class FunctionScenario(StrictModel):
    functionId: Literal["quadratic_function"]
    values: FunctionValues


class Guidance(StrictModel):
    instructions: Annotated[str, Field(min_length=1, max_length=600)]
    predictionPrompt: Annotated[str, Field(min_length=1, max_length=600)]
    hint: Annotated[str, Field(min_length=1, max_length=600)]


class LabCandidate(StrictModel):
    """Exactly what the planner may propose. No answer key, no code, no rubric."""

    engine: Engine
    title: Annotated[str, Field(min_length=1, max_length=120)]
    concept: Annotated[str, Field(min_length=1, max_length=160)]
    learningObjective: Annotated[str, Field(min_length=1, max_length=400)]
    scenario: WeightedGraphScenario | ParameterScenario | SpatialScenario | FunctionScenario
    guidance: Guidance

    @model_validator(mode="after")
    def engine_matches_scenario(self) -> "LabCandidate":
        expected = {
            "weighted_graph": WeightedGraphScenario,
            "parameter_model": ParameterScenario,
            "spatial_3d": SpatialScenario,
            "function_plot": FunctionScenario,
        }[self.engine]
        if not isinstance(self.scenario, expected):
            raise ValueError("scenario does not match the selected engine")
        return self


class Selection(StrictModel):
    """Compact-model step: which representation, or an honest refusal."""

    engine: Literal["weighted_graph", "parameter_model", "spatial_3d", "function_plot", "unsupported"]
    concept: Annotated[str, Field(min_length=1, max_length=160)]
    reason: Annotated[str, Field(min_length=1, max_length=400)]


def visible_characters(value: str) -> int:
    """Count Unicode code points; the Node validator uses the same unit."""
    return len(value)


class PlanRequest(StrictModel):
    """Authorized, minimized context supplied by the Node gateway."""

    schemaVersion: Literal["1.0.0"] = "1.0.0"
    mode: Literal["course", "topic"]
    concept: Annotated[str, Field(min_length=1, max_length=500)]
    courseId: Annotated[str, Field(pattern=r"^[a-f0-9]{24}$")] | None = None
    revisionId: Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")] | None = None
    topicId: Annotated[str, Field(max_length=128)] | None = None
    objectiveId: Annotated[str, Field(max_length=128)] | None = None
    # Node-selected excerpts from the already-verified revision artifact.
    passages: Annotated[list[dict], Field(max_length=8)] = Field(default_factory=list)
    language: Literal["en", "fr", "ar", "ary"] = "en"

    @model_validator(mode="after")
    def source_consistency(self) -> "PlanRequest":
        if self.mode == "course" and not (self.courseId and self.revisionId):
            raise ValueError("course mode requires courseId and revisionId")
        if self.mode == "topic" and (self.courseId or self.passages):
            raise ValueError("topic mode cannot claim course sources")
        for passage in self.passages:
            if set(passage) != {"documentId", "pageNumber", "sectionId", "text"}:
                raise ValueError("unsupported passage field")
            if not isinstance(passage["text"], str) or not passage["text"][:1].strip():
                raise ValueError("empty passage")
        return self


class GuideRequest(StrictModel):
    schemaVersion: Literal["1.0.0"] = "1.0.0"
    question: Annotated[str, Field(min_length=1, max_length=1000)]
    concept: Annotated[str, Field(min_length=1, max_length=160)]
    learningObjective: Annotated[str, Field(min_length=1, max_length=400)]
    engine: Engine
    guidanceMode: Literal["explain", "hint", "next", "challenge"] = "explain"
    # Authoritative deterministic output computed by the Node engine.
    state: Annotated[dict, Field(max_length=20)]
    language: Literal["en", "fr", "ar", "ary"] = "en"


class PlanResponse(StrictModel):
    status: Literal["planned", "unsupported", "unavailable"]
    candidate: LabCandidate | None = None
    reason: str
    executionMode: Literal["REAL_APPROVED", "MOCK_TEST", "DETERMINISTIC_FALLBACK", "UNAVAILABLE"]


class GuideResponse(StrictModel):
    status: Literal["guided", "unavailable"]
    text: str
    reason: str
    executionMode: Literal["REAL_APPROVED", "MOCK_TEST", "DETERMINISTIC_FALLBACK", "UNAVAILABLE"]


class _Unused(BaseModel):
    model_config = ConfigDict(extra="forbid")


__all__ = [
    "GuideRequest",
    "GuideResponse",
    "LabCandidate",
    "PlanRequest",
    "PlanResponse",
    "Selection",
    "WeightedGraphScenario",
    "ParameterScenario",
    "SpatialScenario",
    "FunctionScenario",
]
