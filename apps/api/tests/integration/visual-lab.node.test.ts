/**
 * Visual Learning Lab end-to-end at the HTTP boundary.
 *
 * Real Nest dispatch, real Better Auth cookies, real Mongo and real source
 * artifacts. The Python service is replaced by a local stub, so this proves the
 * Node contract, authorization and deterministic engines — not live inference.
 *
 * Requires the test Mongo on 127.0.0.1:27018 (`pnpm test:infra:up`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { migrateAuth } from '../../scripts/migrate-auth';
import { prepareCourseFixture } from '../helpers/reviewedActivityFixture';
import {
  Course,
  CourseEnrollment,
  CourseRevision,
  Institution,
  InstitutionMembership
} from '../../modules/study/src/models';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';

const GRAPH = {
  nodes: [
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
    { id: 'C', label: 'C' },
    { id: 'D', label: 'D' }
  ],
  edges: [
    { source: 'A', target: 'B', weight: 2 },
    { source: 'B', target: 'D', weight: 7 },
    { source: 'A', target: 'C', weight: 5 },
    { source: 'C', target: 'D', weight: 3 }
  ],
  source: 'A',
  target: 'D'
};

test(
  'Visual Learning Lab: authorization, generation, guidance, refusal and privacy',
  { timeout: 120000 },
  async (t) => {
    const database = `ednova_visual_lab_${process.pid}_${Date.now()}`;
    const mongoUri = `mongodb://127.0.0.1:27018/${database}`;
    const probe = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 1500 });
    try {
      await probe.connect();
    } catch {
      await probe.close().catch(() => {});
      t.skip('MongoDB test service is unavailable on 127.0.0.1:27018');
      return;
    }
    await probe.close();

    // Local AI stub: records what the gateway sent, never runs code.
    const seen: Array<{ url: string; body: Record<string, unknown> }> = [];
    let planReply: Record<string, unknown> = {
      status: 'planned',
      reason: 'Weighted graph relationships',
      candidate: {
        engine: 'weighted_graph',
        title: 'Cheapest route through the campus',
        concept: 'Weighted shortest paths',
        learningObjective: 'Explain how edge weights change the cheapest route',
        scenario: GRAPH,
        guidance: {
          instructions: 'Change one edge weight, then step through the algorithm.',
          predictionPrompt: 'Which route looks cheapest before you run it?',
          hint: 'Add the weights along each complete route.'
        }
      },
      executionMode: 'MOCK_TEST'
    };
    const ai = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = chunks.length
          ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>)
          : {};
        seen.push({ url: String(req.url), body });
        res.setHeader('content-type', 'application/json');
        if (req.url === '/api/ai/visual-lab/plan') {
          // The stub answers the engine the concept implies, as a real planner would.
          const concept = String(body.concept || '').toLowerCase();
          if (planReply.status === 'planned' && /newton|force|mass/.test(concept))
            return res.end(
              JSON.stringify({
                ...planReply,
                candidate: {
                  engine: 'parameter_model',
                  title: "Newton's second law",
                  concept: "Newton's second law",
                  learningObjective: 'Relate force, mass and acceleration',
                  scenario: {
                    modelId: 'newtons_second_law',
                    values: { force: 40, mass: 8 }
                  },
                  guidance: {
                    instructions: 'Change force and mass one at a time.',
                    predictionPrompt: 'What happens to acceleration if mass doubles?',
                    hint: 'Hold one value fixed while the other changes.'
                  }
                }
              })
            );
          return res.end(JSON.stringify(planReply));
        }
        if (req.url === '/api/ai/visual-lab/guide')
          return res.end(
            JSON.stringify({
              status: 'guided',
              text: 'Dijkstra finds the shortest path in a weighted graph: A→C→D costs 8, so the cheap A→B edge is not enough.',
              reason: '',
              executionMode: 'MOCK_TEST'
            })
          );
        res.statusCode = 404;
        res.end('{}');
      });
    });
    await new Promise<void>((resolve) => ai.listen(0, '127.0.0.1', () => resolve()));
    const aiPort = (ai.address() as AddressInfo).port;
    t.after(() => new Promise<void>((resolve) => ai.close(() => resolve())));

    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: mongoUri,
      DB_NAME: database,
      BETTER_AUTH_SECRET: 'visual-lab-test-secret-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      INTERNAL_API_SECRET: 'visual-lab-internal-secret',
      AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
      AI_SERVICE_API_KEY: 'visual-lab-ai-service-key-at-least-32-characters',
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: ''
    });

    const client = await new MongoClient(mongoUri).connect();
    const db = client.db();
    const runtime: {
      current?: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>>;
    } = {};
    let courseId = '';
    t.after(async () => {
      await runtime.current?.stop();
      await db.dropDatabase();
      await client.close();
    });

    const password = await bcrypt.hash('Synthetic!123', 12);
    const actors = ['owner', 'student', 'outsider'].map((name) => ({
      id: new ObjectId(),
      name,
      email: `visual-lab-${name}@synthetic.test`,
      cookie: ''
    }));
    await db.collection('users').insertMany(
      actors.map((actor) => ({
        _id: actor.id,
        email: actor.email,
        name: actor.name,
        password,
        role: 'student',
        tier: 'vip',
        isActive: true,
        isVerified: true
      }))
    );
    await migrateAuth(db, { apply: true });
    const auth = await (await import('../../shared/betterAuth.js')).getAuth();
    for (const actor of actors) {
      const response = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(response.status, 200);
      actor.cookie = response.headers
        .getSetCookie()
        .map((value: string) => value.split(';')[0])
        .join('; ');
    }
    const [owner, student, outsider] = actors;

    runtime.current = await (await import('../../src/main.js')).start({ port: 0, workers: false });
    const address = runtime.current.server.address();
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;

    async function request(
      actor: typeof owner | null,
      method: string,
      endpoint: string,
      body?: unknown
    ) {
      const response = await fetch(origin + endpoint, {
        method,
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:5173',
          ...(actor ? { cookie: actor.cookie } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? (JSON.parse(text) as Record<string, unknown>) : {}
      };
    }

    // ---- owner publishes a course with a verified source artifact ----
    // mongoose's bson instance, not the standalone driver's, so Mongoose can serialize it.
    const institutionId = new mongoose.Types.ObjectId();
    await Institution.create({
      _id: institutionId,
      name: 'Synthetic visual lab institution',
      slug: `visual-lab-${institutionId.toString()}`,
      createdByUserId: owner.id.toString(),
      status: 'active'
    });
    await InstitutionMembership.create({
      institutionId,
      userId: owner.id.toString(),
      role: 'instructor',
      status: 'active'
    });
    await InstitutionMembership.create({
      institutionId,
      userId: student.id.toString(),
      role: 'university_student',
      status: 'active'
    });
    const course = await Course.create({
      userId: owner.id.toString(),
      ownerUserId: owner.id.toString(),
      scope: 'institutional',
      institutionId,
      assignedInstructorIds: [owner.id.toString()],
      subjectId: 'sub_visual_lab',
      title: 'Routing and networks',
      status: 'completed'
    });
    courseId = course._id.toString();
    await prepareCourseFixture(courseId);

    await CourseEnrollment.create({
      courseId: course._id,
      userId: student.id.toString(),
      institutionId,
      status: 'active'
    });
    const revisionTag = `rev_vl_${Date.now()}`;
    const topics = [
      {
        id: 'top_routing',
        title: 'Shortest path routing',
        subtopics: [
          {
            id: 'sub_weights',
            title: 'Edge weights',
            learning_objectives: [
              {
                id: 'obj_weights',
                statement: 'Explain how edge weights change the cheapest route',
                bloomLevel: 'understand'
              }
            ]
          }
        ]
      }
    ];
    await CourseRevision.create({
      courseId: course._id,
      revisionTag,
      contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'draft',
      topics,
      isInstructorReviewed: false
    });
    const review = await updateCourseDraft(owner.id.toString(), courseId, {
      expectedRevisionTag: revisionTag,
      topics,
      isInstructorReviewed: true
    });
    await materializeRevisionFixture(
      courseId,
      review.revisionTag,
      'Synthetic source about shortest path routing and edge weights.'
    );
    const publication = await publishCourseRevision(
      owner.id.toString(),
      courseId,
      review.revisionTag
    );
    const published = publication.publishedRevisionTag;

    await t.test('unauthenticated requests are rejected', async () => {
      assert.equal(
        (await request(null, 'GET', '/api/v1/study/visual-lab/capabilities')).status,
        401
      );
      for (const endpoint of [
        '/api/v1/study/visual-lab/plan',
        '/api/v1/study/visual-lab/lab_abcdef0123456789abcd/guide',
        '/api/v1/study/visual-lab/lab_abcdef0123456789abcd/check'
      ])
        assert.equal((await request(null, 'POST', endpoint, {})).status, 401, endpoint);
    });

    await t.test('capabilities are bounded and honest', async () => {
      const response = await request(student, 'GET', '/api/v1/study/visual-lab/capabilities');
      assert.equal(response.status, 200);
      const engines = response.body.engines as Array<{ engine: string }>;
      assert.deepEqual(
        engines.map((e) => e.engine),
        ['weighted_graph', 'parameter_model', 'spatial_3d', 'function_plot']
      );
    });

    await t.test('an outsider cannot plan from a course they cannot read', async () => {
      const response = await request(outsider, 'POST', '/api/v1/study/visual-lab/plan', {
        mode: 'course',
        courseId,
        concept: 'shortest path routing'
      });
      assert.equal(response.status, 403);
      assert.equal(response.body.error, 'FORBIDDEN');
      assert.equal(
        seen.filter((call) => call.url === '/api/ai/visual-lab/plan').length,
        0,
        'no model call may happen before authorization'
      );
    });

    let labId = '';
    await t.test('an enrolled student gets a validated course-pinned lab', async () => {
      const response = await request(student, 'POST', '/api/v1/study/visual-lab/plan', {
        mode: 'course',
        courseId,
        concept: 'shortest path routing with edge weights'
      });
      assert.equal(response.status, 201);
      const lab = response.body.lab as Record<string, unknown>;
      const sourceContext = lab.sourceContext as Record<string, unknown>;
      assert.equal(sourceContext.mode, 'course');
      assert.equal(sourceContext.revisionId, published);
      assert.equal(lab.engine, 'weighted_graph');
      assert.equal(lab.generationMode, 'AI_PLANNED');
      assert.ok((sourceContext.passageIds as string[]).length >= 1);
      const serialized = JSON.stringify(response.body);
      assert.ok(!serialized.includes('correctOptionId'), 'answer key must not leak');
      assert.ok(!serialized.includes('"explanation"'), 'explanation must not leak');

      const sent = seen.find((call) => call.url === '/api/ai/visual-lab/plan')!.body;
      assert.equal(sent.courseId, courseId);
      assert.equal(sent.revisionId, published);
      const passages = sent.passages as Array<{ documentId: string }>;
      assert.equal(passages.length, 1);
      assert.ok(passages[0].documentId.startsWith('doc_'));
      labId = lab.labId as string;
    });

    await t.test(
      'an identical request reuses the stored lab instead of billing again',
      async () => {
        const before = seen.filter((call) => call.url === '/api/ai/visual-lab/plan').length;
        const repeat = await request(student, 'POST', '/api/v1/study/visual-lab/plan', {
          mode: 'course',
          courseId,
          concept: 'shortest path routing with edge weights'
        });
        assert.equal(repeat.status, 201);
        assert.equal((repeat.body.lab as Record<string, unknown>).labId, labId);
        assert.equal(seen.filter((call) => call.url === '/api/ai/visual-lab/plan').length, before);
      }
    );

    await t.test('a lab is private to its owner', async () => {
      assert.equal(
        (await request(outsider, 'GET', `/api/v1/study/visual-lab/${labId}`)).status,
        404
      );
      assert.equal((await request(owner, 'GET', `/api/v1/study/visual-lab/${labId}`)).status, 404);
    });

    await t.test('the library lists only the caller’s own labs, without answer keys', async () => {
      const mine = await request(student, 'GET', '/api/v1/study/visual-lab');
      assert.equal(mine.status, 200);
      const labs = mine.body.labs as Array<Record<string, unknown>>;
      assert.ok(labs.some((entry) => entry.labId === labId));
      assert.ok(!JSON.stringify(mine.body).includes('correctOptionId'));
      assert.deepEqual((await request(outsider, 'GET', '/api/v1/study/visual-lab')).body.labs, []);
    });

    await t.test('discovery finds explorable course sections and enforces access', async () => {
      const found = await request(
        student,
        'GET',
        `/api/v1/study/visual-lab/discover?courseId=${courseId}`
      );
      assert.equal(found.status, 200);
      const concepts = found.body.concepts as Array<Record<string, unknown>>;
      assert.ok(concepts.length >= 1);
      assert.equal(concepts[0].engine, 'weighted_graph');
      assert.equal(found.body.revisionId, published);
      const denied = await request(
        outsider,
        'GET',
        `/api/v1/study/visual-lab/discover?courseId=${courseId}`
      );
      assert.equal(denied.status, 403);
      assert.equal(
        (await request(student, 'GET', '/api/v1/study/visual-lab/discover?courseId=nope')).status,
        400
      );
    });

    await t.test('the owner can read their own lab', async () => {
      const response = await request(student, 'GET', `/api/v1/study/visual-lab/${labId}`);
      assert.equal(response.status, 200);
      assert.equal((response.body.lab as Record<string, unknown>).labId, labId);
    });

    await t.test('guidance is grounded in server-computed state', async () => {
      const response = await request(student, 'POST', `/api/v1/study/visual-lab/${labId}/guide`, {
        question: 'Why did the shortest path change?',
        guidanceMode: 'explain',
        parameters: [9, 9, 9, 9]
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.status, 'guided');
      const call = seen.filter((entry) => entry.url === '/api/ai/visual-lab/guide').at(-1)!;
      const state = call.body.state as Record<string, unknown>;
      // Four edges of weight 9: A→B→D and A→C→D both cost 18. The documented
      // tie-break is the lexicographically smaller predecessor (B < C).
      assert.equal(state.totalCost, 18);
      assert.deepEqual(state.path, ['A', 'B', 'D']);
      assert.deepEqual(
        (state.edges as Array<{ weight: number }>).map((edge) => edge.weight),
        [9, 9, 9, 9]
      );
    });

    await t.test('guidance still answers honestly without the model', async () => {
      const original = process.env.AI_SERVICE_URL;
      process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
      try {
        const response = await request(student, 'POST', `/api/v1/study/visual-lab/${labId}/guide`, {
          question: 'Why?',
          guidanceMode: 'hint'
        });
        assert.equal(response.status, 200);
        assert.equal(response.body.status, 'fallback');
        assert.equal(response.body.executionMode, 'DETERMINISTIC_FALLBACK');
      } finally {
        process.env.AI_SERVICE_URL = original;
      }
    });

    await t.test('the understanding check grades server-side and awards nothing', async () => {
      const bad = await request(student, 'POST', `/api/v1/study/visual-lab/${labId}/check`, {
        selectedOptionId: 'not-an-option'
      });
      assert.equal(bad.status, 400);
      const forged = await request(student, 'POST', `/api/v1/study/visual-lab/${labId}/check`, {
        selectedOptionId: 'correct',
        score: 1,
        xp: 500
      });
      assert.equal(forged.status, 400);

      const read = await request(student, 'GET', `/api/v1/study/visual-lab/${labId}`);
      const options = (
        (read.body.lab as Record<string, unknown>).check as {
          options: Array<{ id: string }>;
        }
      ).options;
      let outcome: Record<string, unknown> | null = null;
      for (const option of options) {
        const attempt = await request(student, 'POST', `/api/v1/study/visual-lab/${labId}/check`, {
          selectedOptionId: option.id
        });
        assert.equal(attempt.status, 200);
        assert.equal(attempt.body.recordedAsEvidence, false);
        if (attempt.body.correct === true) outcome = attempt.body;
      }
      assert.ok(outcome, 'exactly one option must be correct');
      assert.equal(outcome!.correctOptionId, 'correct');
      assert.ok(String(outcome!.explanation).includes('8'));
      assert.equal(await db.collection('learning_evidence').countDocuments({}), 0);
      assert.equal(await db.collection('rank_event_ledgers').countDocuments({}), 0);
    });

    await t.test('open-topic labs work without a course and are labelled as such', async () => {
      const response = await request(student, 'POST', '/api/v1/study/visual-lab/plan', {
        mode: 'topic',
        concept: "Newton's second law"
      });
      assert.equal(response.status, 201);
      const lab = response.body.lab as Record<string, unknown>;
      assert.equal(lab.engine, 'parameter_model');
      const sourceContext = lab.sourceContext as Record<string, unknown>;
      assert.equal(sourceContext.mode, 'topic');
      assert.equal(sourceContext.courseId ?? null, null);
    });

    await t.test('forged course claims and unknown fields are rejected', async () => {
      for (const payload of [
        { mode: 'topic', concept: 'Dijkstra', courseId },
        { mode: 'topic', concept: 'Dijkstra', revisionId: 'rev_1' },
        { mode: 'course', concept: 'Dijkstra' },
        { mode: 'topic', concept: 'Dijkstra', execute: 'rm -rf /' },
        { mode: 'topic', concept: '' }
      ])
        assert.equal(
          (await request(student, 'POST', '/api/v1/study/visual-lab/plan', payload)).status,
          400,
          JSON.stringify(payload)
        );
    });

    await t.test('an unsupported concept is refused, not approximated', async () => {
      planReply = {
        status: 'unsupported',
        reason: 'No supported engine demonstrates molecular orbitals accurately.',
        executionMode: 'MOCK_TEST'
      };
      const response = await request(student, 'POST', '/api/v1/study/visual-lab/plan', {
        mode: 'topic',
        concept: 'Molecular orbital hybridisation diagrams'
      });
      assert.equal(response.status, 422);
      assert.equal(response.body.error, 'UNSUPPORTED_CONCEPT');
      assert.match(String(response.body.message), /molecular orbitals/);
    });

    await t.test('a rejected AI proposal never becomes a lab', async () => {
      planReply = {
        status: 'planned',
        reason: 'x',
        candidate: {
          engine: 'weighted_graph',
          title: 'Broken',
          concept: 'Broken',
          learningObjective: 'Broken',
          scenario: { ...GRAPH, edges: [] },
          guidance: { instructions: 'a', predictionPrompt: 'b', hint: 'c' }
        },
        executionMode: 'MOCK_TEST'
      };
      const before = await db.collection('visual_labs').countDocuments({});
      const response = await request(student, 'POST', '/api/v1/study/visual-lab/plan', {
        mode: 'topic',
        concept: 'Shakespearean sonnets'
      });
      assert.equal(response.status, 422);
      assert.equal(await db.collection('visual_labs').countDocuments({}), before);
    });
  }
);
