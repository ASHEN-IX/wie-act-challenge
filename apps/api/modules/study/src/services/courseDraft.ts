import crypto from 'node:crypto';
import { Course, CourseRevision } from '../models';
import { captureActivitySources } from './activityResolution';
import { canManageCourse } from './resourceAccess';
import { activityDigest } from './activityIdentity';

export const VALID_BLOOM_LEVELS = new Set([
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create'
]);

export const VALID_PROVENANCE = new Set(['extracted', 'ai_generated', 'manual']);

export interface DraftLearningObjectiveInput {
  id?: string;
  objectiveId?: string;
  statement?: string;
  text?: string;
  bloomLevel: string;
  provenance?: 'extracted' | 'ai_generated' | 'manual';
}

export interface DraftSubtopicInput {
  id?: string;
  title: string;
  summary?: string;
  key_concepts?: string[];
  sourceRefs?: Array<{
    fileId?: string;
    originalName?: string;
    pageRange?: string;
    ambiguityFlag?: boolean;
  }>;
  provenance?: 'extracted' | 'ai_generated' | 'manual';
  learning_objectives?: DraftLearningObjectiveInput[];
}

export interface DraftTopicInput {
  id?: string;
  title: string;
  description?: string;
  subtopics?: DraftSubtopicInput[];
}

export interface UpdateCourseDraftInput {
  expectedRevisionTag: string;
  topics: DraftTopicInput[];
  summary?: string;
  isInstructorReviewed?: boolean;
  extractionReviewAcknowledged?: boolean;
}

function extractionReviewRequired(contentDocument: unknown): boolean {
  if (!contentDocument || typeof contentDocument !== 'object' || Array.isArray(contentDocument))
    return false;
  const quality = (contentDocument as { quality?: { publicationState?: unknown } }).quality;
  return quality?.publicationState === 'review_required';
}

async function authoritativeCanonicalDocument(
  courseId: string,
  revisionTag: string,
  fallback: unknown
): Promise<unknown> {
  const durable = await CourseRevision.findOne({ courseId, revisionTag }).select({
    contentDocument: 1
  });
  return durable?.contentDocument ?? fallback;
}

export function canonicalHasReviewableRegions(value: unknown): boolean {
  return extractionReviewRequired(value);
}

export function withExtractionReview(value: unknown, acknowledgedAt: Date = new Date()): unknown {
  if (!extractionReviewRequired(value) || !value || typeof value !== 'object') return value;
  return {
    ...(value as Record<string, unknown>),
    extractionReview: {
      acknowledged: true,
      acknowledgedAt: acknowledgedAt.toISOString()
    }
  };
}

export class DraftForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Draft editing restricted to course owner or assigned instructor') {
    super(message);
    this.name = 'DraftForbiddenError';
  }
}

export class DraftNotFoundError extends Error {
  readonly status = 404;
  constructor(message = 'Course or draft not found') {
    super(message);
    this.name = 'DraftNotFoundError';
  }
}

export class StaleRevisionError extends Error {
  readonly status = 409;
  readonly currentRevisionTag?: string;
  constructor(message: string, currentRevisionTag?: string) {
    super(message);
    this.name = 'StaleRevisionError';
    this.currentRevisionTag = currentRevisionTag;
  }
}

export class HierarchyValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'HierarchyValidationError';
  }
}

function computeTopicsHash(topics: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(topics)).digest('hex');
}

/** Select a usable editable revision without letting stale retry shells mask
 * the most recent ingested or reviewed content. */
export async function findEditableDraft(courseId: string) {
  const drafts = await CourseRevision.find({ courseId, status: 'draft' });
  return (
    drafts
      .filter(
        (draft) =>
          Boolean(draft.topics?.length) &&
          draft.activationState !== 'prepared' &&
          !draft.revokedAt &&
          !draft.formulaPublication?.sourceDraftId
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.contentDocument)) - Number(Boolean(a.contentDocument)) ||
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          String(b._id).localeCompare(String(a._id))
      )[0] || null
  );
}

