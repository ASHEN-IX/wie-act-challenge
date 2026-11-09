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
  getCourseDraft,
  updateCourseDraft,
  StaleRevisionError,
  HierarchyValidationError,
  DraftForbiddenError
} from '../../modules/study/src/services/courseDraft';
import { handleIngestResult } from '../../modules/study/src/services/ingestStatus';

test('M07 / ED-30: Course Studio Versioned Draft APIs & Learning Objectives', async (t) => {
  await connectDatabase();

  const testPrefix = `m07_${Date.now()}`;
  const instructorId = `${testPrefix}_instructor`;
  const studentId = `${testPrefix}_student`;
  const foreignUserId = `${testPrefix}_foreign`;
  const institutionId = newId();

  let courseId: string;
  let initialRevisionTag: string;

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseId) await CourseRevision.deleteMany({ courseId });
      await Course.deleteMany({ userId: { contains: testPrefix } });
      await CourseEnrollment.deleteMany({ userId: { contains: testPrefix } });
      await InstitutionMembership.deleteMany({ userId: { contains: testPrefix } });
    } catch {
      // ignore
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });

  await t.test('Setup: Create institutional course with draft revision', async () => {
    // Memberships carry a foreign key to the institution, so it exists first.
    await Institution.create({
      id: institutionId,
      name: 'M07 Studio Institution',
      slug: `m07-${institutionId}`,
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

    // Add student membership and enrollment
    await InstitutionMembership.create({
      institutionId,
      userId: studentId,
      role: 'university_student',
      status: 'active'
    });

    const initialTopics = [
      {
        id: 'top_1',
        title: 'Initial Topic 1',
        description: 'First topic description',
        subtopics: [
          {
            id: 'sub_1',
            title: 'Initial Subtopic 1.1',
            summary: 'Extracted summary',
            key_concepts: ['concept_a'],
            sourceRefs: [
              {
                fileId: 'file_1',
                originalName: 'lecture.pdf',
                pageRange: '1-5',
                ambiguityFlag: false
              }
            ],
            provenance: 'extracted' as const,
            learning_objectives: [
              {
                id: 'obj_1',
                statement: 'Understand initial concept',
                bloomLevel: 'understand',
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
      subjectId: 'sub_math',
      title: 'M07 Studio Test Course',
      status: 'completed',
      ingestProgress: 1,
      ingestDetail: 'done',
      ingestError: '',
      topics: initialTopics,
      files: [{ filename: 'lecture.pdf', originalName: 'lecture.pdf', fileHash: 'hash123' }]
    });
    courseId = courseDoc._id.toString();
    await prepareCourseFixture(courseId, t);

    await CourseEnrollment.create({
      courseId: courseId,
      userId: studentId,
      status: 'active'
    });

    initialRevisionTag = `rev_${Date.now()}`;
    await CourseRevision.create({
      courseId,
      revisionTag: initialRevisionTag,
      contentHash: 'hash_initial',
      status: 'draft',
      topics: initialTopics,
      isInstructorReviewed: false
    });

    assert.ok(courseId);

    await prepareCourseFixture(courseId, t);
  });

  await t.test('ED-30.1: Instructor reads draft and updates hierarchy/objectives', async () => {
    await prepareCourseFixture(courseId, t);
    const draft = await getCourseDraft(instructorId, courseId);
    assert.equal(draft.courseId, courseId);
    assert.equal(draft.revisionTag, initialRevisionTag);
    assert.equal(draft.isInstructorReviewed, false);
    assert.equal(draft.topics.length, 1);

    const updatedTopics = [
      {
        id: 'top_1',
        title: 'Corrected Topic 1: Advanced Consensus',
        description: 'Refined description by instructor',
        subtopics: [
          {
            id: 'sub_1',
            title: 'Corrected Subtopic: Raft & Multi-Paxos',
            summary: 'Instructor refined summary',
            key_concepts: ['leader_election', 'log_replication'],
            sourceRefs: [
              {
                fileId: 'file_1',
                originalName: 'lecture.pdf',
                pageRange: '1-10',
                ambiguityFlag: false
              }
            ],
            provenance: 'manual' as const,
            learning_objectives: [
              {
                id: 'obj_1',
                statement: 'Analyze leader election invariants',
                bloomLevel: 'analyze',
                provenance: 'manual' as const
              },
              {
                id: 'obj_2',
                statement: 'Evaluate consensus failure models',
                bloomLevel: 'evaluate',
                provenance: 'manual' as const
              }
            ]
          }
        ]
      },
      {
        id: 'top_2',
        title: 'New Topic 2: Byzantine Fault Tolerance',
        description: 'Added by instructor',
        subtopics: [
          {
            id: 'sub_2',
            title: 'PBFT Overview',
            summary: '3f+1 replicas',
            key_concepts: ['view_change', 'pre_prepare'],
            learning_objectives: [
              {
                id: 'obj_3',
                statement: 'Create BFT quorum calculation',
                bloomLevel: 'create',
                provenance: 'manual' as const
              }
            ]
          }
        ]
      }
    ];

    const updateRes = await updateCourseDraft(instructorId, courseId, {
      expectedRevisionTag: initialRevisionTag,
      topics: updatedTopics,
      summary: 'Updated course summary by instructor',
      isInstructorReviewed: true
    });

    assert.equal(updateRes.success, true);
    assert.notEqual(updateRes.revisionTag, initialRevisionTag, 'New revisionTag generated');
    assert.equal(updateRes.isInstructorReviewed, true);
    assert.equal(updateRes.topics!.length, 2);

    // Re-read draft and verify persistence
    const reReadDraft = await getCourseDraft(instructorId, courseId);
    assert.equal(reReadDraft.revisionTag, updateRes.revisionTag);
    assert.equal(reReadDraft.isInstructorReviewed, true);
    const reReadTopics = reReadDraft.topics as Array<{ title: string }>;
    assert.equal(reReadTopics.length, 2);
    assert.equal(reReadTopics[0].title, 'Corrected Topic 1: Advanced Consensus');
    assert.equal(reReadTopics[1].title, 'New Topic 2: Byzantine Fault Tolerance');
  });

  await t.test(
    'ED-30.3: Simultaneous stale edits are rejected with 409 StaleRevisionError',
    async () => {
      // Attempting to update with the stale initialRevisionTag
      await assert.rejects(
        async () => {
          await updateCourseDraft(instructorId, courseId, {
            expectedRevisionTag: initialRevisionTag, // Stale!
            topics: [
              {
                id: 'top_stale',
                title: 'Stale Edit',
                subtopics: []
              }
            ]
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof StaleRevisionError);
          assert.equal(err.status, 409);
          assert.ok(err.currentRevisionTag);
          return true;
        }
      );
    }
  );

  await t.test('ED-30.4: Learners and unauthorized actors are denied access to draft', async () => {
    // Enrolled student attempting to read draft
    await assert.rejects(
      async () => {
        await getCourseDraft(studentId, courseId);
      },
      (err: unknown) => {
        assert.ok(err instanceof DraftForbiddenError);
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Enrolled student attempting to update draft
    await assert.rejects(
      async () => {
        await updateCourseDraft(studentId, courseId, {
          expectedRevisionTag: 'dummy',
          topics: [{ title: 'Hacked', subtopics: [] }]
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof DraftForbiddenError);
        assert.equal(err.status, 403);
        return true;
      }
    );

    // Foreign user attempting to read draft
    await assert.rejects(
      async () => {
        await getCourseDraft(foreignUserId, courseId);
      },
      (err: unknown) => {
        assert.ok(err instanceof DraftForbiddenError);
        assert.equal(err.status, 403);
        return true;
      }
    );
  });

  await t.test(
    'ED-30.5: Approved active published revision remains immutable when editing draft',
    async () => {
      // Create an immutable published revision
      const publishedRev = await CourseRevision.create({
        courseId: courseId,
        revisionTag: 'rev_published_v1',
        contentHash: 'hash_pub',
        status: 'published',
        topics: [{ id: 'pub_top', title: 'Published Topic v1' }],
        isInstructorReviewed: true
      });

      // Pin activeRevisionId to the published revision
      await Course.findByIdAndUpdate(courseId, { activeRevisionId: publishedRev._id.toString() });

      const currentDraft = await getCourseDraft(instructorId, courseId);

      // Update the draft
      await updateCourseDraft(instructorId, courseId, {
        expectedRevisionTag: currentDraft.revisionTag,
        topics: [
          {
            id: 'top_draft_v2',
            title: 'Draft v2 Topic',
            subtopics: [
              {
                id: 'sub_v2',
                title: 'Subtopic v2',
                learning_objectives: [
                  {
                    id: 'obj_v2',
                    statement: 'New draft objective',
                    bloomLevel: 'apply'
                  }
                ]
              }
            ]
          }
        ],
        isInstructorReviewed: true
      });

      // Verify course activeRevisionId still points to published revision!
      const updatedCourse = await Course.findById(courseId);
      assert.equal(updatedCourse!.activeRevisionId, publishedRev._id.toString());

      // Verify published revision content was not mutated!
      const verifyPub = await CourseRevision.findById(publishedRev._id);
      assert.equal((verifyPub!.topics as Array<{ title: string }>)[0].title, 'Published Topic v1');
    }
  );

  await t.test(
    'ED-30.5b: Stale empty draft shells cannot hide current editable material',
    async () => {
      const activeBefore = await Course.findById(courseId);
      const activeTag = activeBefore!.activeRevisionId!;
      const active = await CourseRevision.findOne({
        courseId,
        ...(activeTag.startsWith('rev_') ? { revisionTag: activeTag } : { _id: activeTag })
      }).lean();
      assert.ok((active?.topics as unknown[])?.length);
      const stale = await CourseRevision.create({
        courseId: courseId,
        revisionTag: 'rev_stale_empty_shell',
        contentHash: 'empty',
        status: 'draft',
        topics: [],
        isInstructorReviewed: false
      });

      const draft = await getCourseDraft(instructorId, courseId);
      assert.notEqual(draft.revisionTag, stale.revisionTag);
      assert.equal((draft.topics as unknown[]).length, (active!.topics as unknown[]).length);
      assert.notEqual((draft.topics as Array<{ title: string }>)[0].title, '');
      assert.equal((await CourseRevision.findById(stale._id))!.status, 'draft');
      assert.equal((await Course.findById(courseId))!.activeRevisionId, activeTag);
    }
  );

  await t.test(
    'ED-30.6: Late AI ingestion result cannot overwrite reviewed draft content',
    async () => {
      const currentDraft = await getCourseDraft(instructorId, courseId);
      assert.equal(currentDraft.isInstructorReviewed, true);

      const correlationId = `corr_${Date.now()}`;
      await Course.findByIdAndUpdate(courseId, { correlationId });

      // Late AI result trying to substitute course topics
      const lateAiResult = {
        type: 'study.ingest.course' as const,
        correlationId,
        status: 'completed' as const,
        payload: {
          courseId,
          revisionId: currentDraft.revisionTag,
          vectorIndexRef: `faiss/${courseId}/${currentDraft.revisionTag}.faiss`,
          course: {
            topics: [
              {
                title: 'LATE AI OVERWRITE ATTEMPT',
                subtopics: [
                  {
                    id: 'sub_ai_late',
                    title: 'AI Late Subtopic'
                  }
                ]
              }
            ]
          }
        }
      };

      await handleIngestResult(lateAiResult);

      // Verify that the instructor reviewed topics were preserved
      const preservedDraft = await getCourseDraft(instructorId, courseId);
      const preservedTopics = preservedDraft.topics as Array<{ title: string }>;
      assert.notEqual(preservedTopics[0].title, 'LATE AI OVERWRITE ATTEMPT');
      assert.equal(preservedTopics[0].title, 'Draft v2 Topic');
    }
  );

  await t.test('Tree Integrity Validation: Malformed hierarchy is rejected', async () => {
    const currentDraft = await getCourseDraft(instructorId, courseId);

    // Empty topics array
    await assert.rejects(
      async () => {
        await updateCourseDraft(instructorId, courseId, {
          expectedRevisionTag: currentDraft.revisionTag,
          topics: []
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof HierarchyValidationError);
        assert.equal(err.status, 400);
        return true;
      }
    );

    // Topic without title
    await assert.rejects(
      async () => {
        await updateCourseDraft(instructorId, courseId, {
          expectedRevisionTag: currentDraft.revisionTag,
          topics: [{ title: '   ', subtopics: [] }]
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof HierarchyValidationError);
        assert.match(err.message, /non-empty title/);
        return true;
      }
    );

    // Objective with invalid bloomLevel
    await assert.rejects(
      async () => {
        await updateCourseDraft(instructorId, courseId, {
          expectedRevisionTag: currentDraft.revisionTag,
          topics: [
            {
              title: 'Valid Topic',
              subtopics: [
                {
                  title: 'Valid Subtopic',
                  learning_objectives: [
                    {
                      statement: 'Learn something',
                      bloomLevel: 'invalid_bloom_level'
                    }
                  ]
                }
              ]
            }
          ]
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof HierarchyValidationError);
        assert.match(err.message, /Invalid bloomLevel/);
        return true;
      }
    );

    // Duplicate ID detected
    await assert.rejects(
      async () => {
        await updateCourseDraft(instructorId, courseId, {
          expectedRevisionTag: currentDraft.revisionTag,
          topics: [
            {
              id: 'dup_id',
              title: 'Topic 1',
              subtopics: []
            },
            {
              id: 'dup_id', // Duplicate!
              title: 'Topic 2',
              subtopics: []
            }
          ]
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof HierarchyValidationError);
        assert.match(err.message, /Duplicate hierarchy id/);
        return true;
      }
    );
  });
});
