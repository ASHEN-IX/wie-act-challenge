import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import { cleanupCourseFixtures, prepareCourseFixture } from '../helpers/reviewedActivityFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import { newId } from '../../shared/ids';
import {
  Course,
  CourseEnrollment,
  CourseRevision,
  Institution,
  InstitutionMembership
} from '../../modules/study/src/models';
import {
  publishCourseRevision,
  getPublishedCourseContext,
  resolveCourseSource,
  PublicationForbiddenError,
  PublicationReviewRequiredError,
  PublicationConflictError,
  UnpublishedCourseError
} from '../../modules/study/src/services/coursePublication';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';

test('M08 / ED-05: Immutable Reviewed Publication & Revision Resolution Integration', async (t) => {
  await connectDatabase();

  const testPrefix = `m08_${Date.now()}`;
  const instructorId = `${testPrefix}_instructor`;
  const studentId = `${testPrefix}_student`;
  const nonEnrolledStudentId = `${testPrefix}_non_enrolled`;
  const foreignInstructorId = `${testPrefix}_foreign_inst`;
  const institutionId = newId();

  let courseId: string;
  let draftRevisionTag: string;

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseId) {
        await CourseRevision.deleteMany({ courseId });
      }
      await Course.deleteMany({ userId: { contains: testPrefix } });
      await CourseEnrollment.deleteMany({ userId: { contains: testPrefix } });
      await InstitutionMembership.deleteMany({ userId: { contains: testPrefix } });
      await Institution.deleteMany({ id: institutionId });
    } catch {
      // ignore
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });

  await t.test('Setup: Create institutional course with unreviewed draft', async () => {
    // Memberships carry a foreign key to the institution, so it exists first.
    await Institution.create({
      id: institutionId,
      name: 'M08 Publication Institution',
      slug: `m08-${institutionId}`,
      createdByUserId: instructorId,
      status: 'active'
    });

    // Add instructor membership
    await InstitutionMembership.create({
      institutionId,
      userId: instructorId,
      role: 'instructor',
      status: 'active'
    });

    // Add student membership
    await InstitutionMembership.create({
      institutionId,
      userId: studentId,
      role: 'university_student',
      status: 'active'
    });

    const initialTopics = [
      {
        id: 'top_db_1',
        title: 'Relational Database Design',
        description: 'Core relational theory',
        subtopics: [
          {
            id: 'sub_1nf',
            title: 'First Normal Form',
            summary: 'Atomic attributes without repeating groups',
            key_concepts: ['atomicity', 'primary_key'],
            sourceRefs: [{ fileId: 'f1', originalName: 'db_intro.pdf', pageRange: '1-10' }],
            provenance: 'extracted' as const,
            learning_objectives: [
              {
                id: 'obj_1nf_1',
                statement: 'Identify repeating groups and atomic attribute violations',
                bloomLevel: 'analyze',
                provenance: 'extracted' as const
              }
            ]
          }
        ]
      }
    ];

    const courseDoc = await Course.create({
      userId: instructorId,
      ownerUserId: instructorId,
      scope: 'institutional',
      institutionId,
      assignedInstructorIds: [instructorId],
      subjectId: 'sub_cs',
      title: 'Database Systems & Design',
      description: 'Undergraduate database engineering',
      status: 'completed',
      ingestProgress: 1,
      ingestDetail: 'done',
      ingestError: '',
      topics: initialTopics,
      files: [
        {
          filename: 'db_intro.pdf',
          originalName: 'db_intro.pdf',
          fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        }
      ]
    });
    courseId = courseDoc.id.toString();
    await prepareCourseFixture(courseId, t);

    // Active enrollment for student
    await CourseEnrollment.create({
      courseId,
      userId: studentId,
      status: 'active'
    });

    draftRevisionTag = `rev_${Date.now()}`;
    await CourseRevision.create({
      courseId,
      revisionTag: draftRevisionTag,
      contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'draft',
      topics: initialTopics,
      isInstructorReviewed: false,
      vectorIndexRef: `faiss/${courseId}/${draftRevisionTag}.faiss`
    });

    assert.ok(courseId);

    await prepareCourseFixture(courseId, t);
  });

  await t.test('ED-05.1 Guard: Unreviewed draft cannot be published', async () => {
    await assert.rejects(
      async () => {
        await publishCourseRevision(instructorId, courseId, draftRevisionTag);
      },
      (err: unknown) => {
        assert.ok(err instanceof PublicationReviewRequiredError);
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  await t.test('ED-05.1: Assigned instructor reviews and publishes course revision', async () => {
    // Instructor reviews the draft
    const reviewUpdate = await updateCourseDraft(instructorId, courseId, {
      expectedRevisionTag: draftRevisionTag,
      topics: [
        {
          id: 'top_db_1',
          title: 'Relational Database Design',
          subtopics: [
            {
              id: 'sub_1nf',
              title: 'First Normal Form (1NF)',
              summary: 'Atomic attributes without repeating groups',
              learning_objectives: [
                {
                  id: 'obj_1nf_1',
                  statement: 'Identify repeating groups and atomic attribute violations',
                  bloomLevel: 'analyze'
                }
              ]
            }
          ]
        }
      ],
      isInstructorReviewed: true
    });

    const reviewedRevisionTag = reviewUpdate.revisionTag;
    assert.equal(reviewUpdate.isInstructorReviewed, true);

    // Publish the reviewed draft
    await materializeRevisionFixture(courseId, reviewedRevisionTag);
    const publishResult = await publishCourseRevision(instructorId, courseId, reviewedRevisionTag);
    assert.equal(publishResult.success, true);
    assert.equal(publishResult.publishedRevisionTag, reviewedRevisionTag);
    assert.ok(publishResult.publishedAt);

    // Verify course activeRevisionId was updated
    const updatedCourse = await Course.findById(courseId);
    assert.equal(updatedCourse!.activeRevisionId, reviewedRevisionTag);

    // Verify revision status is published
    const publishedRev = await CourseRevision.findOne({
      courseId,
      revisionTag: reviewedRevisionTag
    });
    assert.equal(publishedRev!.status, 'published');
    assert.equal(publishedRev!.publishedByUserId, instructorId);
  });

  await t.test('ED-05.2: Enrolled student retrieves Contract 03 PublishedContext', async () => {
    const publishedContext = await getPublishedCourseContext(studentId, courseId);

    // Verify Contract 03 shape and invariants
    assert.equal(publishedContext.schemaVersion, '1.0.0');
    assert.equal(publishedContext.visibility, 'authorized_learner');
    assert.equal(publishedContext.courseId, courseId);
    assert.equal(publishedContext.isPublished, true);
    assert.equal(publishedContext.title, 'Database Systems & Design');
    assert.ok(publishedContext.contentHash.startsWith('sha256:'));
    assert.ok(publishedContext.publishedAt);

    // Document and source linkage
    assert.equal(publishedContext.sources.length, 1);
    assert.equal(publishedContext.sources[0].provenance, 'extracted');
    assert.equal(publishedContext.authorizedDocumentIds.length, 1);
    assert.equal(publishedContext.authorizedDocumentIds[0], publishedContext.sources[0].documentId);

    // Topics & objectives
    assert.equal(publishedContext.topics.length, 1);
    assert.equal(publishedContext.topics[0].title, 'Relational Database Design');
    assert.equal(publishedContext.topics[0].objectives.length, 1);
    assert.equal(
      publishedContext.topics[0].objectives[0].statement,
      'Identify repeating groups and atomic attribute violations'
    );
    assert.equal(publishedContext.topics[0].objectives[0].bloomLevel, 'analyze');

    // Rule: Vector index reference MUST NOT be exposed in public PublishedContext
    assert.equal(Reflect.get(publishedContext, 'vectorIndexRef'), undefined);
  });

  await t.test(
    'Server-Only SourceResolution includes vectorIndexRef & AccessDecision',
    async () => {
      const resolution = await resolveCourseSource(studentId, courseId);

      assert.equal(resolution.schemaVersion, '1.0.0');
      assert.equal(resolution.visibility, 'server_only');
      assert.equal(resolution.access.decision, 'allowed');
      assert.equal(resolution.access.grant, 'active_enrollment');
      assert.ok(resolution.vectorIndexRef!.includes(`faiss/${courseId}/`));
      assert.equal(resolution.pin!.courseId, courseId);
    }
  );

  await t.test('ED-05.3: Failed replacement draft leaves published version intact', async () => {
    // Retrieve the active published revision tag
    const currentCourse = await Course.findById(courseId);
    const activePublishedTag = currentCourse!.activeRevisionId!;

    // Create a new unreviewed draft
    const newDraftTag = `rev_draft_${Date.now()}`;
    await CourseRevision.create({
      courseId,
      revisionTag: newDraftTag,
      contentHash: 'new_draft_hash',
      status: 'draft',
      topics: [{ title: 'Unreviewed Topic', subtopics: [] }],
      isInstructorReviewed: false
    });

    // Attempt to publish without review -> Fails!
    await assert.rejects(
      async () => {
        await publishCourseRevision(instructorId, courseId, newDraftTag);
      },
      (err: unknown) => {
        assert.ok(err instanceof PublicationReviewRequiredError);
        return true;
      }
    );

    // Verify course activeRevisionId is STILL the original published revision!
    const unchangedCourse = await Course.findById(courseId);
    assert.equal(unchangedCourse!.activeRevisionId, activePublishedTag);

    // Verify enrolled student still receives original published revision context
    const studentContext = await getPublishedCourseContext(studentId, courseId);
    assert.equal(studentContext.revisionId, activePublishedTag);
    assert.equal(studentContext.topics[0].title, 'Relational Database Design');
  });

  await t.test('Security & Authorization Guards on Publication and Context', async () => {
    // Non-enrolled student cannot read published context (403 Forbidden)
    await assert.rejects(
      async () => {
        await getPublishedCourseContext(nonEnrolledStudentId, courseId);
      },
      (err: unknown) => {
        assert.ok(err instanceof PublicationForbiddenError);
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Foreign instructor cannot publish course (403 Forbidden)
    await assert.rejects(
      async () => {
        await publishCourseRevision(foreignInstructorId, courseId);
      },
      (err: unknown) => {
        assert.ok(err instanceof PublicationForbiddenError);
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Enrolled student cannot publish course (403 Forbidden)
    await assert.rejects(
      async () => {
        await publishCourseRevision(studentId, courseId);
      },
      (err: unknown) => {
        assert.ok(err instanceof PublicationForbiddenError);
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Stale revision tag in publish call throws 409 Conflict
    await assert.rejects(
      async () => {
        await publishCourseRevision(instructorId, courseId, 'stale_tag_123');
      },
      (err: unknown) => {
        assert.ok(err instanceof PublicationConflictError);
        assert.equal(err.status, 409);
        return true;
      }
    );

    // Unpublished course throws UnpublishedCourseError
    const unpublishedCourse = await Course.create({
      userId: instructorId,
      ownerUserId: instructorId,
      subjectId: 'sub_temp',
      title: 'Unpublished Course',
      status: 'completed',
      ingestProgress: 1,
      ingestDetail: 'done',
      ingestError: ''
    });

    await assert.rejects(
      async () => {
        await getPublishedCourseContext(instructorId, unpublishedCourse.id.toString());
      },
      (err: unknown) => {
        assert.ok(err instanceof UnpublishedCourseError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'UNPUBLISHED');
        return true;
      }
    );
  });
});
