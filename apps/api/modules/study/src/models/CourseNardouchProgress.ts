import mongoose, { Schema } from 'mongoose';

interface ICourseNardouchProgress {
  userId: string;
  courseId: string;
  revisionId: string;
  completedLessonIds: string[];
}

const schema = new Schema<ICourseNardouchProgress>(
  {
    userId: { type: String, required: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    completedLessonIds: { type: [String], default: [] }
  },
  { timestamps: true, collection: 'course_nardouch_progress' }
);
schema.index({ userId: 1, courseId: 1, revisionId: 1 }, { unique: true });

export const CourseNardouchProgress =
  (mongoose.models.CourseNardouchProgress as mongoose.Model<ICourseNardouchProgress> | undefined) ??
  mongoose.model<ICourseNardouchProgress>('CourseNardouchProgress', schema);
