"""Deterministic semantic extraction and source-span preservation tests.

No provider, PDF renderer or database is involved. The cases pin structure,
order and uncertainty that the reader relies on. """

from agents.course_ingestion.parsing.semantic_structure import (
    detect_sections_with_sources,
    extract_blocks,
)
from agents.course_ingestion.normalization.normalizer import normalize_course
from agents.course_ingestion.parsing.section_builder import build_subtopics


def test_extracts_math_table_and_code_with_exact_line_spans():
    text = "\n".join(
        [
            "# Quadratic equations",
            "",
            "$$ax^2 + bx + c = 0$$",
            "",
            "| Discriminant | Solutions |",
            "| --- | --- |",
            "| Positive | Two |",
            "",
            "```python",
            "print('safe')",
            "```",
        ]
    )
    blocks = extract_blocks(text)
    assert [block["type"] for block in blocks] == ["heading", "math", "table", "code"]
    assert blocks[0]["lineStart"] == 1
    assert blocks[1] == {
        "type": "math",
        "expression": "ax^2 + bx + c = 0",
        "notation": "latex",
        "lineStart": 3,
        "lineEnd": 3,
    }
    assert blocks[2]["columns"] == ["Discriminant", "Solutions"]
    assert blocks[2]["rows"] == [["Positive", "Two"]]
    assert blocks[2]["lineStart"] == 5
    assert blocks[2]["lineEnd"] == 7
    assert blocks[3]["language"] == "python"
    assert blocks[3]["lineStart"] == 9
    assert blocks[3]["lineEnd"] == 11


def test_malformed_table_and_external_media_stay_safe_text():
    text = "\n".join(
        [
            "| Name | Value |",
            "| --- | --- |",
            "| incomplete |",
            "",
            "![Remote](https://untrusted.example/pixel.png)",
            "<img src=x onerror=alert(1)>",
        ]
    )
    blocks = extract_blocks(text)
    assert not any(block["type"] == "table" for block in blocks)
    assert not any(block["type"] == "media" for block in blocks)
    assert any("<img src=x" in line for line in text.splitlines())


def test_section_spans_keep_the_verified_chunk_and_page():
    passages = [
        (
            "# Networking\n\nPackets carry an address.",
            {"chunk_id": "chk_net", "document_id": "doc-net", "page_number": 7},
        ),
        (
            "# Security\n\nTLS protects a connection.",
            {"chunk_id": "chk_sec", "document_id": "doc-net", "page_number": 8},
        ),
    ]
    sections = detect_sections_with_sources(passages)
    assert [section["title"] for section in sections] == ["# Networking", "# Security"]
    assert sections[0]["source_spans"][0] == {
        "chunkId": "chk_net",
        "documentId": "doc-net",
        "pageNumber": 7,
        "lineStart": 3,
        "lineEnd": 3,
    }
    assert sections[1]["source_spans"][0]["chunkId"] == "chk_sec"
    assert sections[1]["source_spans"][0]["pageNumber"] == 8


def test_code_stays_one_block_across_blank_lines():
    text = "```sql\nSELECT 1;\n\nSELECT 2;\n```"
    blocks = extract_blocks(text)
    assert len(blocks) == 1
    assert blocks[0]["type"] == "code"
    assert blocks[0]["code"] == "SELECT 1;\n\nSELECT 2;"


def test_unterminated_code_is_retained_with_an_explicit_flag():
    blocks = extract_blocks("```js\nconsole.log('kept')")
    assert blocks[0]["type"] == "code"
    assert blocks[0]["unterminated"] is True


def test_explicit_source_marker_is_not_a_section_or_visible_block():
    passage = (
        "[[ednova:topic=networking/subtopic=handshake]]\n"
        "# TCP handshake\n\n"
        "The client sends SYN."
    )
    sections = detect_sections_with_sources(
        [(passage, {"chunk_id": "chk_tcp", "document_id": "doc-net", "page_number": 2})]
    )
    assert [section["title"] for section in sections] == ["# TCP handshake"]
    assert all("[[ednova:" not in line for section in sections for line in section["content"])
    assert sections[0]["source_spans"][0]["lineStart"] == 4


def test_chapter_pdf_structure_ignores_equations_exercises_and_running_heads():
    passages = [
        (
            "Chapitre 3\n"
            "Séries de Fonctions\n"
            "3.1\n"
            "Rappels sur les séries\n"
            "Une suite de sommes partielles converge.\n"
            "3.2\n"
            "Notion de série de fonction\n"
            "On étudie une suite de fonctions.\n"
            "1. essayer de rechercher une formule explicite.\n"
            "f(x) = 1 + x + x²\n"
            "CHAPITRE 3. SÉRIES DE FONCTIONS\n"
            "3.3\n"
            "Convergence uniforme\n"
            "La convergence uniforme contrôle toutes les valeurs.\n"
            "Chapitre 4\n"
            "Fonctions définies par des intégrales\n"
            "à paramètre\n"
            "4.1\n"
            "Intégrales simples\n"
            "On intègre une fonction continue.\n"
            "1. Montrer que la fonction est continue.\n",
            {"chunk_id": "chk_pdf", "document_id": "doc_pdf", "page_number": 11},
        )
    ]
    sections = detect_sections_with_sources(passages)
    assert [section["title"] for section in sections] == [
        "3.1 Rappels sur les séries",
        "3.2 Notion de série de fonction",
        "3.3 Convergence uniforme",
        "4.1 Intégrales simples",
    ]
    assert [section["chapter"] for section in sections] == [
        "Chapter 3: Séries de Fonctions",
        "Chapter 3: Séries de Fonctions",
        "Chapter 3: Séries de Fonctions",
        "Chapter 4: Fonctions définies par des intégrales à paramètre",
    ]
    assert all(section["source_spans"] for section in sections)
    assert all(
        span["pageNumber"] == 11
        for section in sections
        for span in section["source_spans"]
    )

    subtopics = build_subtopics(sections)
    assert [subtopic["title"] for subtopic in subtopics] == [
        "3.1 Rappels sur les séries",
        "3.2 Notion de série de fonction",
        "3.3 Convergence uniforme",
        "4.1 Intégrales simples",
    ]
    normalized = normalize_course("Course title", subtopics, ["source.pdf"])
    assert [topic.title for topic in normalized.topics] == [
        "Chapter 3: Séries de Fonctions",
        "Chapter 4: Fonctions définies par des intégrales à paramètre",
    ]
    assert [len(topic.subtopics) for topic in normalized.topics] == [3, 1]
