import mongoose, { Document, Model, Schema } from 'mongoose';

// ── Interfaces ─────────────────────────────────────────────────────────────────

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

export interface IStudySession extends Document {
  userId: string;
  taskId?: string;
  topicId?: string;
  courseId?: string;
  studyPlanId?: string;
  mode: 'focus' | 'pomodoro' | 'exam';
  challengeDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
  taskProgress: {
    currentTaskIndex: number;
    tasks: ITaskProgressEntry[];
    totalTasks: number;
    completedTasks: number;
  };
  xpMultiplier: number;
  duration?: number;
  status: 'active' | 'completed';
  startTime: Date;
  endTime?: Date;
  focusScore?: number;
  completedAt: Date;
  notes?: string;
  signalHistory: ISignalHistoryEntry[];
  breakStats: {
    totalBreaks: number;
    totalBreakDuration: number;
    avgBreakDuration: number;
  };
  type: 'solo' | 'team';
  participants: IParticipant[];
  inviteCode?: string;
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask extends Document {
  userId: string;
  studyPlanId?: string;
  title: string;
  description?: string;
  topicId?: string;
  objectiveId?: string;
  targetBloomLevel?: string;
  priority: 'low' | 'medium' | 'high';
  estimatedTime?: number;
  actualTime: number;
  status: 'todo' | 'in-progress' | 'completed' | 'cancelled';
  dueDate?: Date;
  completedAt?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITopic extends Document {
  userId: string;
  name: string;
  description?: string;
  category?: string;
  color: string;
  totalStudyTime: number;
  mastery: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubject extends Document {
  userId: string;
  name: string;
  description?: string;
  image?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface ICourse extends Document {
  userId: string;
  scope?: CourseScope;
  institutionId?: mongoose.Types.ObjectId;
  ownerUserId?: string;
  assignedInstructorIds?: string[];
  activeRevisionId?: string;
  subjectId: string;
  title: string;
  description?: string;
  status: 'processing' | 'completed' | 'failed';
  jobId?: string;
  correlationId?: string;
  ingestStage?: 'parsing' | 'enriching' | 'embedding' | 'indexing' | null;
  ingestProgress: number;
  ingestDetail: string;
  ingestError: string;
  topics: ICourseTopic[];
  files: ICourseFile[];
  processedAt?: Date;
  aiCourseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILearningObjective extends Document {
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
}

export interface IEvidenceEntry {
  objectiveId?: string;
  demonstratedBloomLevel?: string;
  masteryScore?: number;
  evaluatedAt?: Date;
  correlationId?: string;
}

export interface ICompetencyProfile extends Document {
  userId: string;
  topicId: string;
  knowledgeType: string;
  bloomLevel: string;
  score: number;
  confidence: number;
  evidence: IEvidenceEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvalResultRecord extends Document {
  competencyProcessedAt?: Date | null;
  competencyLeaseUntil?: Date | null;
  competencyLeaseToken?: string;
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

export interface ICompetencyProcessing extends Document {
  correlationId: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface IStudyPlan extends Document {
  resourceScope?: { courseId?: string };
  userId: string;
  courseId?: string;
  goal: string;
  availableTimeMinutes: number;
  taskGraph: {
    goal?: string;
    tasks?: IStudyPlanTask[];
  };
  totalEstimatedMinutes?: number;
  warning?: string;
  status: 'created' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const studySessionSchema = new Schema<IStudySession>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    taskId: {
      type: String
    },
    topicId: {
      type: String
    },
    // Course-based session fields
    courseId: {
      type: String,
      index: true
    },
    studyPlanId: {
      type: String,
      index: true
    },
    mode: {
      type: String,
      enum: ['focus', 'pomodoro', 'exam'],
      default: 'focus'
    },
    challengeDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
      default: 'medium'
    },
    // Task-by-task progression
    taskProgress: {
      currentTaskIndex: { type: Number, default: 0 },
      tasks: [
        {
          taskId: String,
          title: String,
          description: String,
          status: {
            type: String,
            enum: ['pending', 'in-progress', 'completed', 'skipped'],
            default: 'pending'
          },
          startedAt: Date,
          completedAt: Date,
          xpEarned: { type: Number, default: 0 }
        }
      ],
      totalTasks: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 }
    },
    // XP multiplier for team sessions
    xpMultiplier: {
      type: Number,
      default: 1.0
    },
    duration: {
      type: Number // in minutes
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'completed'
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    focusScore: {
      type: Number,
      min: 0,
      max: 100
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: 1000
    },
    signalHistory: [
      {
        timestamp: Date,
        focusLevel: Number,
        fatigueLevel: Number,
        isDistracted: Boolean
      }
    ],
    breakStats: {
      totalBreaks: { type: Number, default: 0 },
      totalBreakDuration: { type: Number, default: 0 }, // seconds
      avgBreakDuration: { type: Number, default: 0 }
    },
    // Team session fields
    type: {
      type: String,
      enum: ['solo', 'team'],
      default: 'solo'
    },
    participants: [
      {
        userId: { type: String, required: true },
        name: { type: String },
        avatar: { type: String },
        role: { type: String, enum: ['host', 'member'], default: 'member' },
        hasVoiceConsent: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date }
      }
    ],
    inviteCode: {
      type: String,
      unique: true,
      sparse: true
    },
    maxParticipants: {
      type: Number,
      default: 5,
      max: 10
    }
  },
  {
    timestamps: true
  }
);

const taskSchema = new Schema<ITask>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    studyPlanId: {
      type: String,
      index: true // Link to study plan if task came from planner
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    topicId: {
      type: String
    },
    // BLOOM-10: competency target for weakest-first planning. `objectiveId`
    // is the learning objective / subtopic id the task strengthens at
    // `targetBloomLevel`. Optional — absent for fallback/degraded plans.
    objectiveId: {
      type: String
    },
    targetBloomLevel: {
      type: String
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    estimatedTime: {
      type: Number // in minutes
    },
    actualTime: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'completed', 'cancelled'],
      default: 'todo'
    },
    dueDate: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    tags: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true
  }
);

const topicSchema = new Schema<ITopic>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    category: {
      type: String
    },
    color: {
      type: String,
      default: '#ff4655'
    },
    totalStudyTime: {
      type: Number,
      default: 0
    },
    mastery: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const subjectSchema = new Schema<ISubject>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    image: {
      type: String // URL to subject image
    },
    color: {
      type: String,
      default: '#ff4655'
    }
  },
  {
    timestamps: true
  }
);

const courseSchema = new Schema<ICourse>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    scope: {
      type: String,
      enum: ['personal', 'institutional'],
      default: 'personal',
      required: true
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      index: true
    },
    ownerUserId: {
      type: String
    },
    assignedInstructorIds: {
      type: [String],
      default: []
    },
    activeRevisionId: {
      type: String
    },
    subjectId: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing'
    },
    // INGEST-07: the job that (re)ingests this course — matches the AI
    // envelope's messageId (jobId) and correlationId used to correlate
    // progress/result events back to the course document.
    jobId: {
      type: String,
      index: true
    },
    correlationId: {
      type: String,
      index: true
    },
    // INGEST-07: live ingestion progress surfaced via
    // GET /api/v1/study/courses/:courseId/ingest-status.
    ingestStage: {
      type: String,
      enum: ['parsing', 'enriching', 'embedding', 'indexing'],
      default: null
    },
    ingestProgress: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    ingestDetail: {
      type: String,
      default: ''
    },
    ingestError: {
      type: String,
      default: ''
    },
    topics: [
      {
        title: String,
        subtopics: [
          {
            id: String,
            title: String,
            summary: String,
            key_concepts: [String],
            definitions: [
              {
                term: String,
                definition: String
              }
            ],
            formulas: [String],
            examples: [String],
            source_spans: [Schema.Types.Mixed],
            structured_blocks: [Schema.Types.Mixed],
            tokenized_chunks: [String],
            learning_objectives: [Schema.Types.Mixed]
          }
        ]
      }
    ],
    files: [
      {
        filename: String,
        originalName: String,
        size: Number,
        fileHash: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    processedAt: {
      type: Date
    },
    aiCourseId: {
      type: String,
      index: true // Link to AI service course record
    }
  },
  {
    timestamps: true
  }
);

