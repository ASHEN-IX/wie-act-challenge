import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { migrateAuth } from '../../scripts/migrate-auth';

test(
  'P0-R2 real Nest/Python immutable source foundation',
  { timeout: 120000, skip: !process.env.P0R2_PYTHON },
  async (t) => {
    const root = path.resolve(__dirname, '../../../..'),
      temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ednova-p0r2-'));
    const database = 'ednova_p0r2_' + process.pid + '_' + Date.now(),
      uri = 'mongodb://127.0.0.1:27018/' + database;
    const serviceSecret = 'p0r2-local-service-secret-at-least-32-characters';
    const reserve = http.createServer();
    await new Promise<void>((r) => reserve.listen(0, '127.0.0.1', r));
    const aiPort = (reserve.address() as { port: number }).port;
    await new Promise<void>((r) => reserve.close(() => r()));
    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: uri,
      DB_NAME: database,
      BETTER_AUTH_SECRET: 'p0r2-auth-secret-with-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      INTERNAL_API_SECRET: 'p0r2-internal-local-secret',
      AI_SERVICE_API_KEY: serviceSecret,
      AI_SERVICE_URL: 'http://127.0.0.1:' + aiPort,
      LLM_MOCK: '1',
      LLM_APPROVALS_JSON: '{}',
      INGEST_UPLOADS_DIR: path.join(temp, 'uploads'),
      FAISS_INDEX_DIR: path.join(temp, 'faiss'),
      REDIS_URL: '',
      RABBITMQ_URL: process.env.P0R2_BROKER_URL || 'amqp://127.0.0.1:1'
    });
    const client = await new MongoClient(uri).connect(),
      db = client.db();
    const children: ChildProcess[] = [];
    // Teardown handles failed bootstrap.
    // eslint-disable-next-line prefer-const
    let runtime: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>> | undefined;
    t.after(async () => {
      for (const child of children) child.kill('SIGTERM');
      await runtime?.stop();
      await db.dropDatabase();
      await client.close();
      await fs.rm(temp, { recursive: true, force: true });
    });
    const output: string[] = [];
    async function startPython() {
      const child = spawn(
        process.env.P0R2_PYTHON!,
        [path.join(root, 'apps/api/tests/helpers/p0r2-ai-server.py')],
        {
          cwd: path.join(root, 'apps/ai'),
          env: {
            ...process.env,
            P0R2_AI_PORT: String(aiPort),
            PYTHONPATH: [
              path.join(root, 'apps/api/tests/helpers/python_guard'),
              path.join(root, 'apps/ai')
            ].join(':')
          },
          stdio: ['ignore', 'pipe', 'pipe']
        }
      );
      children.push(child);
      child.stdout?.on('data', (d) => output.push(String(d)));
      child.stderr?.on('data', (d) => output.push(String(d)));
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(process.env.AI_SERVICE_URL + '/health')).ok) return child;
        } catch {
          /* bounded readiness probe */
        }
        if (child.exitCode !== null) throw new Error(output.join(''));
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('Python readiness timeout ' + output.join(''));
    }
    let python = await startPython();
    const instructor = { id: new ObjectId(), cookie: '' },
      learner = { id: new ObjectId(), cookie: '' },
      foreign = { id: new ObjectId(), cookie: '' };
    for (const [i, a] of [instructor, learner, foreign].entries())
      await db.collection('users').insertOne({
        _id: a.id,
        name: 'P0R2 ' + i,
        email: 'p0r2-' + i + '@local.test',
        password: await bcrypt.hash('Synthetic!123', 12),
        role: 'student',
        tier: 'vip',
        isActive: true,
        isVerified: true
      });
    await migrateAuth(db, { apply: true });
    runtime = await (await import('../../src/main.js')).start({ port: 0, workers: false });
    const origin = 'http://127.0.0.1:' + (runtime.server.address() as { port: number }).port;
    const auth = await (await import('../../shared/betterAuth.js')).getAuth();
    for (const [i, a] of [instructor, learner, foreign].entries()) {
      const r = await auth.api.signInEmail({
        body: { email: 'p0r2-' + i + '@local.test', password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(r.status, 200);
      a.cookie = r.headers
        .getSetCookie()
        .map((c: string) => c.split(';')[0])
        .join('; ');
    }

    async function request(actor: typeof instructor, method: string, url: string, body?: unknown) {
      const r = await fetch(origin + url, {
        method,
        headers: {
          cookie: actor.cookie,
          origin: 'http://localhost:5173',
          ...(body ? { 'content-type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      return {
        status: r.status,
        body: r.headers.get('content-type')?.includes('application/json')
          ? await r.json()
          : await r.text()
      };
    }
    const m = await import('../../modules/study/src/models/index.js');
    const pub = await import('../../modules/study/src/services/coursePublication.js');
    const drafts = await import('../../modules/study/src/services/courseDraft.js');
    const institution = await m.Institution.create({
      name: 'P0R2 University',
      slug: 'p0r2-' + Date.now(),
      createdByUserId: instructor.id.toString()
    });
    await m.InstitutionMembership.create([
      {
        institutionId: institution._id,
        userId: instructor.id.toString(),
        role: 'instructor',
        status: 'active'
      },
      {
        institutionId: institution._id,
        userId: learner.id.toString(),
        role: 'university_student',
        status: 'active'
      }
    ]);
    const course = await m.Course.create({
      title: 'Source arithmetic',
      scope: 'institutional',
      institutionId: institution._id,
      userId: instructor.id.toString(),
      ownerUserId: instructor.id.toString(),
      assignedInstructorIds: [instructor.id.toString()],
      subjectId: 'synthetic',
      status: 'completed',
      files: []
    });
    const id = course._id.toString();
    await m.CourseEnrollment.create({
      courseId: id,
      institutionId: institution._id,
      userId: learner.id.toString(),
      status: 'active'
    });
    const topics = [
      {
        id: 'topic_math',
        title: 'Arithmetic',
        subtopics: [
          {
            id: 'sub_addition',
            title: 'Addition',
            learning_objectives: [
              {
                id: 'obj_addition',
                statement: 'Explain arithmetic addition',
                bloomLevel: 'understand'
              }
            ]
          }
        ]
      }
    ];
    const text =
      'Arithmetic addition combines quantities into a total. Source revision alpha is preserved.';
    const hash = createHash('sha256').update(text).digest('hex');
    // The upload is actual multipart through the canonical authorized upload route
    // later; this initial draft isolates publication/source invariants.
    await fs.mkdir(path.join(temp, 'uploads/courses', id), { recursive: true });
    await fs.writeFile(path.join(temp, 'uploads/courses', id, 'source.txt'), text);
    await m.Course.updateOne(
      { _id: id },
      {
        $set: {
          files: [
            {
              filename: 'source.txt',
              originalName: 'source.txt',
              fileHash: hash,
              size: Buffer.byteLength(text)
            }
          ]
        }
      }
    );
    await m.CourseRevision.create({
      courseId: id,
      revisionTag: 'rev_alpha',
      contentHash: hash,
      status: 'draft',
      topics,
      isInstructorReviewed: true
    });
    const base = '/api/v1/study/courses/' + id;
    await t.test(
      'REAL NEST/PYTHON: missing index cannot publish; explicit preparation verifies originals and FAISS',
      async () => {
        assert.equal(
          (
            await request(instructor, 'POST', base + '/studio/generate-activity', {
              objectiveId: 'obj_addition',
              activityType: 'InteractiveQuiz'
            })
          ).status,
          503
        );
        assert.equal(
          (
            await request(instructor, 'POST', base + '/publish', {
              expectedRevisionTag: 'rev_alpha'
            })
          ).status,
          503
        );
        assert.equal(
          (
            await request(foreign, 'POST', base + '/draft/sources/prepare', {
              expectedRevisionTag: 'rev_alpha'
            })
          ).status,
          403
        );
        assert.equal(
          (
            await request(instructor, 'POST', base + '/draft/sources/prepare', {
              expectedRevisionTag: 'rev_alpha'
            })
          ).status,
          200
        );
      }
    );
    let activity!: Record<string, unknown>;
    await t.test(
      'REAL NEST: truthful Studio candidates for both P0 types require review and keep keys private',
      async () => {
        assert.equal(
          (
            await request(instructor, 'POST', base + '/studio/generate-activity', {
              objectiveId: 'obj_addition',
              activityType: 'InteractiveQuiz',
              expectedRevisionTag: 'missing'
            })
          ).status,
          409
        );
        assert.equal(
          (
            await request(instructor, 'POST', base + '/studio/generate-activity', {
              objectiveId: 'obj_addition',
              activityType: 'Visualizer'
            })
          ).status,
          400
        );
        assert.equal(
          (
            await request(instructor, 'POST', base + '/studio/generate-activity', {
              objectiveId: 'obj_addition',
              activityType: 'InteractiveQuiz',
              sourceRefs: [{ documentId: 'foreign' }]
            })
          ).status,
          400
        );
        assert.equal((await request(instructor, 'GET', base + '/files/source.txt')).status, 200);
        const studio = await import('../../modules/study/src/services/courseStudio.js');
        const read = fs.readFile.bind(fs);
        let arrived!: () => void, release!: () => void;
        const loading = new Promise<void>((r) => {
            arrived = r;
          }),
          held = new Promise<void>((r) => {
            release = r;
          });
        fs.readFile = (async (...args: unknown[]) => {
          if (String(args[0]).endsWith('/rev_alpha.meta.json')) {
            arrived();
            await held;
          }
          return read(...(args as Parameters<typeof fs.readFile>));
        }) as typeof fs.readFile;
        const pending = studio.generateActivityCandidate(instructor.id.toString(), id, {
          objectiveId: 'obj_addition',
          activityType: 'InteractiveQuiz'
        });
        try {
          await loading;
          await m.InstitutionMembership.updateOne(
            { userId: instructor.id.toString() },
            { $set: { status: 'suspended' } }
          );
          assert.equal((await request(instructor, 'GET', base + '/files/source.txt')).status, 404);
          release();
          await assert.rejects(pending, { status: 403 });
        } finally {
          release();
          fs.readFile = read;
          await m.InstitutionMembership.updateOne(
            { userId: instructor.id.toString() },
            { $set: { status: 'active' } }
          );
        }
        for (const activityType of ['InteractiveQuiz', 'GuidedProblem']) {
          const generated = await request(instructor, 'POST', base + '/studio/generate-activity', {
            objectiveId: 'obj_addition',
            activityType
          });
          assert.equal(generated.status, 200);
          assert.equal(generated.body.executionMode, 'DETERMINISTIC_FALLBACK');
          assert.equal(generated.body.reviewRequired, true);
          assert.equal(
            generated.body.candidateActivity.sourceRefs[0].contentHash,
            'sha256:' + hash
          );
          assert.equal(generated.body.candidateActivity.sourceRefs[0].pageNumber, null);
          assert.ok(!JSON.stringify(generated.body.candidateActivity).includes('answerKey'));
          const a = generated.body.candidateActivity;
          assert.equal(await m.ActivityRecord.countDocuments({ activityId: a.activityId }), 0);
          const registered = await request(
            instructor,
            'POST',
            '/api/v1/study/activities/' + a.activityId + '/register',
            { courseId: id, activity: a, serverEvaluation: generated.body.candidateEvaluation }
          );
          assert.equal(registered.status, 201);
          activity = a;
        }
        assert.equal(
          (
            await request(learner, 'POST', base + '/studio/generate-activity', {
              objectiveId: 'obj_addition',
              activityType: 'InteractiveQuiz'
            })
          ).status,
          403
        );
      }
    );
    await t.test(
      'DIRECT MONGO: activation interruption resumes, repeat is idempotent and unknown revisions never fallback',
      async () => {
        const original = m.CourseRevision.updateOne.bind(m.CourseRevision);
        let interrupted = false;
        m.CourseRevision.updateOne = ((filter: unknown, update: unknown, ...args: unknown[]) => {
          if (!interrupted && JSON.stringify(update).includes('committed')) {
            interrupted = true;
            throw new Error('Synthetic interruption after pointer write');
          }
          return original(filter as never, update as never, ...(args as []));
        }) as typeof m.CourseRevision.updateOne;
        try {
          await assert.rejects(
            pub.publishCourseRevision(instructor.id.toString(), id, 'rev_alpha')
          );
        } finally {
          m.CourseRevision.updateOne = original;
        }
        await assert.rejects(pub.getPublishedCourseContext(learner.id.toString(), id));
        await pub.publishCourseRevision(instructor.id.toString(), id, 'rev_alpha');
        await assert.rejects(pub.getPublishedCourseContext(learner.id.toString(), id, ''));
        await assert.rejects(
          pub.getPublishedCourseContext(
            learner.id.toString(),
            new ObjectId().toString(),
            'rev_alpha'
          )
        );
        assert.equal(
          (
            await request(instructor, 'POST', base + '/publish', {
              expectedRevisionTag: 'rev_alpha'
            })
          ).status,
          200
        );
        assert.equal(
          (await request(learner, 'GET', base + '/published-context?revisionId=missing')).status,
          404
        );
      }
    );
    await t.test(
      'REAL NEST/PYTHON: exact tutor citations, public projection and restart persistence',
      async () => {
        const ask = { question: 'Explain arithmetic addition' };
        const response = await request(learner, 'POST', base + '/tutor/ask', ask);
        assert.equal(response.status, 200);
        assert.equal(response.body.status, 'verified');
        assert.ok(response.body.citations.length);
        assert.equal(response.body.groundingContext, undefined);
        assert.equal(response.body.retrievedEvidence, undefined);
        assert.equal(response.body.executionMode, 'MOCK_TEST');
        python.kill('SIGTERM');
        await new Promise<void>((r) => python.once('exit', () => r()));
        python = await startPython();
        assert.equal((await request(learner, 'POST', base + '/tutor/ask', ask)).status, 200);
      }
    );
    await t.test(
      'DIRECT FILESYSTEM / REAL NEST: missing or altered original, index and manifest never deliver',
      async () => {
        const revision = await m.CourseRevision.findOne({
          courseId: id,
          revisionTag: 'rev_alpha'
        }).lean();
        const original = path.join(temp, 'uploads', revision!.sourceManifest![0].storageRef!);
        const index = path.join(temp, 'faiss', id, 'rev_alpha.faiss'),
          sidecar = path.join(temp, 'faiss', id, 'rev_alpha.meta.json');
        for (const file of [original, index, sidecar]) {
          const bytes = await fs.readFile(file);
          await fs.rename(file, file + '.held');
          try {
            await assert.rejects(
              pub.getPublishedCourseContext(learner.id.toString(), id, 'rev_alpha')
            );
          } finally {
            await fs.rename(file + '.held', file);
          }
          await fs.chmod(file, 0o644);
          await fs.writeFile(file, Buffer.from('tampered'));
          try {
            await assert.rejects(
              pub.getPublishedCourseContext(learner.id.toString(), id, 'rev_alpha')
            );
          } finally {
            await fs.writeFile(file, bytes);
          }
        }
        assert.equal(
          (await request(learner, 'GET', base + '/published-context?revisionId=rev_alpha')).status,
          200
        );
      }
    );
    await t.test(
      'REAL NEST / LOCAL HTTP: malformed, fabricated, service-only and delayed revoked outputs are withheld',
      async () => {
        const revision = await m.CourseRevision.findOne({
          courseId: id,
          revisionTag: 'rev_alpha'
        }).lean();
        const valid = await (
          await fetch('http://127.0.0.1:' + aiPort + '/api/ai/tutor/ask', {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + serviceSecret,
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              courseId: id,
              revisionId: 'rev_alpha',
              contentHash: 'sha256:' + hash,
              manifestDigest: revision!.sourceManifestDigest,
              artifactHash: revision!.artifactHash,
              question: 'Explain arithmetic addition',
              authorizedDocumentIds: revision!.sourceManifest!.map((d) => d.documentId)
            })
          })
        ).json();
        for (const kind of [
          'page',
          'foreign',
          'stale',
          'missing_chunk',
          'malformed',
          'service_only',
          'unavailable',
          'delay'
        ]) {
          const response = structuredClone(valid);
          let delivered!: () => void;
          const arrived = new Promise<void>((r) => {
            delivered = r;
          });
          let release!: () => void;
          const held = new Promise<void>((r) => {
            release = r;
          });
          if (kind === 'page') response.citations[0].pageNumber = 99999;
          if (kind === 'foreign') response.retrievedEvidence[0].documentId = 'foreign';
          if (kind === 'stale') response.pin.revisionId = 'missing';
          if (kind === 'missing_chunk') delete response.retrievedEvidence[0].chunkId;
          if (kind === 'malformed') response.citations = 'malformed';
          if (kind === 'service_only') response.systemPrompt = 'hidden service prompt';
          if (kind === 'unavailable') response.executionMode = 'UNAVAILABLE';
          const server = http.createServer(async (req, res) => {
            req.resume();
            delivered();
            if (kind === 'delay') await held;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(response));
          });
          await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
          process.env.AI_SERVICE_URL =
            'http://127.0.0.1:' + (server.address() as { port: number }).port;
          try {
            const pending = request(learner, 'POST', base + '/tutor/ask', {
              question: 'Explain addition'
            });
            if (kind === 'delay') {
              await arrived;
              await m.InstitutionMembership.updateOne(
                { userId: learner.id.toString() },
                { $set: { status: 'suspended' } }
              );
              release();
            }
            assert.equal((await pending).status, kind === 'delay' ? 403 : 503, kind);
          } finally {
            release();
            await m.InstitutionMembership.updateOne(
              { userId: learner.id.toString() },
              { $set: { status: 'active' } }
            );
            server.closeAllConnections();
            await new Promise<void>((r) => server.close(() => r()));
            process.env.AI_SERVICE_URL = 'http://127.0.0.1:' + aiPort;
          }
        }
      }
    );
    await t.test(
      'DIRECT MONGO: competing revision activations have exactly one winning pointer',
      async () => {
        for (const revisionTag of ['rev_compete_a', 'rev_compete_b']) {
          await m.CourseRevision.create({
            courseId: id,
            revisionTag,
            contentHash: hash,
            status: 'draft',
            topics,
            isInstructorReviewed: true
          });
          assert.equal(
            (
              await request(instructor, 'POST', base + '/draft/sources/prepare', {
                expectedRevisionTag: revisionTag
              })
            ).status,
            200
          );
        }
        const write = m.Course.findOneAndUpdate.bind(m.Course);
        let waiting = 0,
          release!: () => void;
        const both = new Promise<void>((r) => {
          release = r;
        });
        m.Course.findOneAndUpdate = ((filter: unknown, update: unknown, ...args: unknown[]) => {
          return (async () => {
            if (JSON.stringify(update).includes('rev_compete_')) {
              waiting++;
              if (waiting === 2) release();
              await both;
            }
            return write(filter as never, update as never, ...(args as []));
          })();
        }) as typeof m.Course.findOneAndUpdate;
        let results: PromiseSettledResult<unknown>[];
        try {
          results = await Promise.allSettled(
            ['rev_compete_a', 'rev_compete_b'].map((tag) =>
              pub.publishCourseRevision(instructor.id.toString(), id, tag)
            )
          );
        } finally {
          m.Course.findOneAndUpdate = write;
        }
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        const current = await m.Course.findById(id).lean();
        assert.ok(['rev_compete_a', 'rev_compete_b'].includes(current!.activeRevisionId!));
        assert.equal(
          await m.CourseRevision.countDocuments({
            courseId: id,
            revisionTag: { $in: ['rev_compete_a', 'rev_compete_b'] },
            activationState: 'committed'
          }),
          1
        );
      }
    );
    await t.test(
      'DIRECT SERVICE: concurrent draft CAS, old pinned originals and concurrent publication',
      async () => {
        await m.CourseRevision.create({
          courseId: id,
          revisionTag: 'rev_draft',
          contentHash: hash,
          status: 'draft',
          topics,
          isInstructorReviewed: false
        });
        const edits = await Promise.allSettled(
          [1, 2].map(() =>
            drafts.updateCourseDraft(instructor.id.toString(), id, {
              expectedRevisionTag: 'rev_draft',
              topics,
              isInstructorReviewed: true
            })
          )
        );
        assert.equal(edits.filter((x) => x.status === 'fulfilled').length, 1);
        const updated = (
          edits.find((x) => x.status === 'fulfilled') as PromiseFulfilledResult<{
            revisionTag: string;
          }>
        ).value;
        assert.equal(
          (
            await request(instructor, 'POST', base + '/draft/sources/prepare', {
              expectedRevisionTag: updated.revisionTag
            })
          ).status,
          200
        );
        const races = await Promise.allSettled(
          [1, 2].map(() =>
            pub.publishCourseRevision(instructor.id.toString(), id, updated.revisionTag)
          )
        );
        assert.ok(races.some((x) => x.status === 'fulfilled'));
        await m.Course.updateOne({ _id: id }, { $set: { files: [] } });
        await fs.unlink(path.join(temp, 'uploads/courses', id, 'source.txt'));
        const old = await pub.getPublishedCourseContext(learner.id.toString(), id, 'rev_alpha');
        assert.equal(old.revisionId, 'rev_alpha');
        assert.equal(
          (
            await request(
              learner,
              'GET',
              base + '/revisions/rev_alpha/sources/' + old.authorizedDocumentIds[0]
            )
          ).status,
          200
        );
        await m.CourseRevision.updateOne(
          { courseId: id, revisionTag: 'rev_alpha' },
          { $set: { revokedAt: new Date() } }
        );
        await assert.rejects(pub.getPublishedCourseContext(learner.id.toString(), id, 'rev_alpha'));
      }
    );
    await t.test(
      'REAL NEST / RABBITMQ / WORKER / PYTHON: upload to immutable indexed learning',
      { skip: !process.env.P0R2_BROKER_URL },
      async (sourceTest) => {
        const broker = await import('amqplib');
        const connection = await broker.connect(process.env.P0R2_BROKER_URL!);
        const channel = await connection.createChannel();
        const worker = spawn(
          process.env.P0R2_PYTHON!,
          [path.join(root, 'apps/api/tests/helpers/p0r2-ai-server.py'), '--worker'],
          {
            cwd: path.join(root, 'apps/ai'),
            env: {
              ...process.env,
              PYTHONPATH: [
                path.join(root, 'apps/api/tests/helpers/python_guard'),
                path.join(root, 'apps/ai')
              ].join(':')
            },
            stdio: ['ignore', 'pipe', 'pipe']
          }
        );
        children.push(worker);
        worker.stdout?.on('data', (d) => output.push(String(d)));
        worker.stderr?.on('data', (d) => output.push(String(d)));
        const tracker = await import('../../modules/study/src/services/ingestStatus.js');
        try {
          // Inspect through a fresh channel: checking a queue before declaration closes
          // an AMQP channel, so bounded passive probes use disposable channels.
          let ready = false;
          for (let i = 0; i < 100; i++) {
            const probe = await connection.createChannel();
            probe.on('error', () => undefined);
            try {
              const q = await probe.checkQueue('ai.work.study.ingest.course');
              if (q.consumerCount > 0) {
                ready = true;
                await probe.close();
                break;
              }
            } catch {
              /* bounded readiness probe */
            }
            try {
              await probe.close();
            } catch {
              /* bounded readiness probe */
            }
            await new Promise((r) => setTimeout(r, 100));
          }
          assert.ok(ready, output.join(''));
          await tracker.startIngestStatusTracker();
          const subject = await m.Subject.create({
            userId: instructor.id.toString(),
            name: 'Synthetic source subject'
          });
          const passage =
            '# Arithmetic source\n\n## Addition\n\nArithmetic addition combines quantities into a total. This original passage supports an exact quotation check and keeps its source identity.';
          const form = new FormData();
          form.set('title', 'Uploaded source course');
          form.set('subject_id', subject._id.toString());
          form.set('scope', 'institutional');
          form.set('institutionId', institution._id.toString());
          form.append('files', new Blob([passage], { type: 'text/plain' }), 'arithmetic.txt');
          const uploaded = await fetch(origin + '/api/v1/study/courses', {
            method: 'POST',
            headers: { cookie: instructor.cookie, origin: 'http://localhost:5173' },
            body: form
          });
          const body = await uploaded.json();
          assert.equal(uploaded.status, 202, JSON.stringify(body));
          const uploadedId = String(body.courseId);
          let completed = false;
          for (let i = 0; i < 300; i++) {
            const stored = await m.Course.findById(uploadedId).lean();
            if (stored?.status === 'failed')
              throw new Error(String(stored.ingestError) + ' ' + output.join(''));
            if (stored?.status === 'completed') {
              completed = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 100));
          }
          assert.ok(completed, 'Worker timeout ' + output.join(''));
          const first = await m.CourseRevision.findOne({
            courseId: uploadedId,
            status: 'draft'
          }).lean();
          assert.ok(first);
          const disk = JSON.parse(
            await fs.readFile(
              path.join(temp, 'faiss', uploadedId, first.revisionTag + '.meta.json'),
              'utf8'
            )
          );
          assert.equal(
            disk.documents[0].contentHash,
            'sha256:' + createHash('sha256').update(passage).digest('hex')
          );
          assert.ok(
            disk.metas.every(
              (row: Record<string, unknown>) =>
                row.document_id === disk.documents[0].documentId &&
                row.revision_id === first.revisionTag &&
                row.page_number === null
            )
          );
          await m.CourseEnrollment.create({
            courseId: uploadedId,
            institutionId: institution._id,
            userId: learner.id.toString(),
            status: 'active'
          });
          const review = await drafts.updateCourseDraft(instructor.id.toString(), uploadedId, {
            expectedRevisionTag: first.revisionTag,
            topics,
            isInstructorReviewed: true
          });
          const uploadedBase = '/api/v1/study/courses/' + uploadedId;
          assert.equal(
            (
              await request(instructor, 'POST', uploadedBase + '/draft/sources/prepare', {
                expectedRevisionTag: review.revisionTag
              })
            ).status,
            200
          );
          const candidate = await request(
            instructor,
            'POST',
            uploadedBase + '/studio/generate-activity',
            { objectiveId: 'obj_addition', activityType: 'GuidedProblem' }
          );
          assert.equal(candidate.status, 200);
          const a = candidate.body.candidateActivity;
          assert.equal(
            (
              await request(
                instructor,
                'POST',
                '/api/v1/study/activities/' + a.activityId + '/register',
                {
                  courseId: uploadedId,
                  activity: a,
                  serverEvaluation: candidate.body.candidateEvaluation
                }
              )
            ).status,
            201
          );
          assert.equal(
            (
              await request(instructor, 'POST', uploadedBase + '/publish', {
                expectedRevisionTag: review.revisionTag
              })
            ).status,
            200
          );
          const answer = await request(learner, 'POST', uploadedBase + '/tutor/ask', {
            question: 'Explain arithmetic addition'
          });
          assert.equal(answer.status, 200);
          assert.equal(answer.body.status, 'verified');
          assert.equal(answer.body.pin.revisionId, review.revisionTag);
          assert.equal(answer.body.citations[0].documentId, disk.documents[0].documentId);

          await sourceTest.test(
            'failed replacement enqueue preserves published source and existing downloads',
            async () => {
              const jobs = await import('../../modules/study/src/services/ingestionJob.js');
              const before = await m.Course.findById(uploadedId).lean();
              const oldName = before!.files[0].filename;
              assert.ok(oldName);
              const oldPath = path.join(temp, 'uploads/courses', uploadedId, oldName);
              const oldBytes = await fs.readFile(oldPath);
              const published = await request(learner, 'GET', uploadedBase + '/published-context');
              assert.equal(published.status, 200);
              const replacement = new FormData();
              replacement.append(
                'files',
                new Blob(['Unapproved replacement source.'], { type: 'text/plain' }),
                'replacement.txt'
              );
              jobs.setCustomPublisher(async () => {
                throw new Error('Synthetic enqueue failure');
              });
              try {
                const failed = await fetch(origin + uploadedBase + '/files', {
                  method: 'POST',
                  headers: { cookie: instructor.cookie, origin: 'http://localhost:5173' },
                  body: replacement
                });
                assert.equal(failed.status, 503);
              } finally {
                jobs.setCustomPublisher(null);
              }
              assert.deepEqual(await fs.readFile(oldPath), oldBytes);
              const download = await fetch(origin + uploadedBase + '/files/' + oldName, {
                headers: { cookie: instructor.cookie }
              });
              assert.equal(download.status, 200);
              assert.deepEqual(Buffer.from(await download.arrayBuffer()), oldBytes);
              assert.deepEqual(
                (await request(learner, 'GET', uploadedBase + '/published-context')).body,
                published.body
              );
              const retained = await m.Course.findById(uploadedId).lean();
              assert.equal(retained!.status, 'failed');
              assert.equal(retained!.files.length, before!.files.length + 1);
              const nextAnswer = await request(learner, 'POST', uploadedBase + '/tutor/ask', {
                question: 'Explain arithmetic addition'
              });
              assert.equal(nextAnswer.status, 200);
              assert.equal(nextAnswer.body.pin.revisionId, review.revisionTag);
            }
          );

          // Exercise actual PDF bytes through the same broker/worker path. The
          // fixture uses real PDF page extraction, not hand-built page metadata.
          for (const scanned of [false, true]) {
            await sourceTest.test(
              scanned
                ? 'REAL OCR: image-only PDF to reviewed source, confidence and page citations'
                : 'REAL PDF: native text page citations',
              async () => {
                const pdfPath = path.join(
                  temp,
                  scanned ? 'scanned-two-page.pdf' : 'synthetic-two-page.pdf'
                );
                const pdfFixture = spawnSync(
                  process.env.P0R2_PYTHON!,
                  [
                    '-c',
                    [
                      'import fitz,sys',
                      'd=fitz.open()',
                      'p=d.new_page(); p.insert_text((72,72), "Arithmetic addition combines quantities into a total.", fontsize=16)',
                      'p=d.new_page(); p.insert_text((72,72), "Geometry studies shapes and their measurable properties.", fontsize=16)',
                      ...(scanned
                        ? [
                            'r=fitz.open()',
                            'for p in d:',
                            ' q=r.new_page(width=p.rect.width, height=p.rect.height); q.insert_image(q.rect, stream=p.get_pixmap(matrix=fitz.Matrix(2,2)).tobytes("png"))',
                            'd.close(); d=r',
                            'assert all(not p.get_text().strip() for p in d)'
                          ]
                        : []),
                      'd.save(sys.argv[1]); d.close()'
                    ].join('\n'),
                    pdfPath
                  ],
                  { encoding: 'utf8' }
                );
                assert.equal(pdfFixture.status, 0, pdfFixture.stderr);
                const pdfBytes = await fs.readFile(pdfPath);
                const pdfForm = new FormData();
                pdfForm.set('title', 'Uploaded synthetic PDF course');
                pdfForm.set('subject_id', subject._id.toString());
                pdfForm.set('scope', 'institutional');
                pdfForm.set('institutionId', institution._id.toString());
                pdfForm.append(
                  'files',
                  new Blob([pdfBytes], { type: 'application/pdf' }),
                  'source.pdf'
                );
                const pdfUpload = await fetch(origin + '/api/v1/study/courses', {
                  method: 'POST',
                  headers: { cookie: instructor.cookie, origin: 'http://localhost:5173' },
                  body: pdfForm
                });
                const pdfBody = await pdfUpload.json();
                assert.equal(pdfUpload.status, 202, JSON.stringify(pdfBody));
                const pdfCourseId = String(pdfBody.courseId);
                let pdfCompleted = false;
                for (let i = 0; i < 300; i++) {
                  const stored = await m.Course.findById(pdfCourseId).lean();
                  if (stored?.status === 'failed')
                    throw new Error(String(stored.ingestError) + ' ' + output.join(''));
                  if (stored?.status === 'completed') {
                    pdfCompleted = true;
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                }
                assert.ok(pdfCompleted, 'PDF worker timeout ' + output.join(''));
                const pdfDraft = await m.CourseRevision.findOne({
                  courseId: pdfCourseId,
                  status: 'draft'
                }).lean();
                assert.ok(pdfDraft);
                const pdfDisk = JSON.parse(
                  await fs.readFile(
                    path.join(temp, 'faiss', pdfCourseId, pdfDraft.revisionTag + '.meta.json'),
                    'utf8'
                  )
                );
                assert.equal(
                  pdfDisk.documents[0].contentHash,
                  'sha256:' + createHash('sha256').update(pdfBytes).digest('hex')
                );
                assert.deepEqual(
                  [
                    ...new Set(pdfDisk.metas.map((row: { page_number: number }) => row.page_number))
                  ].sort(),
                  [1, 2]
                );
                await m.CourseEnrollment.create({
                  courseId: pdfCourseId,
                  institutionId: institution._id,
                  userId: learner.id.toString(),
                  status: 'active'
                });
                const pdfReview = await drafts.updateCourseDraft(
                  instructor.id.toString(),
                  pdfCourseId,
                  {
                    expectedRevisionTag: pdfDraft.revisionTag,
                    topics,
                    isInstructorReviewed: true
                  }
                );
                const pdfBase = '/api/v1/study/courses/' + pdfCourseId;
                if (scanned) {
                  assert.ok(
                    pdfDisk.metas.every(
                      (row: Record<string, unknown>) =>
                        row.extraction_method === 'ocr' &&
                        row.review_required === true &&
                        typeof row.ocr_confidence === 'number'
                    )
                  );
                }

                assert.equal(
                  (
                    await request(instructor, 'POST', pdfBase + '/draft/sources/prepare', {
                      expectedRevisionTag: pdfReview.revisionTag
                    })
                  ).status,
                  200
                );
                if (scanned) {
                  const studio = await request(
                    instructor,
                    'GET',
                    '/api/v1/study/learning/studio/' + pdfCourseId
                  );
                  assert.equal(studio.status, 200);
                  assert.ok(studio.body.sources.length >= 2);
                  assert.ok(
                    studio.body.sources.every(
                      (row: Record<string, unknown>) =>
                        row.extractionMethod === 'ocr' &&
                        row.reviewRequired === true &&
                        typeof row.ocrConfidence === 'number'
                    )
                  );
                }
                assert.equal(
                  (
                    await request(instructor, 'POST', pdfBase + '/publish', {
                      expectedRevisionTag: pdfReview.revisionTag
                    })
                  ).status,
                  200
                );
                const pdfAnswer = await request(learner, 'POST', pdfBase + '/tutor/ask', {
                  question: 'Explain arithmetic addition'
                });
                assert.equal(pdfAnswer.status, 200);
                assert.equal(pdfAnswer.body.status, 'verified');
                assert.equal(pdfAnswer.body.pin.revisionId, pdfReview.revisionTag);
                assert.equal(
                  pdfAnswer.body.citations[0].documentId,
                  pdfDisk.documents[0].documentId
                );
                assert.equal(pdfAnswer.body.citations[0].pageNumber, 1);
                const secondPageAnswer = await request(learner, 'POST', pdfBase + '/tutor/ask', {
                  question: 'Explain geometry shapes and measurable properties'
                });
                assert.equal(secondPageAnswer.status, 200);
                assert.equal(secondPageAnswer.body.status, 'verified');
                assert.equal(
                  secondPageAnswer.body.citations[0].documentId,
                  pdfDisk.documents[0].documentId
                );
                assert.equal(secondPageAnswer.body.citations[0].pageNumber, 2);
                const download = await fetch(
                  origin +
                    pdfBase +
                    '/revisions/' +
                    pdfReview.revisionTag +
                    '/sources/' +
                    pdfDisk.documents[0].documentId,
                  { headers: { cookie: learner.cookie, origin: 'http://localhost:5173' } }
                );
                assert.equal(download.status, 200);
                assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdfBytes);
              }
            );
          }
        } finally {
          await tracker.stopIngestStatusTracker();
          await channel.close();
          await connection.close();
          worker.kill('SIGTERM');
        }
      }
    );
    await t.test(
      'REAL NEST: current revocation blocks source, tutor and activity delivery',
      async () => {
        await m.InstitutionMembership.updateOne(
          { userId: learner.id.toString() },
          { $set: { status: 'suspended' } }
        );
        assert.equal((await request(learner, 'GET', base + '/published-context')).status, 403);
        assert.equal(
          (await request(learner, 'POST', base + '/tutor/ask', { question: 'Explain addition' }))
            .status,
          403
        );
        assert.equal(
          (await request(learner, 'GET', '/api/v1/study/activities/' + activity.activityId)).status,
          403
        );
      }
    );
  }
);
