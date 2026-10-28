import { materializeRevisionFixture, cleanupRevisionFixtures } from './revisionArtifactFixture';
import type { TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import {
  Course,
  CourseRevision,
  CourseEnrollment,
  Institution,
  InstitutionMembership
} from '../../modules/study/src/models';
import { captureActivitySources } from '../../modules/study/src/services/activityResolution';

/** Synthetic server-owned fixture setup only, never a runtime backfill/migration.
 * Older suites omitted institutions/memberships and invented source pins. They
 * must now construct the trusted prerequisites rather than bypass authorization.
 */
const fixtureInstitutions = new Set<string>();
export async function cleanupCourseFixtures() {
  await cleanupRevisionFixtures();
  if (fixtureInstitutions.size)
    await Institution.deleteMany({ _id: { $in: [...fixtureInstitutions] } });
  fixtureInstitutions.clear();
}

export async function prepareCourseFixture(courseId: string, t?: TestContext) {
  const course = await Course.findById(courseId);
  if (!course) throw new Error('Missing synthetic course fixture');
  if (course.scope === 'institutional' && course.institutionId) {
    const existed = await Institution.exists({ _id: course.institutionId });
    await Institution.updateOne(
      { _id: course.institutionId },
      {
        $setOnInsert: {
          name: 'Synthetic fixture institution',
          slug: 'fixture-' + course.institutionId.toString(),
          createdByUserId: course.userId,
          status: 'active'
        }
      },
      { upsert: true }
    );
    if (!existed) fixtureInstitutions.add(course.institutionId.toString());
    void t;
    for (const userId of course.assignedInstructorIds || [])
      await InstitutionMembership.updateOne(
        {
          institutionId: course.institutionId,
          userId
        },
        { $setOnInsert: { role: 'instructor', status: 'active' } },
        { upsert: true }
      );
    for (const enrollment of await CourseEnrollment.find({ courseId, status: 'active' })) {
      await CourseEnrollment.updateOne(
        { _id: enrollment._id },
        { $set: { institutionId: course.institutionId } }
      );
      await InstitutionMembership.updateOne(
        { institutionId: course.institutionId, userId: enrollment.userId },
        { $setOnInsert: { role: 'university_student', status: 'active' } },
        { upsert: true }
      );
    }
  }
  if (!captureActivitySources(course.files || [])) {
    const fileHash = createHash('sha256')
      .update('Synthetic reviewed source for ' + courseId)
      .digest('hex');
    course.files = [
      { filename: 'reviewed-source.txt', originalName: 'reviewed-source.txt', size: 80, fileHash }
    ];
    await course.save();
  }
}

export async function prepareDraftFixture(courseId: string, revisionTag: string) {
  await prepareCourseFixture(courseId);
  const revision = await CourseRevision.findOne({ courseId, revisionTag, status: 'draft' });
  if (!revision) throw new Error('Missing draft fixture');
  await materializeRevisionFixture(courseId, revisionTag);
  return 'sha256:' + revision.contentHash.replace(/^sha256:/, '');
}

export async function reviewActivityFixture(
  courseId: string,
  definition: Record<string, unknown>,
  evaluation: Record<string, unknown>
) {
  const revisionId = String(definition.revisionId);
  const contentHash = await prepareDraftFixture(courseId, revisionId);
  const revision = await CourseRevision.findOne({ courseId, revisionTag: revisionId }).lean();
  const manifest = revision!.sourceManifest!;
  // Explicit human-reviewed fixture corrections; never imply the legacy
  // generator supplied these real identities or known page locations.
  definition.contentHash = contentHash;
  definition.sourceRefs = manifest.map((s) => ({
    documentId: s.documentId,
    contentHash: s.contentHash,
    provenance: s.provenance,
    pageNumber: null,
    locationKnown: false
  }));
  evaluation.activity = {
    courseId,
    revisionId,
    contentHash,
    activityId: definition.activityId,
    activityRevision: definition.activityRevision,
    activityType: definition.activityType
  };
}
