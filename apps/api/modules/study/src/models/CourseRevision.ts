import { Document, Model, Schema, Types, model, models } from 'mongoose';

export const COURSE_REVISION_STATUSES = ['draft', 'published', 'deprecated'] as const;
export type CourseRevisionStatus = (typeof COURSE_REVISION_STATUSES)[number];

export interface ICourseRevision {
  courseId: Types.ObjectId;
  revisionTag: string;
  contentHash: string;
  status: CourseRevisionStatus;
  publishedByUserId?: string;
  publishedAt?: Date;
  summary?: string;
  topics?: Array<{
    id: string;
    title: string;
    description?: string;
    objectives?: Array<{
      id: string;
      text: string;
      bloomLevel: string;
    }>;
    subtopics?: Array<{
      id: string;
      title: string;
      source_spans?: Array<{
        chunkId: string;
        documentId: string;
        pageNumber: number | null;
        lineStart: number;
        lineEnd: number;
      }>;
      structured_blocks?: unknown[];
      learning_objectives?: Array<{
        id?: string;
        statement?: string;
        text?: string;
        bloomLevel?: string;
      }>;
    }>;
  }>;
  /** Canonical source-backed reading document. Optional for legacy revisions. */
  contentDocument?: unknown;
  formulaPublication?: any;
  /** Hash of the canonical reading document, independent of draft metadata. */
  contentDocumentHash?: string;
  vectorIndexRef?: string;
  isInstructorReviewed: boolean;
  /** Server-captured source inventory. Legacy revisions without it cannot execute activities. */
  sourceManifest?: Array<{
    documentId: string;
    filename: string;
    contentHash: string;
    provenance: 'extracted';
    storageRef?: string;
    mediaType?: string;
  }>;
  revokedAt?: Date;
  sourceManifestDigest?: string;
  indexHash?: string;
  artifactHash?: string;
  activationState?: 'prepared' | 'committed';
  expectedActiveRevisionId?: string | null;
  approvedActivities?: Array<{
    activityId: string;
    activityRevision: string;
    definitionHash: string;
    evaluationHash: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseRevisionDocument = ICourseRevision & Document & { _id: Types.ObjectId };

const courseRevisionSchema = new Schema<ICourseRevision>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    revisionTag: {
      type: String,
      required: true,
      trim: true
    },
    contentHash: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: COURSE_REVISION_STATUSES,
      default: 'draft',
      required: true
    },
    publishedByUserId: {
      type: String
    },
    publishedAt: {
      type: Date
    },
    summary: {
      type: String
    },
    topics: {
      type: [Schema.Types.Mixed],
      default: []
    },
    formulaPublication: { type: Schema.Types.Mixed, default: undefined },
    contentDocument: {
      type: Schema.Types.Mixed,
      default: undefined
    },
    contentDocumentHash: {
      type: String
    },
    vectorIndexRef: {
      type: String
    },
    isInstructorReviewed: {
      type: Boolean,
      default: false
    },
    sourceManifest: {
      type: [Schema.Types.Mixed],
      default: undefined,
      immutable: true
    },
    revokedAt: Date,
    sourceManifestDigest: String,
    indexHash: String,
    artifactHash: String,
    activationState: { type: String, enum: ['prepared', 'committed'] },
    expectedActiveRevisionId: { type: String },
    approvedActivities: {
      type: [Schema.Types.Mixed],
      default: undefined
    }
  },
  { collection: 'course_revisions', timestamps: true }
);

courseRevisionSchema.index({ courseId: 1, revisionTag: 1 }, { unique: true });
courseRevisionSchema.index({ courseId: 1, status: 1 });

export const CourseRevision =
  (models.CourseRevision as Model<ICourseRevision>) ||
  model<ICourseRevision>('CourseRevision', courseRevisionSchema, 'course_revisions');
