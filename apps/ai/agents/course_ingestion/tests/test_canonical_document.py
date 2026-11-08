from agents.course_ingestion.normalization.canonical_document import (
    build_canonical_document,
    retrieval_units,
)
from agents.course_ingestion.normalization.tokenizer import tokenize_subtopics


def lesson():
    return {
        "id": "sub_3_1",
        "title": "3.1 Séries numériques",
        "summary": "A short outline.",
        "full_content": "First complete paragraph.\n\nSecond complete paragraph.",
        "source_spans": [
            {
                "chunkId": "chk_source",
                "documentId": "doc_course",
                "pageNumber": 1,
                "lineStart": 3,
                "lineEnd": 6,
            }
        ],
        "structured_blocks": [
            {
                "type": "math",
                "expression": "S_n = \\sum_{p=0}^n u_p",
                "notation": "latex",
                "chunkId": "chk_source",
                "documentId": "doc_course",
                "pageNumber": 1,
                "lineStart": 5,
                "lineEnd": 5,
            }
        ],
        "learning_objectives": [
            {
                "id": "obj_1",
                "statement": "Explain the partial-sum definition.",
                "bloomLevel": "understand",
                "provenance": "ai_generated",
            }
        ],
    }


def test_complete_body_and_typed_structure_survive_tokenization():
    subtopics = [lesson()]
    original = subtopics[0]["full_content"]
    tokenize_subtopics(subtopics)
    assert subtopics[0]["full_content"] == original
    document = build_canonical_document(
        "64a000000000000000000001",
        "Course",
        [{"id": "topic_1", "title": "Chapter 3", "subtopics": subtopics}],
    )
    blocks = document["chapters"][0]["lessons"][0]["blocks"]
    assert blocks[0]["text"] == original
    assert blocks[0]["provenance"] == "extracted"
    assert any(block["type"] == "math" for block in blocks)
    assert any(
        block.get("verification") == "generated_review_required" for block in blocks
    )
    assert document["verification"] == "source_text_unverified"


def test_block_identity_is_stable_and_repeated_build_is_idempotent():
    topics = [{"id": "topic_1", "title": "Chapter 3", "subtopics": [lesson()]}]
    first = build_canonical_document("64a000000000000000000001", "Course", topics)
    second = build_canonical_document("64a000000000000000000001", "Course", topics)
    assert first == second
    assert [unit["id"] for unit in retrieval_units(first)] == [
        unit["id"] for unit in retrieval_units(second)
    ]
    unit = retrieval_units(first)[0]
    assert unit["text"] == lesson()["full_content"]
    assert unit["blockIds"] == [first["chapters"][0]["lessons"][0]["blocks"][0]["id"]]
    assert unit["chunkIds"] == ["chk_source"]


def test_retrieval_splits_only_at_paragraph_boundaries():
    value = lesson()
    value["full_content"] = "\n\n".join(["Paragraph " + str(i) + " " + "x" * 700 for i in range(5)])
    canonical = build_canonical_document(
        "64a000000000000000000001",
        "Course",
        [{"id": "topic_1", "title": "Chapter 3", "subtopics": [value]}],
    )
    units = retrieval_units(canonical)
    assert len(units) > 1
    assert all(unit["text"].startswith("Paragraph ") for unit in units)
    assert all("x" * 700 in unit["text"] for unit in units)


def test_retrieval_bounds_a_long_lesson_without_paragraph_breaks():
    # Extracted PDF text often has single newlines only, so the whole lesson is
    # one "paragraph". Every unit must still fit the grounding excerpt limit.
    value = lesson()
    value["full_content"] = "\n".join("Line %d of the extracted lesson text" % i for i in range(1000))
    canonical = build_canonical_document(
        "64a000000000000000000001",
        "Course",
        [{"id": "topic_1", "title": "Chapter 3", "subtopics": [value]}],
    )
    units = retrieval_units(canonical)
    assert len(value["full_content"]) > 20000
    assert len(units) > 10
    assert all(len(unit["text"]) <= 2000 for unit in units)
    assert "".join("".join(unit["text"].split()) for unit in units) == "".join(
        value["full_content"].split()
    )


def test_summary_can_never_substitute_for_empty_canonical_body():
    value = lesson()
    value["full_content"] = ""
    canonical = build_canonical_document(
        "64a000000000000000000001",
        "Course",
        [{"id": "topic_1", "title": "Chapter 3", "subtopics": [value]}],
    )
    assert retrieval_units(canonical) == []
    assert canonical["chapters"][0]["lessons"][0]["blocks"][0]["text"] == ""


def test_long_source_equation_is_not_silently_cut_at_600_characters():
    # Use the same source-region projection as ingestion, retaining full original text.
    text = 'x + ' * 200 + 'y = 0'
    sub = lesson()
    sub['source_regions'] = [{'id': 'long', 'type': 'math', 'text': text, 'page': 1, 'bbox': [1,2,300,200], 'documentId':'doc_course'}]
    document = build_canonical_document('64a000000000000000000001', 'Course', [{'id':'chapter','title':'Source','subtopics':[sub]}])
    blocks = document['chapters'][0]['lessons'][0]['blocks']
    assert any(b.get('expression') == text for b in blocks)
