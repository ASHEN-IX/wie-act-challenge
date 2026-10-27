import { Document, Model, Schema, Types, model, models } from 'mongoose';

export const COURSE_INVITATION_ROLES = ['student', 'instructor'] as const;
export type CourseInvitationRole = (typeof COURSE_INVITATION_ROLES)[number];

export const COURSE_INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type CourseInvitationStatus = (typeof COURSE_INVITATION_STATUSES)[number];

export interface ICourseInvitation {
  courseId: Types.ObjectId;
  institutionId?: Types.ObjectId;
  role: CourseInvitationRole;
  tokenHash: string;
  status: CourseInvitationStatus;
  issuedByUserId: string;
  acceptedByUserId?: string;
  acceptedAt?: Date;
  revokedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseInvitationDocument = ICourseInvitation & Document & { _id: Types.ObjectId };

const courseInvitationSchema = new Schema<ICourseInvitation>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      index: true
    },
    role: {
      type: String,
      enum: COURSE_INVITATION_ROLES,
      default: 'student',
      required: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false
    },
    status: {
      type: String,
      enum: COURSE_INVITATION_STATUSES,
      default: 'pending',
      required: true
    },
    issuedByUserId: {
      type: String,
      required: true
    },
    acceptedByUserId: {
      type: String
    },
    acceptedAt: {
      type: Date
    },
    revokedAt: {
      type: Date
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { collection: 'course_invitations', timestamps: true }
);

courseInvitationSchema.index({ courseId: 1, status: 1, expiresAt: 1 });

export const CourseInvitation =
  (models.CourseInvitation as Model<ICourseInvitation>) ||
  model<ICourseInvitation>('CourseInvitation', courseInvitationSchema, 'course_invitations');
