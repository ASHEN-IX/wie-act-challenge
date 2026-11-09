/**
 * Course Studio Activity Generation Service (ED-32 / ED-31 / M14).
 *
 * Implements:
 * - Source-backed draft activity proposal generation for instructors.
 * - Strict alignment with Contract 04 ActivityDefinition and ServerEvaluationDefinition schemas.
 * - Invariant: Zero model self-approval or self-publication. Candidates are returned
 *   to authorized instructors for explicit review and registration.
 */

import { CourseRevision } from '../models';
import { verifyRevisionArtifact, SourceIntegrityError } from './revisionSources';
import crypto from 'node:crypto';
import { parseContract } from '../../../../shared/ednova/contracts';
import { getCourseDraft } from './courseDraft';
import { canManageCourse } from './resourceAccess';
import { PublicationForbiddenError } from './coursePublication';

export interface GenerateActivityOptions {
  objectiveId: string;
  activityType: 'InteractiveQuiz' | 'GuidedProblem';
  title?: string;
  instructions?: string;
  expectedRevisionTag?: string;
  sourceChunkId?: string;
  sourceSectionId?: string;
  language?: 'en' | 'fr' | 'ar' | 'ary';
  difficulty?: 'beginner' | 'standard' | 'advanced';
  hintDepth?: 'none' | 'cue' | 'context';
}

const PROMPTS = {
  en: {
    instructions: 'Complete the exact source quotation. Instructor review required.',
    question: 'Which word completes this quotation?',
    step: 'Enter the missing source word exactly.',
    cue: 'First letter',
    context: 'Word length'
  },
  fr: {
    instructions: 'Complétez la citation exacte. Révision par un enseignant requise.',
    question: 'Quel mot complète cette citation ?',
    step: 'Saisissez exactement le mot manquant de la source.',
    cue: 'Première lettre',
    context: 'Nombre de lettres'
  },
  ar: {
    instructions: 'أكمل الاقتباس الأصلي بدقة. مراجعة المدرّس مطلوبة.',
    question: 'ما الكلمة التي تكمل هذا الاقتباس؟',
    step: 'اكتب الكلمة الناقصة من المصدر كما هي.',
    cue: 'الحرف الأول',
    context: 'عدد الحروف'
  },
  ary: {
    instructions: 'كمّل الاقتباس كيف ما هو في المصدر. يلزم الأستاذ يراجعو.',
    question: 'شنوّة الكلمة الناقصة في الاقتباس؟',
    step: 'اكتب الكلمة الناقصة كيف ما هي في المصدر.',
    cue: 'أوّل حرف',
    context: 'عدد الحروف'
  }
};

export class GenerationSettingsError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_GENERATION_SETTINGS';
}

export class ObjectiveNotFoundError extends Error {
  readonly status = 404;
  readonly code = 'OBJECTIVE_NOT_FOUND';
  constructor(message = 'Learning objective not found in active draft') {
    super(message);
    this.name = 'ObjectiveNotFoundError';
  }
}

