import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { Course, Subject, StudySession, StudyPlan } from '../models';

/**
 * Read-only context the Python coach needs for grounding.
 *
 * The AI service used to query the `courses` / `studysessions` / `subjects`
 * collections directly. Those collections moved to PostgreSQL, so the reads
 * silently returned nothing and the coach fell back to task-title-only context.
 * This endpoint is the supported seam: the API owns the schema and answers the
 * bounded projection, and the service never touches the database.
 *
 * Every response is deliberately narrow — the caller gets subject/title plus
 * key concepts and nothing else (no files, URLs, descriptions or ids beyond
 * what it already holds). Authentication is `x-internal-secret`, like the other
 * service-to-service endpoints.
 */

const COURSE_CATALOG_MAX = 10;
const KEY_CONCEPTS_MAX = 15;
const CONCEPT_MAX_CHARS = 100;
const SUBJECT_MAX_CHARS = 60;
const TITLE_MAX_CHARS = 100;

interface Subtopic {
  key_concepts?: unknown;
}

interface Topic {
  title?: unknown;
  subtopics?: Subtopic[];
}

function keyConcepts(topics: Topic[]): string[] {
  const concepts: string[] = [];
  for (const topic of topics) {
    for (const subtopic of topic?.subtopics || []) {
      for (const concept of (subtopic?.key_concepts as unknown[]) || []) {
        if (typeof concept !== 'string') continue;
        const trimmed = concept.trim().slice(0, CONCEPT_MAX_CHARS);
        if (trimmed) concepts.push(trimmed);
        if (concepts.length >= KEY_CONCEPTS_MAX) return concepts;
      }
    }
  }
  return concepts;
}

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * GET /api/v1/study/internal/coach/catalog?userId=
 * → { courses: [{ subject, title, keyConcepts }] }
 */
export async function coachCatalog(req: DomainRequest, res: Response) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const courses = await Course.find({ userId }).sort({ createdAt: -1 }).limit(COURSE_CATALOG_MAX);
    const subjectIds = [...new Set(courses.map((course) => course.subjectId).filter(Boolean))];
    const subjects = subjectIds.length
      ? await Subject.find({ id: { $in: subjectIds } })
      : [];
    const nameById = new Map(subjects.map((subject) => [String(subject.id), subject.name]));

    return res.json({
      courses: courses.map((course) => ({
        subject: text(nameById.get(String(course.subjectId)), SUBJECT_MAX_CHARS) || 'Unknown',
        title: text(course.title, TITLE_MAX_CHARS),
        keyConcepts: keyConcepts((course.topics || []) as Topic[])
      }))
    });
  } catch {
    // The coach degrades to task-title-only context; a lookup failure is not a
    // reason to fail the nudge.
    return res.json({ courses: [] });
  }
}

/**
 * GET /api/v1/study/internal/coach/sessions/:sessionId/current-task
 * → { task_id, title, course_id, subject } or 404
 */
export async function coachCurrentTask(req: DomainRequest, res: Response) {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  try {
    const session = await StudySession.findOne({ id: sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const progress = (session.taskProgress || {}) as {
      currentTaskIndex?: number;
      tasks?: Array<{ taskId?: string; title?: string }>;
    };
    const tasks = progress.tasks || [];
    const index = progress.currentTaskIndex || 0;
    const task = index >= 0 && index < tasks.length ? tasks[index] : tasks[0];

    let subject = 'Unknown';
    if (session.courseId) {
      const course = await Course.findById(String(session.courseId));
      if (course?.subjectId) {
        const subjectRow = await Subject.findById(String(course.subjectId));
        if (subjectRow?.name) subject = text(subjectRow.name, SUBJECT_MAX_CHARS);
      }
    }

    return res.json({
      task_id: task?.taskId ?? null,
      title: task?.title ? text(task.title, 200) : null,
      course_id: session.courseId ?? null,
      subject
    });
  } catch {
    return res.status(404).json({ error: 'Session unavailable' });
  }
}

/**
 * GET /api/v1/study/internal/planner/plans?userId=&limit=
 * → { plans: StudyPlan[] } newest first.
 *
 * `studyplans` is API-owned; the AI planner endpoints that list a learner's
 * plans read them through here instead of the database.
 */
export async function plannerPlans(req: DomainRequest, res: Response) {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const requested = Number(req.query.limit);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 50) : 10;
  try {
    const plans = await StudyPlan.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return res.json({ plans });
  } catch {
    return res.status(503).json({ error: 'Plans unavailable' });
  }
}

export default { coachCatalog, coachCurrentTask, plannerPlans };
