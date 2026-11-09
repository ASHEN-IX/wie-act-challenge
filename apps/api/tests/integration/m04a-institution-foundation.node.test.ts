import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { Course } from '../../modules/study/src/models';

interface ContextBody {
  institution?: { id: string; name: string; slug: string; isVerified: boolean };
  membership?: { id: string; role: string; status: string };
  institutions?: Array<{
    institution: { id: string; name: string; slug: string };
    membership: { id: string; role: string; status: string };
  }>;
  invitation?: { id: string; role: string; expiresAt: string; status?: string };
  token?: string;
  user?: { _id?: string };
  error?: string;
}

interface TestActor {
  id: string;
  email: string;
  cookie: string;
}

test(
  'M04-A institution membership and non-authorizing invitation foundations',
  { timeout: 90000 },
  async (t) => {
    // The suite shares the migrated test database with the rest of the run, so
    // every identity, institution and course is unique to this process and
    // deleted at the end.
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    process.env.BETTER_AUTH_SECRET = 'm04a-isolated-session-secret-at-least-32-characters';
    process.env.INTERNAL_API_SECRET = 'm04a-isolated-internal-secret';
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
    process.env.BETTER_AUTH_URL = 'http://localhost:5173';
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
    process.env.REDIS_URL = '';
    process.env.NODE_ENV = 'test';

    await connectDatabase();
    const runtime: { current?: { stop: () => Promise<void> } } = {};
    const userIds: string[] = [];
    const courseIds: string[] = [];
    const slugs = [
      `m04a-demo-${process.pid}-${Date.now()}`,
      `m04a-second-${process.pid}-${Date.now()}`
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
      // courses rows are written by the suite itself, plus any created through
      // the API for these actors.
      await prisma.course.deleteMany({
        where: {
          OR: [
            { id: { in: courseIds } },
            { userId: { in: userIds }, title: 'Private platform course' }
          ]
        }
      });
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
      'instructor-a',
      'student-a',
      'student-b',
      'outsider',
      'concurrent-one',
      'concurrent-two',
      'revoked-user',
      'expired-user'
    ];
    const actors = new Map<string, TestActor>();
    for (const name of actorNames) {
      const actor: TestActor = { id: newId(), email: `${name}@m04a.test`, cookie: '' };
      actors.set(name, actor);
      userIds.push(actor.id);
      // The Mongo suite inserted a `users` document and then ran `migrateAuth`.
      // Here the domain row and both Better Auth rows are created directly.
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
    const started = await start({ port: 0, workers: false });
    runtime.current = started;
    const address = started.server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;

    // Tables and their indexes come from the Prisma migrations; nothing to warm up.
    await import('../../modules/study/src/models/Institution.js');

    async function request(actor: TestActor | null, method: string, path: string, body?: unknown) {
      const response = await fetch(base + path, {
        method,
        headers: {
          origin: 'http://localhost:5173',
          'x-forwarded-for': `198.51.100.${actor ? userIds.indexOf(actor.id) + 1 : 99}`,
          ...(actor ? { cookie: actor.cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await response.text();
      return {
        status: response.status,
        body: (text ? JSON.parse(text) : {}) as ContextBody
      };
    }

    const platform = actors.get('platform')!;
    const instructorA = actors.get('instructor-a')!;
    const studentA = actors.get('student-a')!;
    const studentB = actors.get('student-b')!;
    const outsider = actors.get('outsider')!;

    const bootstrapA = await request(platform, 'POST', '/api/v1/study/institutions/bootstrap', {
      name: 'EdNova Demo University',
      slug: slugs[0],
      domain: 'demo.ednova.tn'
    });
    assert.equal(bootstrapA.status, 201, JSON.stringify(bootstrapA.body));
    const institutionA = bootstrapA.body.institution!.id;
    assert.equal(bootstrapA.body.membership?.role, 'university_admin');
    assert.equal(bootstrapA.body.institution?.isVerified, false);

    const bootstrapB = await request(platform, 'POST', '/api/v1/study/institutions/bootstrap', {
      name: 'Second Demo University',
      slug: slugs[1],
      domain: 'second.example.tn'
    });
    assert.equal(bootstrapB.status, 201, JSON.stringify(bootstrapB.body));
    const institutionB = bootstrapB.body.institution!.id;

    await t.test(
      'platform-admin bootstrap and identity checks reject duplicate/unauthorized setup',
      async () => {
        assert.equal(
          (
            await request(null, 'POST', '/api/v1/study/institutions/bootstrap', {
              name: 'No Session',
              slug: 'no-session'
            })
          ).status,
          401
        );
        assert.equal(
          (
            await request(outsider, 'POST', '/api/v1/study/institutions/bootstrap', {
              name: 'No Authority',
              slug: 'no-authority'
            })
          ).status,
          403
        );
        assert.equal(
          (
            await request(platform, 'POST', '/api/v1/study/institutions/bootstrap', {
              name: 'Duplicate Identity',
              slug: slugs[0]
            })
          ).status,
          409
        );
        const me = await request(instructorA, 'GET', '/api/v1/auth/me');
        assert.equal(me.status, 200);
        assert.equal(me.body.user?._id, String(instructorA.id));
      }
    );

    await t.test('institution metadata and cross-institution reads are scoped', async () => {
      const update = await request(
        platform,
        'PATCH',
        `/api/v1/study/institutions/${institutionA}`,
        {
          name: 'EdNova Demo University (Updated)'
        }
      );
      assert.equal(update.status, 200, JSON.stringify(update.body));
      assert.equal(update.body.institution?.name, 'EdNova Demo University (Updated)');
      assert.equal(
        (
          await request(platform, 'PATCH', `/api/v1/study/institutions/${institutionA}`, {
            domain: 'https://not-a-domain/path'
          })
        ).status,
        400
      );
      assert.equal(
        (
          await request(platform, 'PATCH', `/api/v1/study/institutions/${institutionA}`, {
            domain: 'a..b'
          })
        ).status,
        400
      );
      assert.equal(
        (await request(instructorA, 'GET', `/api/v1/study/institutions/${institutionA}`)).status,
        404
      );
      assert.equal(
        (await request(outsider, 'GET', `/api/v1/study/institutions/${institutionB}`)).status,
        404
      );
      assert.equal(
        (await request(platform, 'GET', '/api/v1/study/institutions')).body.institutions?.length,
        2
      );
    });

    await t.test(
      'invitation scope, independent pending issuance and role escalation are bounded',
      async () => {
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
        const issued = await request(
          platform,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          { role: 'instructor', expiresInHours: 24 }
        );
        assert.equal(issued.status, 201, JSON.stringify(issued.body));
        assert.ok(issued.body.token && issued.body.token.length >= 32);
        const secondIssued = await request(
          platform,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          {
            role: 'instructor'
          }
        );
        assert.equal(secondIssued.status, 201, JSON.stringify(secondIssued.body));
        assert.notEqual(secondIssued.body.token, issued.body.token);
        assert.notEqual(secondIssued.body.invitation?.id, issued.body.invitation?.id);
        assert.equal(
          (
            await request(
              instructorA,
              'POST',
              `/api/v1/study/institutions/${institutionB}/invitations`,
              {
                role: 'instructor'
              }
            )
          ).status,
          404
        );
        assert.equal(
          (
            await request(
              platform,
              'POST',
              `/api/v1/study/institutions/${institutionB}/invitations`,
              {
                role: 'instructor'
              }
            )
          ).status,
          201
        );
      }
    );

    await t.test(
      'single-use acceptance, same-actor retry and unauthorized management are denied',
      async () => {
        const issued = await request(
          platform,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          { role: 'instructor' }
        );
        // Multiple independent instructor invitations are legitimate.
        assert.equal(issued.status, 201, JSON.stringify(issued.body));
        const pending = await prisma.institutionInvitation.findFirst({
          where: { institutionId: institutionA, role: 'instructor', status: 'pending' }
        });
        assert.ok(pending);

        const firstAccept = await request(
          instructorA,
          'POST',
          '/api/v1/study/institutions/invitations/accept',
          {
            token: 'x'.repeat(43)
          }
        );
        assert.equal(firstAccept.status, 404);
        assert.equal(
          (await request(instructorA, 'GET', '/api/v1/study/institutions')).body.institutions
            ?.length,
          0
        );
      }
    );

    // A fresh invitation is issued after revoking the pending capability.
    const pendingInstructor = await prisma.institutionInvitation.findFirst({
      where: { institutionId: institutionA, role: 'instructor', status: 'pending' }
    });
    assert.ok(pendingInstructor);
    assert.equal(
      (
        await request(
          platform,
          'DELETE',
          `/api/v1/study/institutions/${institutionA}/invitations/${pendingInstructor.id}`
        )
      ).status,
      200
    );
    assert.equal(
      (
        await request(instructorA, 'POST', '/api/v1/study/institutions/invitations/accept', {
          token: 'x'.repeat(43)
        })
      ).status,
      404
    );

    const instructorInvitation = await request(
      platform,
      'POST',
      `/api/v1/study/institutions/${institutionA}/invitations`,
      { role: 'instructor' }
    );
    assert.equal(instructorInvitation.status, 201, JSON.stringify(instructorInvitation.body));
    const instructorToken = instructorInvitation.body.token!;
    const acceptedInstructor = await request(
      instructorA,
      'POST',
      '/api/v1/study/institutions/invitations/accept',
      { token: instructorToken }
    );
    assert.equal(acceptedInstructor.status, 200, JSON.stringify(acceptedInstructor.body));
    assert.equal(acceptedInstructor.body.membership?.role, 'instructor');
    const replay = await request(
      instructorA,
      'POST',
      '/api/v1/study/institutions/invitations/accept',
      {
        token: instructorToken
      }
    );
    // Same-actor retry is idempotent so an uncertain HTTP acknowledgment can be
    // recovered without making the bearer token reusable by another actor.
    assert.equal(replay.status, 200, JSON.stringify(replay.body));
    assert.equal(
      await prisma.institutionMembership.count({
        where: { institutionId: institutionA, userId: String(instructorA.id), role: 'instructor' }
      }),
      1
    );
    const foreignReplay = await request(
      studentB,
      'POST',
      '/api/v1/study/institutions/invitations/accept',
      {
        token: instructorToken
      }
    );
    assert.equal(foreignReplay.status, 409);
    assert.equal(
      (await request(instructorA, 'GET', `/api/v1/study/institutions/${institutionA}`)).status,
      200
    );
    const instructorOptions = await request(instructorA, 'GET', '/api/v1/study/institutions');
    assert.equal(instructorOptions.body.institutions?.length, 1);
    assert.equal(instructorOptions.body.institutions?.[0].institution.id, institutionA);
    assert.equal(
      (await request(instructorA, 'GET', `/api/v1/study/institutions/${institutionB}`)).status,
      404
    );
    assert.equal(
      (
        await request(
          instructorA,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          {
            role: 'university_student'
          }
        )
      ).status,
      404
    );
    assert.equal(
      (
        await request(instructorA, 'PATCH', `/api/v1/study/institutions/${institutionA}`, {
          name: 'Unauthorized Rename'
        })
      ).status,
      404
    );

    await t.test(
      'revoked invitations fail closed and expired invitations are rejected',
      async () => {
        const revoked = await request(
          platform,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          { role: 'university_student' }
        );
        assert.equal(revoked.status, 201);
        const revokedId = revoked.body.invitation!.id;
        assert.equal(
          (
            await request(
              platform,
              'DELETE',
              `/api/v1/study/institutions/${institutionA}/invitations/${revokedId}`
            )
          ).status,
          200
        );
        assert.equal(
          (
            await request(
              actors.get('revoked-user')!,
              'POST',
              '/api/v1/study/institutions/invitations/accept',
              {
                token: revoked.body.token
              }
            )
          ).status,
          410
        );

        const expired = await request(
          platform,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          { role: 'university_student' }
        );
        assert.equal(expired.status, 201);
        // `expiresAt` is a real column, so the update addresses it directly.
        await prisma.institutionInvitation.updateMany({
          where: { id: expired.body.invitation!.id },
          data: { expiresAt: new Date(Date.now() - 60_000) }
        });
        assert.equal(
          (
            await request(
              actors.get('expired-user')!,
              'POST',
              '/api/v1/study/institutions/invitations/accept',
              {
                token: expired.body.token
              }
            )
          ).status,
          410
        );
      }
    );

    await t.test('membership isolation and concurrent acceptance stay single-use', async () => {
      const studentInvite = await request(
        platform,
        'POST',
        `/api/v1/study/institutions/${institutionA}/invitations`,
        { role: 'university_student' }
      );
      assert.equal(studentInvite.status, 201);
      const studentAccept = await request(
        studentA,
        'POST',
        '/api/v1/study/institutions/invitations/accept',
        { token: studentInvite.body.token }
      );
      assert.equal(studentAccept.status, 200, JSON.stringify(studentAccept.body));
      assert.equal(studentAccept.body.membership?.role, 'university_student');

      // A real membership is display context only; it does not widen the M02
      // personal-owner source predicate.
      const foreignCourseId = newId();
      courseIds.push(foreignCourseId);
      await Course.create({
        _id: foreignCourseId,
        userId: String(platform.id),
        ownerUserId: String(platform.id),
        subjectId: newId(),
        title: 'Private platform course',
        status: 'completed',
        topics: [],
        files: []
      });
      assert.equal(
        (await request(studentA, 'GET', `/api/v1/study/courses/${foreignCourseId.toString()}`))
          .status,
        404
      );
      const personalCourses = await request(studentA, 'GET', '/api/v1/study/courses');
      assert.equal(personalCourses.status, 200);
      assert.equal((personalCourses.body as unknown as { courses?: unknown[] }).courses?.length, 0);

      const instructorInvite = await request(
        platform,
        'POST',
        `/api/v1/study/institutions/${institutionA}/invitations`,
        { role: 'instructor' }
      );
      assert.equal(instructorInvite.status, 201);
      const contenders = [actors.get('concurrent-one')!, actors.get('concurrent-two')!];
      const concurrent = await Promise.all(
        contenders.map((actor) =>
          request(actor, 'POST', '/api/v1/study/institutions/invitations/accept', {
            token: instructorInvite.body.token
          })
        )
      );
      assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
      const acceptedRows = await prisma.institutionMembership.count({
        where: {
          institutionId: institutionA,
          userId: { in: contenders.map((actor) => String(actor.id)) },
          role: 'instructor'
        }
      });
      assert.equal(acceptedRows, 1);
    });

    await t.test(
      'membership suspension is scoped, concurrent and does not revoke personal data',
      async () => {
        const suspendStudentA = await request(
          platform,
          'DELETE',
          `/api/v1/study/institutions/${institutionA}/memberships/${studentA.id}`
        );
        assert.equal(suspendStudentA.status, 200, JSON.stringify(suspendStudentA.body));
        assert.equal(suspendStudentA.body.membership?.status, 'suspended');
        assert.equal(
          (await request(studentA, 'GET', `/api/v1/study/institutions/${institutionA}`)).status,
          404
        );
        assert.equal(
          (
            await request(studentA, 'POST', '/api/v1/study/institutions/invitations/accept', {
              token: 'x'.repeat(43)
            })
          ).status,
          404
        );
        assert.equal(
          (
            await request(
              instructorA,
              'DELETE',
              `/api/v1/study/institutions/${institutionA}/memberships/${studentB.id}`
            )
          ).status,
          404
        );

        // Create a second active student so two concurrent suspend attempts target
        // the same authoritative row.
        const studentInvite = await request(
          platform,
          'POST',
          `/api/v1/study/institutions/${institutionA}/invitations`,
          { role: 'university_student' }
        );
        assert.equal(studentInvite.status, 201);
        assert.equal(
          (
            await request(studentB, 'POST', '/api/v1/study/institutions/invitations/accept', {
              token: studentInvite.body.token
            })
          ).status,
          200
        );
        const concurrent = await Promise.all([
          request(
            platform,
            'DELETE',
            `/api/v1/study/institutions/${institutionA}/memberships/${studentB.id}`
          ),
          request(
            platform,
            'DELETE',
            `/api/v1/study/institutions/${institutionA}/memberships/${studentB.id}`
          )
        ]);
        assert.equal(concurrent.filter((result) => result.status === 200).length, 1);
        assert.ok(concurrent.every((result) => [200, 404, 409].includes(result.status)));
        assert.equal(
          await prisma.institutionMembership.count({
            where: { institutionId: institutionA, userId: String(studentB.id), status: 'suspended' }
          }),
          1
        );
      }
    );
  }
);