export async function generateActivityCandidate(
  actorUserId: string,
  courseId: string,
  options: GenerateActivityOptions
) {
  // 1. Authorize caller as course instructor or owner
  const canManage = await canManageCourse(actorUserId, courseId);
  if (!canManage) {
    throw new PublicationForbiddenError('Only course instructors can generate activity proposals');
  }
  const language = options.language === undefined ? 'en' : options.language,
    difficulty = options.difficulty === undefined ? 'beginner' : options.difficulty,
    hintDepth = options.hintDepth === undefined ? 'none' : options.hintDepth;
  if (
    !['en', 'fr', 'ar', 'ary'].includes(language) ||
    !['beginner', 'standard', 'advanced'].includes(difficulty) ||
    !['none', 'cue', 'context'].includes(hintDepth) ||
    (options.sourceSectionId !== undefined &&
      (typeof options.sourceSectionId !== 'string' ||
        !options.sourceSectionId ||
        options.sourceSectionId.length > 128)) ||
    (options.title !== undefined &&
      (typeof options.title !== 'string' || options.title.length > 200)) ||
    (options.instructions !== undefined &&
      (typeof options.instructions !== 'string' || options.instructions.length > 3500))
  )
    throw new GenerationSettingsError(
      'Unsupported language, difficulty, hint depth or source section'
    );

  // 2. Retrieve active draft revision
  const draft = await getCourseDraft(actorUserId, courseId);

  // 3. Locate objective within draft topics & subtopics
  let foundObjective: {
    id: string;
    statement?: string;
    description?: string;
    bloomLevel?: string;
  } | null = null;

  for (const topic of (draft.topics || []) as Array<Record<string, unknown>>) {
    const directObjectives = (topic.objectives || topic.learning_objectives || []) as Array<
      Record<string, unknown>
    >;
    for (const obj of directObjectives) {
      if (obj.id === options.objectiveId || obj.objectiveId === options.objectiveId) {
        foundObjective = {
          id: String(obj.id || obj.objectiveId),
          statement: String(obj.statement || obj.description || obj.text || ''),
          bloomLevel: String(obj.bloomLevel || 'apply')
        };
        break;
      }
    }
    if (foundObjective) break;

    const subtopics = (topic.subtopics || []) as Array<Record<string, unknown>>;
    for (const sub of subtopics) {
      const objectives = (sub.learning_objectives ||
        sub.learningObjectives ||
        sub.objectives ||
        []) as Array<Record<string, unknown>>;
      for (const obj of objectives) {
        if (obj.id === options.objectiveId || obj.objectiveId === options.objectiveId) {
          foundObjective = {
            id: String(obj.id || obj.objectiveId),
            statement: String(obj.statement || obj.description || obj.text || ''),
            bloomLevel: String(obj.bloomLevel || 'apply')
          };
          break;
        }
      }
      if (foundObjective) break;
    }
    if (foundObjective) break;
  }

  if (!foundObjective) {
    throw new ObjectiveNotFoundError(
      `Learning objective '${options.objectiveId}' not found in course draft`
    );
  }

  if (!['InteractiveQuiz', 'GuidedProblem'].includes(options.activityType))
    throw new SourceIntegrityError('Unsupported activity type');
  if (options.expectedRevisionTag && options.expectedRevisionTag !== draft.revisionTag)
    throw Object.assign(new Error('Draft conflict'), { status: 409 });
  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: draft.revisionTag,
    status: 'draft'
  }).lean();
  if (!revision) throw Object.assign(new Error('Draft conflict'), { status: 409 });
  const artifact = await verifyRevisionArtifact(revision);
  const passage = artifact.passages.find(
    (p) =>
      (!options.sourceChunkId || p.chunkId === options.sourceChunkId) &&
      (!options.sourceSectionId || p.sectionId === options.sourceSectionId) &&
      p.text.length >= 20 &&
      p.text.length <= 2000
  );
  if (!passage)
    throw new SourceIntegrityError('Verified passage required; instructor authoring needed');
  const words = [...new Set(passage.text.match(/[\p{L}\p{M}]{4,}/gu) || [])].filter(
    (word) => word.length <= 1000
  );
  const uniqueWords = words.filter((w) => passage.text.split(w).length === 2);
  const expected =
    difficulty === 'advanced'
      ? [...uniqueWords].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]
      : difficulty === 'beginner'
        ? [...uniqueWords].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
        : uniqueWords[0];
  const count = difficulty === 'beginner' ? 1 : difficulty === 'advanced' ? 5 : 3;
  const distractors = words.filter((w) => w !== expected).slice(0, count);
  if (!expected || distractors.length !== count)
    throw new SourceIntegrityError(
      'Cannot derive a reliable candidate; instructor authoring required'
    );
  const stepCount =
    options.activityType === 'InteractiveQuiz'
      ? 1
      : difficulty === 'advanced'
        ? 3
        : difficulty === 'standard'
          ? 2
          : 1;
  const answerWords = [expected, ...uniqueWords.filter((word) => word !== expected)].slice(
    0,
    stepCount
  );
  if (answerWords.length !== stepCount)
    throw new SourceIntegrityError('Not enough unique source words for the selected difficulty');
  const quoted = answerWords.reduce(
    (quote, word, index) => quote.replace(word, stepCount === 1 ? '_____' : `_____${index + 1}`),
    passage.text
  );
  const prompts = PROMPTS[language];
  const hint =
    hintDepth === 'none'
      ? ''
      : ` ${prompts.cue}: ${expected[0]}.` +
        (hintDepth === 'context' ? ` ${prompts.context}: ${[...expected].length}.` : '');
  const activityId = 'act_' + crypto.randomUUID().replace(/-/g, ''),
    activityRevision = 'rev_act_1';
  const pin = {
    courseId,
    revisionId: draft.revisionTag,
    contentHash: 'sha256:' + draft.contentHash.replace(/^sha256:/, ''),
    activityId,
    activityRevision,
    activityType: options.activityType
  };
  const answerId = 'opt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const choices = [
    { id: answerId, label: expected },
    ...distractors.map((word, i) => ({ id: 'opt_' + i, label: word }))
  ].sort((a, b) => a.id.localeCompare(b.id));
  const candidateActivity = parseContract('ActivityDefinition', {
    schemaVersion: '1.0.0',
    ...pin,
    componentVersion: '1.0.0',
    objectiveId: foundObjective.id,
    title: options.title || 'Source quotation check',
    instructions: (options.instructions || prompts.instructions) + hint,
    timeLimitSeconds: difficulty === 'beginner' ? 300 : difficulty === 'advanced' ? 90 : 180,
    visibility: 'public',
    language,
    sourceRefs: [
      {
        documentId: passage.documentId,
        contentHash: passage.contentHash,
        provenance: 'extracted',
        pageNumber: passage.pageNumber,
        locationKnown: passage.pageNumber !== null
      }
    ],
    constraints: {
      maxAttempts: difficulty === 'beginner' ? 5 : difficulty === 'advanced' ? 2 : 3,
      allowCalculator: false
    },
    presentationData:
      options.activityType === 'InteractiveQuiz'
        ? {
            question: quoted + '\n' + prompts.question,
            isMultiSelect: false,
            options: choices
          }
        : {
            problem: quoted,
            steps: answerWords.map((_, index) => ({
              stepId: index === 0 ? 'step_quote' : `step_quote_${index + 1}`,
              prompt: prompts.step + (stepCount === 1 ? '' : ` (${index + 1})`)
            }))
          }
  });
  const candidateEvaluation = parseContract('ServerEvaluationDefinition', {
    schemaVersion: '1.0.0',
    visibility: 'server_only',
    activity: pin,
    evaluationRef: 'eval_' + crypto.randomUUID().replace(/-/g, ''),
    evaluatorType: 'deterministic_rubric',
    rubricVersion:
      options.activityType === 'InteractiveQuiz' ? 'exact-options-v1' : 'exact-answer-v1',
    rubric: 'Exact quotation completion from verified source chunk ' + passage.chunkId,
    answerKey: options.activityType === 'InteractiveQuiz' ? [answerId] : answerWords
  });
  if (!(await canManageCourse(actorUserId, courseId))) throw new PublicationForbiddenError();
  if (
    !(await CourseRevision.exists({
      id: revision.id,
      revisionTag: draft.revisionTag,
      status: 'draft',
      activationState: { $ne: 'prepared' }
    }))
  )
    throw Object.assign(new Error('Draft changed during generation'), { status: 409 });
  return {
    candidateActivity,
    candidateEvaluation,
    draftRevisionTag: draft.revisionTag,
    generatedAt: new Date().toISOString(),
    reviewRequired: true,
    executionMode: 'DETERMINISTIC_FALLBACK',
    generationSettings: { language, difficulty, hintDepth, sourceSectionId: passage.sectionId },
    evidencePreview: {
      documentId: passage.documentId,
      chunkId: passage.chunkId,
      sectionId: passage.sectionId,
      pageNumber: passage.pageNumber,
      text: passage.text
    },
    warnings: [
      'OBJECTIVE_ALIGNMENT_UNVERIFIED',
      ...(passage.pageNumber === null ? ['SOURCE_LOCATION_UNKNOWN'] : []),
      ...(language !== 'en' ? ['LANGUAGE_QUALITY_UNREVIEWED'] : []),
      ...(passage.reviewRequired ? ['OCR_REVIEW_REQUIRED'] : [])
    ]
  };
}