courseSchema.index({ institutionId: 1, scope: 1 });
courseSchema.index({ ownerUserId: 1 });
courseSchema.index({ assignedInstructorIds: 1 });

courseSchema.pre('validate', function () {
  if (!this.ownerUserId && this.userId) {
    this.ownerUserId = this.userId;
  }
  if (!this.userId && this.ownerUserId) {
    this.userId = this.ownerUserId;
  }
  if (this.institutionId && (!this.scope || this.scope === 'personal')) {
    this.scope = 'institutional';
  }
});

const learningObjectiveSchema = new Schema<ILearningObjective>(
  {
    userId: {
      type: String,
      required: true
    },
    documentId: {
      type: String,
      required: true
    },
    objectiveId: {
      type: String,
      required: true
    },
    topicId: {
      type: String,
      required: true
    },
    knowledgeType: {
      type: String,
      required: true
    },
    bloomLevel: {
      type: String,
      required: true
    },
    verb: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    textHash: {
      type: String,
      required: true
    },
    version: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    },
    supersededAt: {
      type: Date
    },
    classification: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const competencyProfileSchema = new Schema<ICompetencyProfile>(
  {
    userId: {
      type: String,
      required: true
    },
    topicId: {
      type: String,
      required: true
    },
    knowledgeType: {
      type: String,
      required: true
    },
    bloomLevel: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1
    },
    confidence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1
    },
    evidence: {
      type: [
        {
          objectiveId: String,
          demonstratedBloomLevel: String,
          masteryScore: Number,
          evaluatedAt: Date,
          correlationId: String
        }
      ],
      default: [],
      validate: {
        validator: function (v: IEvidenceEntry[]) {
          return v.length <= 20;
        },
        message: 'Evidence array capped at 20 entries'
      }
    }
  },
  {
    timestamps: true
  }
);