/**
 * Retrieve the current editable draft for a course.
 * Restricted to course owner, assigned instructors, and university admins.
 */
export async function getCourseDraft(actorUserId: string, courseId: string) {
  const allowed = await canManageCourse(actorUserId, courseId);
  if (!allowed) {
    throw new DraftForbiddenError();
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new DraftNotFoundError('Course not found');
  }

  let draft = await findEditableDraft(course._id.toString());

  // A published revision can leave an older, empty draft behind. Opening that
  // draft would hide the material the instructor just published. Start a new
  // editable revision from the active published topics instead; older records
  // remain untouched for audit and recovery.
  if (!draft || !draft.topics?.length) {
    const activeRevisionId = course.activeRevisionId;
    const active = activeRevisionId
      ? await CourseRevision.findOne({
          courseId: course._id,
          ...(activeRevisionId.startsWith('rev_')
            ? { revisionTag: activeRevisionId }
            : { _id: activeRevisionId }),
          status: { $in: ['published', 'deprecated'] },
          activationState: 'committed',
          revokedAt: { $exists: false }
        }).lean()
      : null;
    if (active?.topics?.length) {
      const originalCanonical = active.contentDocument
        ? JSON.parse(JSON.stringify(active.contentDocument))
        : undefined;
      if (originalCanonical)
        for (const c of originalCanonical.chapters || [])
          for (const l of c.lessons || []) for (const b of l.blocks || []) delete b.reviewedFormula;
      draft = await CourseRevision.create({
        courseId: course._id,
        revisionTag: `rev_${crypto.randomUUID().replace(/-/g, '')}`,
        contentHash: active.contentHash,
        status: 'draft',
        topics: active.topics,
        isInstructorReviewed: false,
        summary: active.summary,
        ...(active.contentDocument
          ? {
              contentDocument: originalCanonical,
              contentDocumentHash: activityDigest(originalCanonical)
            }
          : {}),
        sourceManifest: active.sourceManifest || []
      });
    }
  }

  if (!draft) {
    const revisionTag = `rev_${crypto.randomUUID().replace(/-/g, '')}`;
    const initialTopics = course.topics || [];
    const contentHash = computeTopicsHash(initialTopics);
    draft = await CourseRevision.create({
      courseId: course._id,
      revisionTag,
      contentHash,
      status: 'draft',
      topics: initialTopics,
      isInstructorReviewed: false,
      sourceManifest: captureActivitySources(course.files || [])
    });
  }

  return {
    courseId: course._id.toString(),
    revisionTag: draft.revisionTag,
    contentHash: draft.contentHash,
    status: draft.status,
    isInstructorReviewed: Boolean(draft.isInstructorReviewed),
    summary: draft.summary || course.description || '',
    topics: draft.topics || [],
    vectorIndexRef: draft.vectorIndexRef,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}

/**
 * Update the course draft with optimistic concurrency control and strict hierarchy validation.
 */
export async function updateCourseDraft(
  actorUserId: string,
  courseId: string,
  input: UpdateCourseDraftInput
) {
  const allowed = await canManageCourse(actorUserId, courseId);
  if (!allowed) {
    throw new DraftForbiddenError();
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new DraftNotFoundError('Course not found');
  }

  if (!input.expectedRevisionTag || typeof input.expectedRevisionTag !== 'string') {
    throw new HierarchyValidationError(
      'expectedRevisionTag is required for optimistic concurrency check'
    );
  }

  const sourceRevision = await findEditableDraft(course._id.toString());
  const canonicalSource = sourceRevision
    ? await authoritativeCanonicalDocument(
        course._id,
        sourceRevision.revisionTag,
        sourceRevision.contentDocument
      )
    : null;
  if (
    sourceRevision &&
    sourceRevision.revisionTag === input.expectedRevisionTag &&
    extractionReviewRequired(canonicalSource) &&
    input.isInstructorReviewed === true &&
    input.extractionReviewAcknowledged !== true
  ) {
    throw new HierarchyValidationError(
      'Review low-confidence source regions and acknowledge extraction review before marking this revision reviewed'
    );
  }

  if (!Array.isArray(input.topics) || input.topics.length === 0) {
    throw new HierarchyValidationError('topics must be a non-empty array');
  }

  const draft = await findEditableDraft(course._id.toString());

  if (!draft || draft.revisionTag !== input.expectedRevisionTag) {
    throw new StaleRevisionError(
      'Draft has been modified by another editor. Please refresh to load the latest version.',
      draft?.revisionTag
    );
  }

  const seenIds = new Set<string>();

  const sanitizedTopics = input.topics.map((topic, topicIdx) => {
    if (!topic.title || typeof topic.title !== 'string' || !topic.title.trim()) {
      throw new HierarchyValidationError(`Topic at index ${topicIdx} must have a non-empty title`);
    }

    const topicId =
      topic.id && typeof topic.id === 'string' && topic.id.trim()
        ? topic.id.trim()
        : `top_${crypto.randomUUID().slice(0, 8)}`;

    if (seenIds.has(topicId)) {
      throw new HierarchyValidationError(`Duplicate hierarchy id detected: ${topicId}`);
    }
    seenIds.add(topicId);

    const subtopics = (Array.isArray(topic.subtopics) ? topic.subtopics : []).map((sub, subIdx) => {
      if (!sub.title || typeof sub.title !== 'string' || !sub.title.trim()) {
        throw new HierarchyValidationError(
          `Subtopic at topic ${topicIdx}, subtopic ${subIdx} must have a non-empty title`
        );
      }

      const subtopicId =
        sub.id && typeof sub.id === 'string' && sub.id.trim()
          ? sub.id.trim()
          : `sub_${crypto.randomUUID().slice(0, 8)}`;

      if (seenIds.has(subtopicId)) {
        throw new HierarchyValidationError(`Duplicate hierarchy id detected: ${subtopicId}`);
      }
      seenIds.add(subtopicId);

      const provenance =
        sub.provenance && VALID_PROVENANCE.has(sub.provenance) ? sub.provenance : 'manual';

      const sourceRefs = Array.isArray(sub.sourceRefs)
        ? sub.sourceRefs.map((ref) => ({
            fileId: ref.fileId ? String(ref.fileId) : undefined,
            originalName: ref.originalName ? String(ref.originalName) : undefined,
            pageRange: ref.pageRange ? String(ref.pageRange) : undefined,
            ambiguityFlag: Boolean(ref.ambiguityFlag)
          }))
        : [];

      const objectives = (
        Array.isArray(sub.learning_objectives) ? sub.learning_objectives : []
      ).map((obj, objIdx) => {
        const statement = (obj.statement || obj.text || '').trim();
        if (!statement) {
          throw new HierarchyValidationError(
            `Learning objective at topic ${topicIdx}, subtopic ${subIdx}, objective ${objIdx} requires statement`
          );
        }

        const bloomRaw = String(obj.bloomLevel || '')
          .toLowerCase()
          .trim();
        if (!VALID_BLOOM_LEVELS.has(bloomRaw)) {
          throw new HierarchyValidationError(
            `Invalid bloomLevel '${bloomRaw}'. Must be one of: remember, understand, apply, analyze, evaluate, create`
          );
        }

        const objId =
          (obj.id || obj.objectiveId || '').trim() || `obj_${crypto.randomUUID().slice(0, 8)}`;
        if (seenIds.has(objId)) {
          throw new HierarchyValidationError(`Duplicate hierarchy id detected: ${objId}`);
        }
        seenIds.add(objId);

        return {
          id: objId,
          statement,
          bloomLevel: bloomRaw,
          provenance:
            obj.provenance && VALID_PROVENANCE.has(obj.provenance) ? obj.provenance : 'manual'
        };
      });

      return {
        id: subtopicId,
        title: sub.title.trim(),
        summary: typeof sub.summary === 'string' ? sub.summary.trim() : '',
        key_concepts: Array.isArray(sub.key_concepts) ? sub.key_concepts.map(String) : [],
        sourceRefs,
        provenance,
        learning_objectives: objectives
      };
    });

    return {
      id: topicId,
      title: topic.title.trim(),
      description: typeof topic.description === 'string' ? topic.description.trim() : '',
      subtopics
    };
  });

  const newRevisionTag = `rev_${crypto.randomUUID().replace(/-/g, '')}`;
  const newContentHash = computeTopicsHash(sanitizedTopics);
  const nextCanonical = canonicalSource
    ? reanchorCanonicalDocument(
        input.extractionReviewAcknowledged === true
          ? withExtractionReview(canonicalSource)
          : canonicalSource,
        sanitizedTopics
      )
    : undefined;

  // `draft` was just read, so these two predicates are evaluated on that read;
  // the `__v` guard below is what makes the write atomic. A nested JSON path
  // cannot be a Prisma `where`, and a formula publication is immutable, so
  // refusing here rather than in the filter is equivalent.
  if (draft.activationState === 'prepared')
    throw new StaleRevisionError('Draft changed during update');
  if (draft.formulaPublication?.sourceDraftId)
    throw Object.assign(new Error('Draft already published as a formula'), {
      status: 409,
      code: 'FORMULA_SNAPSHOT_CHANGED'
    });

  const changed = await CourseRevision.findOneAndUpdate(
    {
      _id: draft._id,
      revisionTag: input.expectedRevisionTag,
      status: 'draft',
      __v: draft.__v
    },
    {
      $set: {
        revisionTag: newRevisionTag,
        contentHash: newContentHash,
        topics: sanitizedTopics,
        // Canonical lesson bodies and source evidence belong to the immutable
        // uploaded census, not to the editable title/objective projection.
        ...(nextCanonical
          ? {
              contentDocument: nextCanonical,
              contentDocumentHash: activityDigest(nextCanonical)
            }
          : {}),
        summary: typeof input.summary === 'string' ? input.summary : draft.summary,
        isInstructorReviewed:
          input.isInstructorReviewed === undefined
            ? draft.isInstructorReviewed
            : Boolean(input.isInstructorReviewed)
      },
      $unset: { artifactHash: 1, sourceManifestDigest: 1, indexHash: 1, vectorIndexRef: 1 },
      $inc: { __v: 1 }
    },
    { new: true }
  );
  if (!changed) throw new StaleRevisionError('Draft changed during update');
  // Course.topics is a legacy editable projection; revision content is authoritative.
  // The write is authoritative; continue with the fresh row rather than a
  // mutated local copy.
  Object.assign(draft, changed);
  return {
    success: true,
    courseId: course._id.toString(),
    revisionTag: newRevisionTag,
    previousRevisionTag: input.expectedRevisionTag,
    contentHash: newContentHash,
    isInstructorReviewed: draft.isInstructorReviewed,
    topics: draft.topics,
    updatedAt: draft.updatedAt
  };
}

/** Preserve canonical source blocks while applying reviewed hierarchy names. */
function reanchorCanonicalDocument(
  value: unknown,
  topics: Array<{ id: string; title: string; subtopics?: Array<{ id: string; title: string }> }>
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const document = value as {
    chapters?: Array<{
      id?: string;
      title?: string;
      lessons?: Array<{ id?: string; title?: string }>;
    }>;
  };
  if (!Array.isArray(document.chapters)) return value;
  return {
    ...document,
    chapters: document.chapters.map((chapter, index) => {
      const topic = topics.find((candidate) => candidate.id === chapter.id) || topics[index];
      return {
        ...chapter,
        ...(topic ? { id: topic.id, title: topic.title } : {}),
        lessons: (chapter.lessons || []).map((lesson, lessonIndex) => {
          const subtopic =
            topic?.subtopics?.find((candidate) => candidate.id === lesson.id) ||
            topic?.subtopics?.[lessonIndex];
          return { ...lesson, ...(subtopic ? { id: subtopic.id, title: subtopic.title } : {}) };
        })
      };
    })
  };
}
