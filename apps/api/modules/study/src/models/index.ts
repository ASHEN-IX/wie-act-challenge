/**
 * Study-domain models.
 *
 * Every collection here is a PostgreSQL table now. Plain CRUD models come from
 * `_table.ts`; the few models with document-style behaviour (optimistic
 * concurrency, idempotent upserts) define it explicitly.
 */
import type {
  Course as CourseRow,
  Prisma,
  StudyPlan as StudyPlanRow,
  StudySession as StudySessionRow,
  Subject as SubjectRow,
  TaskRecord as TaskRecordRow,
  Topic as TopicRow
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { table, type Hydrated } from './_table';

// ── Embedded projections ──────────────────────────────────────────────────────

export interface ISignalHistoryEntry {
  timestamp?: Date;
  focusLevel?: number;
  fatigueLevel?: number;
  isDistracted?: boolean;
}

export interface ITaskProgressEntry {
  estimatedMinutes?: number;
  taskId?: string;
  title?: string;
  description?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  xpEarned?: number;
}

export interface IParticipant {
  userId: string;
  name?: string;
  avatar?: string;
  role?: 'host' | 'member';
  hasVoiceConsent?: boolean;
  joinedAt?: Date;
  leftAt?: Date;
}

export interface ISubtopic {
  id?: string;
  title?: string;
  summary?: string;
  key_concepts?: string[];
  definitions?: Array<{ term?: string; definition?: string }>;
  formulas?: string[];
  examples?: string[];
  source_spans?: Array<{
    chunkId: string;
    documentId: string;
    pageNumber: number | null;
    lineStart: number;
    lineEnd: number;
  }>;
  structured_blocks?: unknown[];
  tokenized_chunks?: string[];
  learning_objectives?: Array<
    Partial<
      Pick<
        ILearningObjective,
        | 'objectiveId'
        | 'topicId'
        | 'knowledgeType'
        | 'bloomLevel'
        | 'verb'
        | 'text'
        | 'classification'
      >
    >
  >;
}

export interface ICourseTopic {
  id?: string;
  title?: string;
  subtopics?: ISubtopic[];
}

export interface ICourseFile {
  filename?: string;
  originalName?: string;
  size?: number;
  fileHash?: string;
  uploadedAt?: Date;
}

export const COURSE_SCOPES = ['personal', 'institutional'] as const;
export type CourseScope = (typeof COURSE_SCOPES)[number];

/** Who may open the published course. Legacy courses derive it from `scope`. */
export const COURSE_VISIBILITIES = ['private', 'institution', 'public'] as const;
export type CourseVisibility = (typeof COURSE_VISIBILITIES)[number];

// ── Study session ─────────────────────────────────────────────────────────────

export type IStudySession = Omit<
  StudySessionRow,
  'taskProgress' | 'signalHistory' | 'breakStats' | 'participants'
> & {
  id: string;
  taskProgress: {
    currentTaskIndex: number;
    tasks: ITaskProgressEntry[];
    totalTasks: number;
    completedTasks: number;
  };
  signalHistory: ISignalHistoryEntry[];
  breakStats: {
    totalBreaks: number;
    totalBreakDuration: number;
    avgBreakDuration: number;
  };
  participants: IParticipant[];
};

const DEFAULT_TASK_PROGRESS = {
  currentTaskIndex: 0,
  tasks: [],
  totalTasks: 0,
  completedTasks: 0
};

export const StudySession = table<IStudySession>({
  delegate: () => prisma.studySession,
  jsonColumns: ['taskProgress', 'signalHistory', 'breakStats', 'participants'],
  defaults: () => ({
    mode: 'focus',
    challengeDifficulty: 'medium',
    status: 'completed',
    type: 'solo',
    xpMultiplier: 1,
    maxParticipants: 5,
    taskProgress: DEFAULT_TASK_PROGRESS,
    signalHistory: [],
    breakStats: { totalBreaks: 0, totalBreakDuration: 0, avgBreakDuration: 0 },
    participants: [],
    startTime: new Date(),
    completedAt: new Date()
  }),
  columns: (session) => ({
    userId: session.userId,
    taskId: session.taskId,
    topicId: session.topicId,
    courseId: session.courseId,
    studyPlanId: session.studyPlanId,
    mode: session.mode,
    challengeDifficulty: session.challengeDifficulty,
    taskProgress: session.taskProgress as unknown as Prisma.InputJsonValue,
    xpMultiplier: session.xpMultiplier,
    duration: session.duration,
    status: session.status,
    startTime: session.startTime,
    endTime: session.endTime,
    focusScore: session.focusScore,
    completedAt: session.completedAt,
    notes: session.notes,
    signalHistory: session.signalHistory as unknown as Prisma.InputJsonValue,
    breakStats: session.breakStats as unknown as Prisma.InputJsonValue,
    type: session.type,
    participants: session.participants as unknown as Prisma.InputJsonValue,
    inviteCode: session.inviteCode,
    maxParticipants: session.maxParticipants
  })
});

// ── Task ──────────────────────────────────────────────────────────────────────

export type ITask = Omit<TaskRecordRow, never> & { id: string };

export const Task = table<ITask>({
  delegate: () => prisma.taskRecord,
  defaults: () => ({ priority: 'medium', actualTime: 0, status: 'todo', tags: [] }),
  columns: (task) => ({
    userId: task.userId,
    studyPlanId: task.studyPlanId,
    title: task.title,
    description: task.description,
    topicId: task.topicId,
    objectiveId: task.objectiveId,
    targetBloomLevel: task.targetBloomLevel,
    priority: task.priority,
    estimatedTime: task.estimatedTime,
    actualTime: task.actualTime,
    status: task.status,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    tags: task.tags
  })
});

// ── Topic / Subject ───────────────────────────────────────────────────────────

export type ITopic = TopicRow & { id: string };
export type ISubject = SubjectRow & { id: string };

export const Topic = table<ITopic>({
  delegate: () => prisma.topic,
  defaults: () => ({ color: '#ff4655', totalStudyTime: 0, mastery: 0 }),
  columns: (topic) => ({
    userId: topic.userId,
    name: topic.name,
    description: topic.description,
    category: topic.category,
    color: topic.color,
    totalStudyTime: topic.totalStudyTime,
    mastery: topic.mastery
  })
});

export const Subject = table<ISubject>({
  delegate: () => prisma.subject,
  defaults: () => ({ color: '#ff4655' }),
  columns: (subject) => ({
    userId: subject.userId,
    name: subject.name,
    description: subject.description,
    image: subject.image,
    color: subject.color
  })
});

// ── Course ────────────────────────────────────────────────────────────────────

export type ICourse = Omit<CourseRow, 'topics' | 'files'> & {
  id: string;
  topics: ICourseTopic[];
  files: ICourseFile[];
};

/**
 * Courses are the hottest study table. The wrapper covers the plain reads and
 * writes; `Course.save()` persists only the mutable columns below.
 */
export const Course = table<ICourse>({
  delegate: () => prisma.course,
  jsonColumns: ['topics', 'files'],
  arrayColumns: ['assignedInstructorIds'],
  // `ownerUserId` mirrors `userId` so a transfer is authoritative everywhere.
  // (The Mongoose schema did this in a `pre('validate')` hook.)
  derives: (data) =>
    typeof data.userId === 'string' && data.ownerUserId === undefined
      ? { ownerUserId: data.userId }
      : {},
  derivesOnCreate: (data) =>
    typeof data.userId === 'string' && data.ownerUserId === undefined
      ? { ownerUserId: data.userId }
      : {},
  defaults: () => ({
    scope: 'personal',
    status: 'processing',
    assignedInstructorIds: [],
    topics: [],
    files: [],
    ingestProgress: 0,
    ingestDetail: '',
    ingestError: ''
  }),
  columns: (course) => ({
    title: course.title,
    description: course.description,
    scope: course.scope,
    visibility: course.visibility,
    institutionId: course.institutionId,
    ownerUserId: course.ownerUserId,
    assignedInstructorIds: course.assignedInstructorIds,
    activeRevisionId: course.activeRevisionId,
    subjectId: course.subjectId,
    status: course.status,
    jobId: course.jobId,
    correlationId: course.correlationId,
    ingestStage: course.ingestStage,
    ingestProgress: course.ingestProgress,
    ingestDetail: course.ingestDetail,
    ingestError: course.ingestError,
    topics: course.topics as unknown as Prisma.InputJsonValue,
    files: course.files as unknown as Prisma.InputJsonValue,
    processedAt: course.processedAt,
    aiCourseId: course.aiCourseId
  })
});

/** The Mongo `pre('validate')` kept `userId` and `ownerUserId` in sync and made
 * an institution-scoped course `institutional`. Applied on insert. */
export function newCourseDocument(
  input: Partial<ICourse> & { userId?: string; ownerUserId?: string }
): Record<string, unknown> {
  const userId = input.userId || input.ownerUserId;
  const ownerUserId = input.ownerUserId || input.userId;
  const scope =
    input.institutionId && (!input.scope || input.scope === 'personal')
      ? 'institutional'
      : (input.scope ?? 'personal');
  return { ...input, userId, ownerUserId, scope };
}

// ── Study plan ────────────────────────────────────────────────────────────────

export interface IStudyPlanTask {
  id?: string;
  title?: string;
  description?: string;
  estimated_minutes?: number;
  estimatedTime?: number;
  difficulty?: number;
  prerequisites?: string[];
  is_review?: boolean;
  objective_id?: string;
  target_bloom_level?: string;
}

export type IStudyPlan = Omit<StudyPlanRow, 'taskGraph' | 'resourceScope'> & {
  id: string;
  resourceScope?: { courseId?: string } | null;
  taskGraph: {
    goal?: string;
    tasks?: IStudyPlanTask[];
  };
};

export const StudyPlan = table<IStudyPlan>({
  delegate: () => prisma.studyPlan,
  jsonColumns: ['taskGraph', 'resourceScope'],
  defaults: () => ({ taskGraph: { goal: '', tasks: [] }, status: 'created' }),
  columns: (plan) => ({
    resourceScope: plan.resourceScope as unknown as Prisma.InputJsonValue,
    userId: plan.userId,
    courseId: plan.courseId,
    goal: plan.goal,
    availableTimeMinutes: plan.availableTimeMinutes,
    taskGraph: plan.taskGraph as unknown as Prisma.InputJsonValue,
    totalEstimatedMinutes: plan.totalEstimatedMinutes,
    warning: plan.warning,
    status: plan.status,
    scheduledAt: plan.scheduledAt
  })
});

// ── Learning objectives ───────────────────────────────────────────────────────

export interface ILearningObjective {
  id: string;
  userId: string;
  documentId: string;
  objectiveId: string;
  topicId: string;
  knowledgeType: string;
  bloomLevel: string;
  verb: string;
  text: string;
  textHash: string;
  version: number;
  isActive: boolean;
  supersededAt?: Date | null;
  classification?: unknown;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

export const LearningObjective = table<ILearningObjective>({
  delegate: () => prisma.learningObjective,
  jsonColumns: ['classification'],
  defaults: () => ({ version: 1, isActive: true }),
  columns: (objective) => ({
    userId: objective.userId,
    documentId: objective.documentId,
    objectiveId: objective.objectiveId,
    topicId: objective.topicId,
    knowledgeType: objective.knowledgeType,
    bloomLevel: objective.bloomLevel,
    verb: objective.verb,
    text: objective.text,
    textHash: objective.textHash,
    version: objective.version,
    isActive: objective.isActive,
    supersededAt: objective.supersededAt,
    classification: objective.classification as unknown as Prisma.InputJsonValue
  })
});

// ── Competency ────────────────────────────────────────────────────────────────

export interface IEvidenceEntry {
  objectiveId?: string;
  demonstratedBloomLevel?: string;
  masteryScore?: number;
  evaluatedAt?: Date;
  correlationId?: string;
}

export interface ICompetencyProfile {
  id: string;
  userId: string;
  topicId: string;
  knowledgeType: string;
  bloomLevel: string;
  score: number;
  confidence: number;
  evidence: IEvidenceEntry[];
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

export const CompetencyProfile = table<ICompetencyProfile>({
  delegate: () => prisma.competencyProfile,
  jsonColumns: ['evidence'],
  defaults: () => ({ score: 0, confidence: 0, evidence: [] }),
  columns: (profile) => ({
    userId: profile.userId,
    topicId: profile.topicId,
    knowledgeType: profile.knowledgeType,
    bloomLevel: profile.bloomLevel,
    score: profile.score,
    confidence: profile.confidence,
    evidence: profile.evidence as unknown as Prisma.InputJsonValue
  })
});

/**
 * BLOOM-08 idempotency claim store. A unique `correlationId` is the claim: the
 * first insert wins and a replay observes the existing row and ACK-skips.
 */
export const CompetencyProcessing = table<{
  id: string;
  correlationId: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>({
  delegate: () => prisma.competencyProcessing,
  columns: (row) => ({ correlationId: row.correlationId, processedAt: row.processedAt })
});

// ── Eval results (written by the orchestrator) ───────────────────────────────

export interface IEvalResultRecord {
  id: string;
  competencyProcessedAt?: Date | null;
  competencyLeaseUntil?: Date | null;
  competencyLeaseToken?: string | null;
  correlationId: string;
  messageId?: string;
  userId: string;
  sessionId: string;
  step: number;
  status?: string;
  masteryScore?: number | null;
  scores?: Record<string, number>;
  nextQuestion?: string | null;
  demonstratedBloomLevel?: string | null;
  objectiveId?: string | null;
  targetBloomLevel?: string | null;
  createdAt: Date;
}

export const EvalResultRecord = table<IEvalResultRecord>({
  delegate: () => prisma.evalResult,
  jsonColumns: ['scores'],
  columns: (row) => ({
    competencyProcessedAt: row.competencyProcessedAt,
    competencyLeaseUntil: row.competencyLeaseUntil,
    competencyLeaseToken: row.competencyLeaseToken,
    correlationId: row.correlationId,
    messageId: row.messageId,
    userId: row.userId,
    sessionId: row.sessionId,
    step: row.step,
    status: row.status,
    masteryScore: row.masteryScore,
    scores: row.scores as unknown as Prisma.InputJsonValue,
    nextQuestion: row.nextQuestion,
    demonstratedBloomLevel: row.demonstratedBloomLevel,
    objectiveId: row.objectiveId,
    targetBloomLevel: row.targetBloomLevel
  })
});

export { prisma, newId, toDocument, table, type Hydrated };

// Model modules that live in their own file but are part of this registry.
export { StudyRoom, mutateRoom, createRoomOnce } from './StudyRoom';
export type {
  IStudyRoom,
  IStudyRoomParticipant,
  IRoomCommandReceipt,
  RoomPhase,
  ModeratorMode
} from './StudyRoom';

export {
  CourseRevision,
  COURSE_REVISION_STATUSES,
  type CourseRevisionStatus,
  type ICourseRevision
} from './CourseRevision';
export {
  CourseEnrollment,
  COURSE_ENROLLMENT_STATUSES,
  type CourseEnrollmentStatus,
  type ICourseEnrollment
} from './CourseEnrollment';
export {
  CourseInvitation,
  COURSE_INVITATION_ROLES,
  COURSE_INVITATION_STATUSES,
  type CourseInvitationRole,
  type CourseInvitationStatus,
  type ICourseInvitation
} from './CourseInvitation';
export {
  Institution,
  InstitutionMembership,
  InstitutionInvitation,
  INSTITUTION_MEMBERSHIP_ROLES,
  INSTITUTION_MEMBERSHIP_STATUSES,
  INSTITUTION_INVITATION_ROLES,
  INSTITUTION_INVITATION_STATUSES,
  type IInstitution,
  type IInstitutionMembership,
  type IInstitutionInvitation,
  type InstitutionMembershipRole,
  type InstitutionMembershipStatus,
  type InstitutionInvitationRole,
  type InstitutionInvitationStatus
} from './Institution';
export { PublicCourseJoin, type IPublicCourseJoin } from './PublicCourseJoin';
export { ActivityRecord, type IActivityRecord } from './ActivityRecord';
export { StudentAttempt, type IStudentAttempt } from './StudentAttempt';
export { LearningEvidence, type ILearningEvidence } from './LearningEvidence';
export { VisualLab, type IVisualLab } from './VisualLab';
export {
  FacilitatorIntervention,
  type IFacilitatorIntervention,
  type FacilitatorStrategy,
  type FacilitatorTrigger,
  type InterventionStatus
} from './FacilitatorIntervention';
export { RoomWhiteboard, type IRoomWhiteboard } from './RoomWhiteboard';
export { CourseNardouchProgress, type ICourseNardouchProgress } from './CourseNardouchProgress';
export { NardouchConversationModel, type ConversationRecord } from './NardouchConversation';
export {
  LearnerAdaptationPreference,
  type ILearnerAdaptationPreference
} from './LearnerAdaptationPreference';
export {
  ExperiencePlanRequest,
  ACTIVE_STATES,
  type IExperiencePlanRequest,
  type ExperiencePlanRequestState
} from './ExperiencePlanRequest';
export { ExperiencePlanRecord, type IExperiencePlanRecord } from './ExperiencePlanRecord';
export {
  FormulaProposal,
  type IFormulaProposal,
  type FormulaProposalDecision
} from './FormulaProposal';
export { FormulaRecognitionJob, type IFormulaRecognitionJob } from './FormulaRecognitionJob';
export { StructuredAsset, type IStructuredAsset } from './StructuredAsset';
export { StructuredAssetReview, type IStructuredAssetReview } from './StructuredAssetReview';
export {
  CourseIngestionOperation,
  type IngestionOperation,
  type IngestionOperationState
} from './CourseIngestionOperation';

// Callers reach these through `import` above; nothing here replaces the module
// exports object, because doing so would hide every other re-export at runtime.