// ── BLOOM-08: EvalResultRecord (read-only view of eval_results collection) ───
// The orchestrator writes eval_results; the study service reads them to
// feed the competency updater. Shared DB, separate process.
const evalResultRecordSchema = new Schema<IEvalResultRecord>(
  {
    competencyProcessedAt: { type: Date, default: null },
    competencyLeaseUntil: { type: Date, default: null },
    competencyLeaseToken: { type: String },
    correlationId: { type: String, required: true },
    messageId: { type: String },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    step: { type: Number, required: true },
    status: { type: String },
    masteryScore: { type: Number, default: null },
    scores: { type: Schema.Types.Mixed, default: {} },
    nextQuestion: { type: String, default: null },
    demonstratedBloomLevel: { type: String, default: null },
    objectiveId: { type: String, default: null },
    targetBloomLevel: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  {
    collection: 'eval_results',
    timestamps: false
  }
);

evalResultRecordSchema.index({ competencyProcessedAt: 1, competencyLeaseUntil: 1, createdAt: 1 });
evalResultRecordSchema.index({ demonstratedBloomLevel: 1 });
evalResultRecordSchema.index({ objectiveId: 1 });

// ── BLOOM-08: CompetencyProcessing (idempotency claim store) ─────────────────
// Each eval result is claimed exactly once via unique correlationId.
// Replays/retries find the existing claim and skip (ACK-skip semantics).
const competencyProcessingSchema = new Schema<ICompetencyProcessing>(
  {
    correlationId: {
      type: String,
      required: true,
      unique: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const studyPlanSchema = new Schema<IStudyPlan>(
  {
    resourceScope: { type: Schema.Types.Mixed },
    userId: {
      type: String,
      required: true,
      index: true
    },
    courseId: {
      type: String,
      index: true // Optional: link to course if plan was generated from course
    },
    goal: {
      type: String,
      required: true
    },
    availableTimeMinutes: {
      type: Number,
      required: true
    },
    taskGraph: {
      goal: String,
      tasks: [
        {
          id: String,
          title: String,
          description: String,
          estimated_minutes: Number,
          difficulty: Number,
          prerequisites: [String],
          is_review: Boolean,
          // BLOOM-10: competency target echoed from the AI result (snake_case).
          objective_id: String,
          target_bloom_level: String
        }
      ]
    },
    totalEstimatedMinutes: {
      type: Number
    },
    warning: {
      type: String
    },
    status: {
      type: String,
      enum: ['created', 'scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'created'
    },
    scheduledAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    minimize: false
  }
);

// --- Compound indexes for hot query patterns ---
studySessionSchema.index({ userId: 1, completedAt: -1 });
studySessionSchema.index({ userId: 1, status: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1, createdAt: -1 });

// BLOOM-06: learning objective indexes
learningObjectiveSchema.index({ topicId: 1, bloomLevel: 1 });
learningObjectiveSchema.index({ documentId: 1 });
learningObjectiveSchema.index({ documentId: 1, topicId: 1, textHash: 1 }, { unique: true });

// BLOOM-07: competency profile indexes
competencyProfileSchema.index({ userId: 1, topicId: 1 });
competencyProfileSchema.index(
  { userId: 1, topicId: 1, knowledgeType: 1, bloomLevel: 1 },
  { unique: true }
);

const StudySession =
  (mongoose.models.StudySession as Model<IStudySession>) ||
  mongoose.model<IStudySession>('StudySession', studySessionSchema);
const Task = (mongoose.models.Task as Model<ITask>) || mongoose.model<ITask>('Task', taskSchema);
const Topic =
  (mongoose.models.Topic as Model<ITopic>) || mongoose.model<ITopic>('Topic', topicSchema);
const Subject =
  (mongoose.models.Subject as Model<ISubject>) ||
  mongoose.model<ISubject>('Subject', subjectSchema);
const Course =
  (mongoose.models.Course as Model<ICourse>) || mongoose.model<ICourse>('Course', courseSchema);
const StudyPlan =
  (mongoose.models.StudyPlan as Model<IStudyPlan>) ||
  mongoose.model<IStudyPlan>('StudyPlan', studyPlanSchema);
const LearningObjective =
  (mongoose.models.LearningObjective as Model<ILearningObjective>) ||
  mongoose.model<ILearningObjective>(
    'LearningObjective',
    learningObjectiveSchema,
    'learning_objectives'
  );
const CompetencyProfile =
  (mongoose.models.CompetencyProfile as Model<ICompetencyProfile>) ||
  mongoose.model<ICompetencyProfile>(
    'CompetencyProfile',
    competencyProfileSchema,
    'competency_profiles'
  );

// BLOOM-08: read-only view of eval_results (written by orchestrator)
const EvalResultRecord =
  (mongoose.models.EvalResultRecord as Model<IEvalResultRecord>) ||
  mongoose.model<IEvalResultRecord>('EvalResultRecord', evalResultRecordSchema, 'eval_results');

// BLOOM-08: idempotency claim store for competency updates
const CompetencyProcessing =
  (mongoose.models.CompetencyProcessing as Model<ICompetencyProcessing>) ||
  mongoose.model<ICompetencyProcessing>(
    'CompetencyProcessing',
    competencyProcessingSchema,
    'competency_processing'
  );

export {
  StudySession,
  Task,
  Topic,
  Subject,
  Course,
  StudyPlan,
  LearningObjective,
  CompetencyProfile,
  EvalResultRecord,
  CompetencyProcessing
};

export {
  StudyRoom,
  IStudyRoom,
  IStudyRoomParticipant,
  RoomPhase,
  ModeratorMode
} from './StudyRoom';

export {
  CourseEnrollment,
  ICourseEnrollment,
  CourseEnrollmentStatus,
  COURSE_ENROLLMENT_STATUSES
} from './CourseEnrollment';

export {
  CourseInvitation,
  ICourseInvitation,
  CourseInvitationRole,
  CourseInvitationStatus,
  COURSE_INVITATION_ROLES,
  COURSE_INVITATION_STATUSES
} from './CourseInvitation';

export {
  CourseRevision,
  ICourseRevision,
  CourseRevisionStatus,
  COURSE_REVISION_STATUSES
} from './CourseRevision';

export {
  Institution,
  InstitutionMembership,
  InstitutionInvitation,
  INSTITUTION_MEMBERSHIP_ROLES,
  INSTITUTION_MEMBERSHIP_STATUSES,
  INSTITUTION_INVITATION_ROLES,
  INSTITUTION_INVITATION_STATUSES
} from './Institution';
export type {
  IInstitution,
  IInstitutionMembership,
  IInstitutionInvitation,
  InstitutionMembershipRole,
  InstitutionMembershipStatus,
  InstitutionInvitationRole,
  InstitutionInvitationStatus
} from './Institution';
export {
  FacilitatorIntervention,
  IFacilitatorIntervention,
  FacilitatorStrategy,
  FacilitatorTrigger,
  InterventionStatus
} from './FacilitatorIntervention';
export { StudentAttempt, IStudentAttempt } from './StudentAttempt';
export { LearningEvidence, ILearningEvidence } from './LearningEvidence';
export { ActivityRecord, IActivityRecord } from './ActivityRecord';
export { VisualLab, IVisualLab } from './VisualLab';

module.exports = {
  StudySession,
  StudyRoom: require('./StudyRoom').StudyRoom,
  FacilitatorIntervention: require('./FacilitatorIntervention').FacilitatorIntervention,
  Institution: require('./Institution').Institution,
  InstitutionMembership: require('./Institution').InstitutionMembership,
  InstitutionInvitation: require('./Institution').InstitutionInvitation,
  CourseEnrollment: require('./CourseEnrollment').CourseEnrollment,
  CourseInvitation: require('./CourseInvitation').CourseInvitation,
  CourseRevision: require('./CourseRevision').CourseRevision,
  StudentAttempt: require('./StudentAttempt').StudentAttempt,
  LearningEvidence: require('./LearningEvidence').LearningEvidence,
  ActivityRecord: require('./ActivityRecord').ActivityRecord,
  VisualLab: require('./VisualLab').VisualLab,
  Task,
  Topic,
  Subject,
  Course,
  StudyPlan,
  LearningObjective,
  CompetencyProfile,
  EvalResultRecord,
  CompetencyProcessing
};
