import type { ICourse } from '../modules/study/src/models';
import type { sanitizeCourseFromResult } from '../modules/study/src/services/ingestStatus';

/** Shape exercised by ingestion fixtures; persistence methods remain explicit Jest doubles. */
export interface CourseFixture extends Partial<
  Pick<
    ICourse,
    | 'userId'
    | 'subjectId'
    | 'title'
    | 'description'
    | 'status'
    | 'files'
    | 'jobId'
    | 'correlationId'
    | 'ingestStage'
    | 'ingestProgress'
    | 'ingestDetail'
    | 'ingestError'
    | 'processedAt'
    | 'aiCourseId'
    | 'createdAt'
    | 'updatedAt'
  >
> {
  id: string;
  save: jest.Mock;
  topics?: ReturnType<typeof sanitizeCourseFromResult>;
  topLevelJunk?: string;
  set?(key: string, value: unknown): CourseFixture;
}
