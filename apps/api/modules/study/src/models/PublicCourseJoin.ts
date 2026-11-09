import { Model, Schema, Types, model, models } from 'mongoose';

/**
 * A learner who added a public course to "My learning".
 *
 * Deliberately not a CourseEnrollment: institutional enrollments feed rosters and
 * instructor analytics, and a public learner is not an institution member. This
 * record grants nothing by itself; access comes from the course being public.
 */
export interface IPublicCourseJoin {
  userId: string;
  courseId: Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<IPublicCourseJoin>(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true }
  },
  { collection: 'public_course_joins', timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ userId: 1, courseId: 1 }, { unique: true });

export const PublicCourseJoin: Model<IPublicCourseJoin> =
  (models.PublicCourseJoin as Model<IPublicCourseJoin>) ||
  model<IPublicCourseJoin>('PublicCourseJoin', schema);
