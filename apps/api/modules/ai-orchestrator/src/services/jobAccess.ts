import { canReadCourse } from '../../../study/src/services/resourceAccess';
import type { IAiJob } from '../models/AiJob';

/** Check the current grant even for a completed/cached result. Legacy jobs
 * without recorded scope fail closed; they must be resubmitted. */
export async function canDeliverJob(
  job: Pick<IAiJob, 'userId' | 'resourceScope'>
): Promise<boolean> {
  if (
    !job.resourceScope ||
    typeof job.resourceScope !== 'object' ||
    Array.isArray(job.resourceScope)
  )
    return false;
  return (
    job.resourceScope.courseId === undefined ||
    (await canReadCourse(job.userId, job.resourceScope.courseId))
  );
}
