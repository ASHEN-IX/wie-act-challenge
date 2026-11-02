from collections import OrderedDict

from .schema import CourseKnowledgeJSON, Topic, Subtopic


def normalize_course(
    course_title: str, subtopics: list, source_files: list
) -> CourseKnowledgeJSON:
    """
    Converts subtopics into a normalized JSON object.
    """
    # Convert dict subtopics to Subtopic objects
    subtopic_objects = []
    for sub in subtopics:
        subtopic_objects.append(Subtopic(**sub))

    # A source-declared chapter is a real topic boundary. Keep source order and
    # do not turn every paragraph into a topic when no chapter is declared.
    grouped = OrderedDict()
    for sub in subtopic_objects:
        chapter = sub.chapter.strip() or course_title
        grouped.setdefault(chapter, []).append(sub)
    # Multi-chapter courses need objectives addressed by the owning topic.
    # Preserve the reviewable objective while correcting the derived mapping.
    if len(grouped) > 1:
        for index, members in enumerate(grouped.values(), 1):
            for sub in members:
                for objective in sub.learning_objectives:
                    objective["topicId"] = f"topic_{index}"
                    objective["id"] = objective.get("objectiveId", "")
    topics = [
        Topic(
            id=f"topic_{index}",
            title=chapter,
            source_chapter=chapter,
            summary=" ".join(
                sub.summary for sub in members if sub.summary
            )[:1000],
            subtopics=members,
        )
        for index, (chapter, members) in enumerate(grouped.items(), 1)
    ]

    course_json = CourseKnowledgeJSON(
        course_title=course_title, source_files=source_files, topics=topics
    )

    return course_json
