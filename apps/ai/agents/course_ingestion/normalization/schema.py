from pydantic import BaseModel
from typing import List, Optional, Dict


class Subtopic(BaseModel):
    id: str
    title: str
    summary: str
    # Complete educational prose. A summary is derived metadata and may never
    # replace this field; older callers may omit it and use the summary.
    full_content: Optional[str] = None
    # An explicit source chapter title. It becomes the public topic boundary;
    # an empty value falls back to the uploaded course title.
    chapter: str = ""
    key_concepts: List[str] = []
    definitions: List[Dict[str, str]] = []
    formulas: List[str] = []
    examples: List[str] = []
    figures: List[Dict] = []
    tables: List[Dict] = []
    source_spans: List[Dict] = []
    source_regions: List[Dict] = []
    structured_blocks: List[Dict] = []
    difficulty_estimate: float = 0.0
    tokenized_chunks: List[str] = []
    # Draft learning objectives extracted at ingest time (BLOOM-04), each
    # conforming to the models.learning_objective.LearningObjective shape.
    learning_objectives: List[Dict] = []
    # Pre-computed L2-normalised embeddings for each tokenized_chunk (384-dim).
    # Populated at ingest time by chunk_embedder.embed_all_subtopics().
    chunk_embeddings: Optional[List[List[float]]] = None


class Topic(BaseModel):
    id: str
    title: str
    summary: str
    source_chapter: str = ""
    subtopics: List[Subtopic]
    prerequisites: List[str] = []
    estimated_learning_time: Optional[int] = None


class CourseKnowledgeJSON(BaseModel):
    course_title: str
    source_files: List[str]
    topics: List[Topic]
    global_prerequisites: List[str] = []
    glossary: List[Dict[str, str]] = []
