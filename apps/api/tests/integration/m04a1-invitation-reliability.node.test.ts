import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { migrateAuth } from '../../scripts/migrate-auth';
import { migrateInstitutionInvitationIndexes } from '../../scripts/migrate-institution-indexes';

interface InvitationBody {
  invitation?: { id: string; institutionId: string; role: string; expiresAt: string };
  token?: string;
  error?: string;
}

interface ContextBody {
  institution?: { id: string; name: string; slug: string; isVerified: boolean };
  membership?: { id: string; role: string; status: string };
  institutions?: Array<{
    institution: { id: string; name: string; slug: string };
    membership: { id: string; role: string; status: string };
  }>;
  error?: string;
}

interface TestActor {
  id: ObjectId;
  email: string;
  cookie: string;
}

type Runtime = { stop: () => Promise<void> };

test(
  'M04-A.1 invitation uniqueness, recovery, security and browser-adjacent API behavior',
  { timeout: 120000 },
  async (t) => {
    const database = `ednova_m04a1_${process.pid}_${Date.now()}`;
    process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/${database}`;
    process.env.BETTER_AUTH_SECRET = 'm04a1-isolated-session-secret-at-least-32-chars';
    process.env.INTERNAL_API_SECRET = 'm04a1-isolated-internal-secret';
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
    process.env.BETTER_AUTH_URL = 'http://localhost:5173';
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
    process.env.REDIS_URL = '';
    process.env.NODE_ENV = 'test';

    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
    } catch {
      await client.close().catch(() => undefined);
      t.skip('MongoDB test service is unavailable on 127.0.0.1:27018');
      return;
    }
    const db = client.db();
    const runtime: { current?: Runtime } = {};
    t.after(async () => {
      await runtime.current?.stop().catch(() => undefined);
      await db.dropDatabase().catch(() => undefined);
      await client.close().catch(() => undefined);
    });

    const password = await bcrypt.hash('Synthetic!123', 12);
    const actorNames = [
      'platform',
      'student-one',
      'student-two',
      'instructor-one',
      'retry-user',
      'racer',
      'outsider'
    ];
    const actors = new Map<string, TestActor>();
    for (const name of actorNames) {
      const actor = { id: new ObjectId(), email: `${name}@m04a1.test`, cookie: '' };
      actors.set(name, actor);
      await db.collection('users').insertOne({
        _id: actor.id,
        email: actor.email,
        name,
        password,
        isVerified: true,
        isActive: true,
        role: name === 'platform' ? 'admin' : 'student',
        isAdmin: name === 'platform',
        tier: 'vip'
      });
    }
    await migrateAuth(db, { apply: true });
    const { getAuth } = await import('../../shared/betterAuth.js');
    const auth = await getAuth();
    for (const actor of actors.values()) {
      const response = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(response.status, 200, `sign-in failed for ${actor.email}`);
      actor.cookie = response.headers
        .getSetCookie()
        .map((value: string) => value.split(';')[0])
        .join('; ');
    }

    const { start } = await import('../../src/main.js');
    let started = await start({ port: 0, workers: false });
    runtime.current = started;
    let base: string;
    function setBase(): void {
      const address = started.server.address();
      assert.ok(address && typeof address === 'object');
      base = `http://127.0.0.1:${address.port}`;
    }
    setBase();

    const models = await import('../../modules/study/src/models/Institution.js');
    await Promise.all([
      models.Institution.init(),
      models.InstitutionMembership.init(),
      models.InstitutionInvitation.init()
    ]);

    async function request(actor: TestActor | null, method: string, path: string, body?: unknown) {
      const response = await fetch(base + path, {
        method,
        headers: {
          origin: 'http://localhost:5173',
          ...(actor ? { cookie: actor.cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await response.text();
      return {
        status: response.status,
        body: (text ? JSON.parse(text) : {}) as InvitationBody & ContextBody
      };
    }

    const platform = actors.get('platform')!;
    const studentOne = actors.get('student-one')!;
    const studentTwo = actors.get('student-two')!;
    const instructorOne = actors.get('instructor-one')!;
    const retryUser = actors.get('retry-user')!;
    const racer = actors.get('racer')!;
    const outsider = actors.get('outsider')!;

    const bootstrapA = await request(platform, 'POST', '/api/v1/study/institutions/bootstrap', {
      name: 'Invitation Reliability University',
      slug: 'invitation-reliability'
    });
    assert.equal(bootstrapA.status, 201, JSON.stringify(bootstrapA.body));
    const institutionA = bootstrapA.body.institution!.id;
    const bootstrapB = await request(platform, 'POST', '/api/v1/study/institutions/bootstrap', {
      name: 'Second Reliability University',
      slug: 'second-reliability'
    });
    assert.equal(bootstrapB.status, 201, JSON.stringify(bootstrapB.body));
    const institutionB = bootstrapB.body.institution!.id;

    async function issue(
      institutionId: string,
      role: 'instructor' | 'university_student',
      actor = platform
    ) {
      return request(actor, 'POST', `/api/v1/study/institutions/${institutionId}/invitations`, {
        role
      });
    }

    async function accept(
      actor: TestActor | null,
      token: string,
      extra: Record<string, unknown> = {}
    ) {
      return request(actor, 'POST', '/api/v1/study/institutions/invitations/accept', {
        token,
        ...extra
      });
    }

    await t.test(
      'obsolete role uniqueness index is migrated while token hash stays unique',
      async () => {
        const invitations = db.collection('institution_invitations');
        await invitations.createIndex(
          { institutionId: 1, role: 1 },
          { unique: true, partialFilterExpression: { status: 'pending' } }
        );
        const dryRun = await migrateInstitutionInvitationIndexes(db);
        assert.equal(dryRun.mode, 'dry-run');
        assert.ok(dryRun.dropped.includes('institutionId_1_role_1'));
        assert.ok(dryRun.inspected.includes('institutionId_1_role_1'));

        const applied = await migrateInstitutionInvitationIndexes(db, { apply: true });
        assert.equal(applied.mode, 'applied');
        assert.ok(applied.dropped.includes('institutionId_1_role_1'));
        const indexes = await invitations.indexes();
        assert.ok(
          !indexes.some(
            (index) =>
              index.unique === true &&
              JSON.stringify(index.key) === JSON.stringify({ institutionId: 1, role: 1 })
          ),
          'role uniqueness must not survive the migration'
        );
        const tokenHash = indexes.find((index) => index.name === 'tokenHash_1');
        assert.ok(tokenHash?.unique, 'token hash must remain unique');
        const listing = indexes.find(
          (index) => index.name === 'institutionId_1_status_1_expiresAt_1'
        );
        assert.ok(listing, 'institution/status/expiry index must exist');

        const again = await migrateInstitutionInvitationIndexes(db, { apply: true });
        assert.deepEqual(again.dropped, []);
        assert.deepEqual(again.created, []);
      }
    );

    await t.test('multiple legitimate invitations coexist and distinct actors accept', async () => {
      const first = await issue(institutionA, 'university_student');
      const second = await issue(institutionA, 'university_student');
      const thirdInstructor = await issue(institutionA, 'instructor');
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(second.status, 201, JSON.stringify(second.body));
      assert.equal(thirdInstructor.status, 201, JSON.stringify(thirdInstructor.body));
      assert.notEqual(first.body.token, second.body.token);
      assert.notEqual(first.body.invitation?.id, second.body.invitation?.id);

      const pending = await db.collection('institution_invitations').countDocuments({
        institutionId: new ObjectId(institutionA),
        status: 'pending'
      });
      assert.equal(pending, 3);

      const acceptedOne = await accept(studentOne, first.body.token!);
      const acceptedTwo = await accept(studentTwo, second.body.token!);
      assert.equal(acceptedOne.status, 200, JSON.stringify(acceptedOne.body));
      assert.equal(acceptedTwo.status, 200, JSON.stringify(acceptedTwo.body));
      assert.equal(acceptedOne.body.membership?.role, 'university_student');
      assert.equal(acceptedTwo.body.membership?.role, 'university_student');
      assert.equal(
        await db.collection('institution_memberships').countDocuments({
          institutionId: new ObjectId(institutionA),
          role: 'university_student',
          status: 'active'
        }),
        2
      );

      const instructorAccepted = await accept(instructorOne, thirdInstructor.body.token!);
      assert.equal(instructorAccepted.status, 200, JSON.stringify(instructorAccepted.body));
      assert.equal(instructorAccepted.body.membership?.role, 'instructor');
    });

    await t.test(
      'raw tokens are hashed, single-use and absent from public projections',
      async () => {
        const issued = await issue(institutionB, 'university_student');
        assert.equal(issued.status, 201, JSON.stringify(issued.body));
        const token = issued.body.token!;
        const row = await db.collection('institution_invitations').findOne({
          _id: new ObjectId(issued.body.invitation!.id)
        });
        assert.ok(row);
        assert.equal(row.tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
        assert.equal(JSON.stringify(row).includes(token), false);

        const accepted = await accept(outsider, token, {
          role: 'university_admin',
          status: 'active',
          institutionId: institutionA
        });
        assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
        assert.equal(accepted.body.institution?.id, institutionB);
        assert.equal(accepted.body.membership?.role, 'university_student');
        assert.equal(
          await db.collection('institution_memberships').countDocuments({
            userId: String(outsider.id),
            role: 'university_admin'
          }),
          0
        );
        assert.equal(
          await db.collection('institution_memberships').countDocuments({
            institutionId: new ObjectId(institutionA),
            userId: String(outsider.id)
          }),
          0
        );

        const retry = await accept(outsider, token);
        assert.equal(retry.status, 200, JSON.stringify(retry.body));
        assert.equal(
          await db.collection('institution_memberships').countDocuments({
            institutionId: new ObjectId(institutionB),
            userId: String(outsider.id)
          }),
          1
        );
        const foreignReplay = await accept(studentTwo, token);
        assert.equal(foreignReplay.status, 409);

        const list = await request(platform, 'GET', '/api/v1/study/institutions');
        assert.equal(list.status, 200);
        assert.equal(JSON.stringify(list.body).includes(token), false);
        assert.equal(
          JSON.stringify(
            await db
              .collection('institution_invitations')
              .find({ institutionId: new ObjectId(institutionB) })
              .toArray()
          ).includes(token),
          false
        );
      }
    );

    await t.test('interrupted claim recovers after restart for the same actor only', async () => {
      const issued = await issue(institutionB, 'instructor');
      assert.equal(issued.status, 201, JSON.stringify(issued.body));
      const invitation = await db.collection('institution_invitations').findOne({
        _id: new ObjectId(issued.body.invitation!.id)
      });
      assert.ok(invitation);
      // This is the exact durable state left by a process crash after the
      // conditional claim and before the separate membership insert.
      await db.collection('institution_invitations').updateOne(
        { _id: invitation._id, status: 'pending' },
        {
          $set: {
            status: 'accepted',
            acceptedByUserId: String(retryUser.id),
            acceptedAt: new Date()
          }
        }
      );
      assert.equal(
        await db.collection('institution_memberships').countDocuments({
          institutionId: new ObjectId(institutionB),
          userId: String(retryUser.id)
        }),
        0
      );

      await runtime.current?.stop();
      started = await start({ port: 0, workers: false });
      runtime.current = started;
      setBase();

      const recovered = await accept(retryUser, issued.body.token!);
      assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
      assert.equal(recovered.body.membership?.role, 'instructor');
      assert.equal(
        await db.collection('institution_memberships').countDocuments({
          institutionId: new ObjectId(institutionB),
          userId: String(retryUser.id)
        }),
        1
      );

      const idempotent = await accept(retryUser, issued.body.token!);
      assert.equal(idempotent.status, 200, JSON.stringify(idempotent.body));
      assert.equal(
        await db.collection('institution_memberships').countDocuments({
          institutionId: new ObjectId(institutionB),
          userId: String(retryUser.id)
        }),
        1
      );
      const otherActor = await accept(racer, issued.body.token!);
      assert.equal(otherActor.status, 409);
      assert.equal(
        await db.collection('institution_memberships').countDocuments({
          institutionId: new ObjectId(institutionB),
          userId: String(racer.id)
        }),
        0
      );
    });

    await t.test(
      'suspended membership is not silently reactivated by a new invitation',
      async () => {
        const suspended = await request(
          platform,
          'DELETE',
          `/api/v1/study/institutions/${institutionA}/memberships/${studentTwo.id}`
        );
        assert.equal(suspended.status, 200, JSON.stringify(suspended.body));
        const issued = await issue(institutionA, 'university_student');
        assert.equal(issued.status, 201, JSON.stringify(issued.body));
        const denied = await accept(studentTwo, issued.body.token!);
        assert.equal(denied.status, 403, JSON.stringify(denied.body));
        const membership = await db.collection('institution_memberships').findOne({
          institutionId: new ObjectId(institutionA),
          userId: String(studentTwo.id)
        });
        assert.equal(membership?.status, 'suspended');
        const invitation = await db.collection('institution_invitations').findOne({
          _id: new ObjectId(issued.body.invitation!.id)
        });
        assert.equal(invitation?.status, 'pending');
      }
    );

    await t.test('revocation and expiry fail closed; revocation race is one-winner', async () => {
      const revoked = await issue(institutionA, 'university_student');
      assert.equal(revoked.status, 201);
      assert.equal(
        (
          await request(
            platform,
            'DELETE',
            `/api/v1/study/institutions/${institutionA}/invitations/${revoked.body.invitation!.id}`
          )
        ).status,
        200
      );
      assert.equal((await accept(racer, revoked.body.token!)).status, 410);

      const expired = await issue(institutionA, 'university_student');
      assert.equal(expired.status, 201);
      await db
        .collection('institution_invitations')
        .updateOne(
          { _id: new ObjectId(expired.body.invitation!.id) },
          { $set: { expiresAt: new Date(Date.now() - 60_000) } }
        );
      assert.equal((await accept(racer, expired.body.token!)).status, 410);

      const raced = await issue(institutionA, 'university_student');
      assert.equal(raced.status, 201);
      const [revokeResult, acceptResult] = await Promise.all([
        request(
          platform,
          'DELETE',
          `/api/v1/study/institutions/${institutionA}/invitations/${raced.body.invitation!.id}`
        ),
        accept(racer, raced.body.token!)
      ]);
      const membershipCount = await db.collection('institution_memberships').countDocuments({
        institutionId: new ObjectId(institutionA),
        userId: String(racer.id)
      });
      if (acceptResult.status === 200) {
        assert.equal(revokeResult.status, 404);
        assert.equal(membershipCount, 1);
      } else {
        assert.equal(acceptResult.status, 410);
        assert.equal(revokeResult.status, 200);
        assert.equal(membershipCount, 0);
      }
    });

    await t.test(
      'issuer authority, role escalation and course isolation remain denied',
      async () => {
        assert.equal((await issue(institutionA, 'instructor', instructorOne)).status, 404);
        assert.equal(
          (
            await request(
              platform,
              'POST',
              `/api/v1/study/institutions/${institutionA}/invitations`,
              {
                role: 'university_admin'
              }
            )
          ).status,
          400
        );
        assert.equal(
          (await request(studentOne, 'GET', `/api/v1/study/institutions/${institutionB}`)).status,
          404
        );

        const foreignCourseId = new ObjectId();
        await db.collection('courses').insertOne({
          _id: foreignCourseId,
          userId: String(platform.id),
          subjectId: String(new ObjectId()),
          title: 'M04-A.1 private course',
          status: 'completed',
          topics: [],
          files: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        assert.equal(
          (await request(studentOne, 'GET', `/api/v1/study/courses/${foreignCourseId}`)).status,
          404
        );
        const list = await request(studentOne, 'GET', '/api/v1/study/courses');
        assert.equal(list.status, 200);
        assert.equal((list.body as { courses?: unknown[] }).courses?.length, 0);
      }
    );
  }
);
