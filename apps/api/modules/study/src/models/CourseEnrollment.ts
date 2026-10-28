import { Document, Model, Schema, Types, model, models } from 'mongoose';

export const COURSE_ENROLLMENT_STATUSES = ['active', 'dropped', 'revoked'] as const;
export type CourseEnrollmentStatus = (typeof COURSE_ENROLLMENT_STATUSES)[number];

export interface ICourseEnrollment {
  courseId: Types.ObjectId;
  institutionId?: Types.ObjectId;
  userId: string;
  status: CourseEnrollmentStatus;
  enrolledAt: Date;
  enrolledByUserId?: string;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseEnrollmentDocument = ICourseEnrollment & Document & { _id: Types.ObjectId };

const courseEnrollmentSchema = new Schema<ICourseEnrollment>(
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
    userId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: COURSE_ENROLLMENT_STATUSES,
      default: 'active',
      required: true
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    enrolledByUserId: {
      type: String
    },
    revokedAt: {
      type: Date
    }
  },
  { collection: 'course_enrollments', timestamps: true }
);

courseEnrollmentSchema.index({ courseId: 1, userId: 1 }, { unique: true });
courseEnrollmentSchema.index({ userId: 1, status: 1 });
courseEnrollmentSchema.index({ institutionId: 1, status: 1 });

export const CourseEnrollment =
  (models.CourseEnrollment as Model<ICourseEnrollment>) ||
  model<ICourseEnrollment>('CourseEnrollment', courseEnrollmentSchema, 'course_enrollments');
