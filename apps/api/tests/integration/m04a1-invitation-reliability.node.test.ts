import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { Course } from '../../modules/study/src/models';

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
  id: string;
  email: string;
  cookie: string;
}

type Runtime = { stop: () => Promise<void> };

/** Index definitions of one table, normalized for stable comparison. */
async function tableIndexes(table: string) {
  const rows = await prisma.$queryRaw<
    Array<{ indexname: string; columns: string; isunique: boolean }>
  >`
    SELECT i.relname AS indexname,
           string_agg(a.attname, ',' ORDER BY k.ord) AS columns,
           ix.indisunique AS isunique
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE t.relname = ${table} AND t.relnamespace = 'public'::regnamespace
    GROUP BY i.relname, ix.indisunique
    ORDER BY i.relname
  `;
  return rows.map((row) => ({
    name: row.indexname,
    columns: row.columns.split(','),
    unique: row.isunique
  }));
}

test(
  'M04-A.1 invitation uniqueness, recovery, security and browser-adjacent API behavior',
  { timeout: 120000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    process.env.BETTER_AUTH_SECRET = 'm04a1-isolated-session-secret-at-least-32-chars';
    process.env.INTERNAL_API_SECRET = 'm04a1-isolated-internal-secret';
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
    process.env.BETTER_AUTH_URL = 'http://localhost:5173';
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
    process.env.REDIS_URL = '';
    process.env.NODE_ENV = 'test';

    await connectDatabase();
    const runtime: { current?: Runtime } = {};
    const userIds: string[] = [];
    const courseIds: string[] = [];
    const slugs = [
      `m04a1-reliability-${process.pid}-${Date.now()}`,
      `m04a1-second-${process.pid}-${Date.now()}`
    ];
    t.after(async () => {
      await runtime.current?.stop().catch(() => undefined);
      const { closeAuth } = await import('../../shared/betterAuth.js');
      await closeAuth();
      const institutions = await prisma.institution.findMany({
        where: { slug: { in: slugs } },
        select: { id: true }
      });
      const institutionIds = institutions.map((row) => row.id);
      await prisma.courseEnrollment.deleteMany({
        where: { institutionId: { in: institutionIds } }
      });
      await prisma.courseInvitation.deleteMany({
        where: { institutionId: { in: institutionIds } }
      });
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
      await prisma.institutionInvitation.deleteMany({
        where: { institutionId: { in: institutionIds } }
      });
      await prisma.institutionMembership.deleteMany({
        where: { institutionId: { in: institutionIds } }
      });
      await prisma.institution.deleteMany({ where: { id: { in: institutionIds } } });
      await prisma.authUser.deleteMany({ where: { id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await disconnectDatabase().catch(() => undefined);
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
      const actor: TestActor = { id: newId(), email: `${name}@m04a1.test`, cookie: '' };
      actors.set(name, actor);
      userIds.push(actor.id);
      await prisma.user.create({
        data: {
          id: actor.id,
          email: actor.email,
          name,
          isVerified: true,
          isActive: true,
          role: name === 'platform' ? 'admin' : 'student',
          isAdmin: name === 'platform',
          tier: 'vip',
          notificationPreferences: {},
          onboardingDraft: {}
        }
      });
      await prisma.authUser.create({
        data: { id: actor.id, email: actor.email, name, emailVerified: true }
      });
      await prisma.authAccount.create({
        data: {
          id: newId(),
          accountId: actor.id,
          providerId: 'credential',
          userId: actor.id,
          password
        }
      });
    }
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

    await import('../../modules/study/src/models/Institution.js');
    async function request(actor: TestActor | null, method: string, path: string, body?: unknown) {
      const response = await fetch(base + path, {
        method,
        headers: {
          origin: 'http://localhost:5173',
          'x-forwarded-for': `203.0.113.${actor ? userIds.indexOf(actor.id) + 1 : 99}`,
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
      slug: slugs[0]
    });
    assert.equal(bootstrapA.status, 201, JSON.stringify(bootstrapA.body));
    const institutionA = bootstrapA.body.institution!.id;
    const bootstrapB = await request(platform, 'POST', '/api/v1/study/institutions/bootstrap', {
      name: 'Second Reliability University',
      slug: slugs[1]
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

    await t.test('obsolete role uniqueness is absent while token hash stays unique', async () => {
      // The Mongo suite applied a migration script that dropped the obsolete
      // `(institutionId, role)` partial unique index and created the token and
      // listing indexes. PostgreSQL indexes now come from the Prisma
      // migrations, so the durable invariant is asserted directly — and
      // inspecting twice must find no drift.
      const indexes = await tableIndexes('institution_invitations');
      assert.ok(
        !indexes.some(
          (index) =>
            index.unique &&
            JSON.stringify(index.columns) === JSON.stringify(['institutionId', 'role'])
        ),
        'role uniqueness must not survive the migration'
      );
      const tokenHash = indexes.find(
        (index) => index.name === 'institution_invitations_tokenHash_key'
      );
      assert.ok(tokenHash?.unique, 'token hash must remain unique');
      const listing = indexes.find(
        (index) => index.name === 'institution_invitations_institutionId_status_expiresAt_idx'
      );
      assert.ok(listing, 'institution/status/expiry index must exist');
      assert.deepEqual(listing.columns, ['institutionId', 'status', 'expiresAt']);

      assert.deepEqual(await tableIndexes('institution_invitations'), indexes);
    });

    await t.test('multiple legitimate invitations coexist and distinct actors accept', async () => {
      const first = await issue(institutionA, 'university_student');
      const second = await issue(institutionA, 'university_student');
      const thirdInstructor = await issue(institutionA, 'instructor');
      assert.equal(first.status, 201, JSON.stringify(first.body));
      assert.equal(second.status, 201, JSON.stringify(second.body));
      assert.equal(thirdInstructor.status, 201, JSON.stringify(thirdInstructor.body));
      assert.notEqual(first.body.token, second.body.token);
      assert.notEqual(first.body.invitation?.id, second.body.invitation?.id);

      const pending = await prisma.institutionInvitation.count({
        where: { institutionId: institutionA, status: 'pending' }
      });
      assert.equal(pending, 3);

      const acceptedOne = await accept(studentOne, first.body.token!);
      const acceptedTwo = await accept(studentTwo, second.body.token!);
      assert.equal(acceptedOne.status, 200, JSON.stringify(acceptedOne.body));
      assert.equal(acceptedTwo.status, 200, JSON.stringify(acceptedTwo.body));
      assert.equal(acceptedOne.body.membership?.role, 'university_student');
      assert.equal(acceptedTwo.body.membership?.role, 'university_student');
      assert.equal(
        await prisma.institutionMembership.count({
          where: { institutionId: institutionA, role: 'university_student', status: 'active' }
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
        const row = await prisma.institutionInvitation.findUnique({
          where: { id: issued.body.invitation!.id }
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
          await prisma.institutionMembership.count({
            where: { userId: String(outsider.id), role: 'university_admin' }
          }),
          0
        );
        assert.equal(
          await prisma.institutionMembership.count({
            where: { institutionId: institutionA, userId: String(outsider.id) }
          }),
          0
        );

        const retry = await accept(outsider, token);
        assert.equal(retry.status, 200, JSON.stringify(retry.body));
        assert.equal(
          await prisma.institutionMembership.count({
            where: { institutionId: institutionB, userId: String(outsider.id) }
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
            await prisma.institutionInvitation.findMany({ where: { institutionId: institutionB } })
          ).includes(token),
          false
        );
      }
    );

    await t.test('interrupted claim recovers after restart for the same actor only', async () => {
      const issued = await issue(institutionB, 'instructor');
      assert.equal(issued.status, 201, JSON.stringify(issued.body));
      const invitation = await prisma.institutionInvitation.findUnique({
        where: { id: issued.body.invitation!.id }
      });
      assert.ok(invitation);
      // This is the exact durable state left by a process crash after the
      // conditional claim and before the separate membership insert.
      await prisma.institutionInvitation.updateMany({
        where: { id: invitation.id, status: 'pending' },
        data: {
          status: 'accepted',
          acceptedByUserId: String(retryUser.id),
          acceptedAt: new Date()
        }
      });
      assert.equal(
        await prisma.institutionMembership.count({
          where: { institutionId: institutionB, userId: String(retryUser.id) }
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
        await prisma.institutionMembership.count({
          where: { institutionId: institutionB, userId: String(retryUser.id) }
        }),
        1
      );

      const idempotent = await accept(retryUser, issued.body.token!);
      assert.equal(idempotent.status, 200, JSON.stringify(idempotent.body));
      assert.equal(
        await prisma.institutionMembership.count({
          where: { institutionId: institutionB, userId: String(retryUser.id) }
        }),
        1
      );
      const otherActor = await accept(racer, issued.body.token!);
      assert.equal(otherActor.status, 409);
      assert.equal(
        await prisma.institutionMembership.count({
          where: { institutionId: institutionB, userId: String(racer.id) }
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
        const membership = await prisma.institutionMembership.findFirst({
          where: { institutionId: institutionA, userId: String(studentTwo.id) }
        });
        assert.equal(membership?.status, 'suspended');
        const invitation = await prisma.institutionInvitation.findUnique({
          where: { id: issued.body.invitation!.id }
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
      await prisma.institutionInvitation.updateMany({
        where: { id: expired.body.invitation!.id },
        data: { expiresAt: new Date(Date.now() - 60_000) }
      });
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
      const membershipCount = await prisma.institutionMembership.count({
        where: { institutionId: institutionA, userId: String(racer.id) }
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

        const foreignCourseId = newId();
        courseIds.push(foreignCourseId);
        await Course.create({
          _id: foreignCourseId,
          userId: String(platform.id),
          ownerUserId: String(platform.id),
          subjectId: newId(),
          title: 'M04-A.1 private course',
          status: 'completed',
          topics: [],
          files: []
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
