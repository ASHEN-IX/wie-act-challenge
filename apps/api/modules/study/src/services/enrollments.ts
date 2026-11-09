/** Prisma-shaped filter: a plain object of column predicates. */
type FilterQuery = Record<string, unknown>;
import crypto from 'node:crypto';
import {
  Course,
  CourseEnrollment,
  CourseEnrollmentStatus,
  CourseInvitation,
  CourseInvitationRole,
  InstitutionMembership,
  Institution
} from '../models';
import { canAdministerCourse, canManageEnrollments } from './resourceAccess';

const INVITATION_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const DEFAULT_INVITATION_HOURS = 168; // 7 days
const MAX_INVITATION_HOURS = 720; // 30 days

export class EnrollmentError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'EnrollmentError';
  }
}

function parseId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    throw new EnrollmentError(404, `${name} not found`);
  }
  return value;
}

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Assign an instructor to an institutional course.
 *
 * Rules:
 * - Caller must have course management authority (owner, assigned instructor, or university_admin).
 * - Course must have institutional scope.
 * - The target instructor must have an active 'instructor' membership in the course's institution.
 * - An instructor from Institution A CANNOT be assigned to a course in Institution B.
 * - Assignment is idempotent (duplicate assignment is prevented).
 */
export async function assignInstructorToCourse(
  actorUserId: string,
  courseIdRaw: string,
  instructorUserId: string
) {
  const courseId = parseId(courseIdRaw, 'Course');
  if (!instructorUserId || typeof instructorUserId !== 'string') {
    throw new EnrollmentError(400, 'Invalid instructor user ID');
  }

  const authorized = await canAdministerCourse(actorUserId, courseId);
  if (!authorized) {
    throw new EnrollmentError(403, 'Forbidden: insufficient permissions to assign instructor');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new EnrollmentError(404, 'Course not found');
  }

  if (course.scope !== 'institutional' || !course.institutionId) {
    throw new EnrollmentError(400, 'Cannot assign instructors to a personal course');
  }

  // Verify that the target instructor is an active instructor in THIS institution
  const isInstructorInOrg = await InstitutionMembership.exists({
    institutionId: course.institutionId,
    userId: instructorUserId,
    role: 'instructor',
    status: 'active'
  });

  if (!isInstructorInOrg) {
    throw new EnrollmentError(
      400,
      'User is not an active instructor in the institution owning this course'
    );
  }

  // Idempotently add instructor
  const updatedCourse = await Course.findByIdAndUpdate(
    courseId,
    { $addToSet: { assignedInstructorIds: instructorUserId } },
    { new: true }
  );

  return {
    courseId: updatedCourse!._id.toString(),
    assignedInstructorIds: updatedCourse!.assignedInstructorIds || []
  };
}

/**
 * Revoke an instructor's assignment from a course.
 */
export async function revokeInstructorAssignment(
  actorUserId: string,
  courseIdRaw: string,
  instructorUserId: string
) {
  const courseId = parseId(courseIdRaw, 'Course');
  const authorized = await canAdministerCourse(actorUserId, courseId);
  if (!authorized) {
    throw new EnrollmentError(403, 'Forbidden: insufficient permissions to revoke instructor');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new EnrollmentError(404, 'Course not found');
  }

  const updatedCourse = await Course.findByIdAndUpdate(
    courseId,
    { $pull: { assignedInstructorIds: instructorUserId } },
    { new: true }
  );

  return {
    courseId: updatedCourse!._id.toString(),
    assignedInstructorIds: updatedCourse!.assignedInstructorIds || []
  };
}

/**
 * Issue a cryptographically secure, single-use course enrollment invitation.
 */
export async function issueCourseInvitation(
  actorUserId: string,
  courseIdRaw: string,
  options: {
    role?: CourseInvitationRole;
    expiresInHours?: number;
    recipientEmail?: string;
  } = {}
) {
  const courseId = parseId(courseIdRaw, 'Course');
  const authorized = await canManageEnrollments(actorUserId, courseId);
  if (!authorized) {
    throw new EnrollmentError(403, 'Forbidden: cannot issue invitations for this course');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new EnrollmentError(404, 'Course not found');
  }

  if (course.scope !== 'institutional' || !course.institutionId) {
    throw new EnrollmentError(400, 'Cannot issue course invitations for personal courses');
  }

  const role: CourseInvitationRole = options.role === 'instructor' ? 'instructor' : 'student';
  const hours = Math.max(
    1,
    Math.min(options.expiresInHours || DEFAULT_INVITATION_HOURS, MAX_INVITATION_HOURS)
  );
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

  const rawToken =
    role === 'student'
      ? Array.from({ length: 16 }, () => INVITATION_ALPHABET[crypto.randomInt(32)]).join('')
      : crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);

  const invitation = await CourseInvitation.create({
    courseId: course._id,
    institutionId: course.institutionId,
    role,
    tokenHash,
    recipientEmail: options.recipientEmail,
    status: 'pending',
    issuedByUserId: actorUserId,
    expiresAt
  });

  return {
    invitationId: invitation._id.toString(),
    courseId: course._id.toString(),
    role,
    token: role === 'student' ? rawToken.match(/.{4}/g)!.join('-') : rawToken,
    expiresAt
  };
}

/**
 * Accept a course invitation.
 *
 * Enforces:
 * - Token lookup via hash.
 * - Single-use atomic transition.
 * - Same-actor retry idempotency (if network failed after claim, retry returns active enrollment).
 * - Multi-actor collision rejection (second user gets 409).
 * - Recipient must be an active member of the course's institution.
 */
export async function acceptCourseInvitation(userId: string, rawToken: string, email?: string) {
  if (!userId || typeof rawToken !== 'string' || !rawToken.trim()) {
    throw new EnrollmentError(400, 'Invalid user or invitation token');
  }

  const entered = rawToken.trim();
  const compact = entered.replace(/[\s-]/g, '').toUpperCase();
  const token = /^[a-f0-9]{64}$/i.test(entered) ? entered.toLowerCase() : compact;
  const recipient = email?.trim().toLowerCase();
  return claimCourseInvitation(userId, {
    tokenHash: sha256(token),
    $or: [
      { recipientEmail: { $exists: false } },
      ...(recipient ? [{ recipientEmail: recipient }] : [])
    ]
  });
}

export async function acceptAddressedCourseInvitation(
  userId: string,
  email: string | undefined,
  invitationId: unknown
) {
  if (!email || typeof invitationId !== 'string' || !OBJECT_ID.test(invitationId)) {
    throw new EnrollmentError(404, 'Invitation not found or invalid');
  }
  return claimCourseInvitation(userId, {
    _id: invitationId,
    recipientEmail: email.trim().toLowerCase(),
    role: 'student'
  });
}

export async function listAddressedCourseInvitations(email?: string) {
  if (!email) return { invitations: [], pendingCount: 0 };
  const filter = {
    recipientEmail: email.trim().toLowerCase(),
    status: 'pending',
    role: 'student',
    expiresAt: { $gt: new Date() }
  };
  const [rows, pendingCount] = await Promise.all([
    CourseInvitation.find(filter)
      .select('courseId expiresAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    CourseInvitation.countDocuments(filter)
  ]);
  const courses = await Course.find({ _id: { $in: rows.map((row) => row.courseId) } })
    .select('title')
    .lean();
  const titles = new Map(courses.map((course) => [course._id.toString(), course.title]));
  const invitations = rows.flatMap((row) => {
    const title = titles.get(row.courseId.toString());
    return title ? [{ id: row._id.toString(), title, expiresAt: row.expiresAt }] : [];
  });
  return { invitations, pendingCount };
}

async function claimCourseInvitation(userId: string, selector: FilterQuery) {
  const now = new Date();
  const claimed = await CourseInvitation.findOneAndUpdate(
    {
      ...selector,
      status: 'pending',
      expiresAt: { $gt: now }
    },
    {
      $set: {
        status: 'accepted',
        acceptedByUserId: userId,
        acceptedAt: now
      }
    },
    { new: true }
  );

  if (!claimed) {
    // Check if it was already claimed
    const existing = await CourseInvitation.findOne(selector);
    if (!existing) {
      throw new EnrollmentError(404, 'Invitation not found or invalid');
    }
    if (existing.status === 'revoked') {
      throw new EnrollmentError(410, 'Invitation has been revoked');
    }
    if (existing.expiresAt <= now) {
      throw new EnrollmentError(410, 'Invitation has expired');
    }
    if (existing.status === 'accepted') {
      if (existing.acceptedByUserId === userId) {
        // Idempotent recovery for same user
        const enrollment = await CourseEnrollment.findOne({
          courseId: existing.courseId,
          userId,
          status: 'active'
        });
        if (enrollment) {
          return {
            courseId: existing.courseId.toString(),
            enrollmentId: enrollment._id.toString(),
            status: enrollment.status,
            recovered: true
          };
        }
      } else {
        throw new EnrollmentError(409, 'Invitation has already been accepted by another user');
      }
    }
    throw new EnrollmentError(400, 'Unable to accept invitation');
  }

  // Verify that the user is an active member in this institution
  if (claimed.institutionId) {
    const isMember = await InstitutionMembership.exists({
      institutionId: claimed.institutionId,
      userId,
      status: 'active'
    });
    if (!isMember) {
      // Revert the claim if user is not in the institution
      await CourseInvitation.findByIdAndUpdate(claimed._id, {
        $set: { status: 'pending', acceptedByUserId: null, acceptedAt: null }
      });
      throw new EnrollmentError(
        403,
        'You must be an active member of this institution before enrolling in this course'
      );
    }
  }

  if (claimed.role === 'instructor') {
    // Assign instructor role
    await Course.findByIdAndUpdate(claimed.courseId, {
      $addToSet: { assignedInstructorIds: userId }
    });
    return {
      courseId: claimed.courseId.toString(),
      role: 'instructor',
      status: 'assigned'
    };
  }

  // Upsert active student enrollment
  const enrollment = await CourseEnrollment.findOneAndUpdate(
    {
      courseId: claimed.courseId,
      userId
    },
    {
      $set: {
        status: 'active',
        institutionId: claimed.institutionId,
        enrolledAt: now
      },
      $unset: { revokedAt: 1 }
    },
    { upsert: true, new: true }
  );

  if (!enrollment) throw new EnrollmentError(503, 'Enrollment could not be persisted');
  return {
    courseId: String(claimed.courseId),
    enrollmentId: enrollment._id,
    status: enrollment.status
  };
}

/**
 * Directly enroll a student into an institutional course (Administrative or Instructor action).
 */
export async function enrollStudentDirectly(
  actorUserId: string,
  courseIdRaw: string,
  studentUserId: string
) {
  const courseId = parseId(courseIdRaw, 'Course');
  if (!studentUserId || typeof studentUserId !== 'string') {
    throw new EnrollmentError(400, 'Invalid student user ID');
  }

  const authorized = await canManageEnrollments(actorUserId, courseId);
  if (!authorized) {
    throw new EnrollmentError(403, 'Forbidden: cannot enroll students in this course');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new EnrollmentError(404, 'Course not found');
  }

  if (course.scope !== 'institutional' || !course.institutionId) {
    throw new EnrollmentError(400, 'Direct enrollment is only available for institutional courses');
  }

  // Student must be an active member in this institution
  const isMember = await InstitutionMembership.exists({
    institutionId: course.institutionId,
    userId: studentUserId,
    status: 'active'
  });

  if (!isMember) {
    throw new EnrollmentError(400, 'Target student must be an active member of this institution');
  }

  const enrollment = await CourseEnrollment.findOneAndUpdate(
    { courseId, userId: studentUserId },
    {
      $set: {
        institutionId: course.institutionId,
        status: 'active',
        enrolledAt: new Date(),
        enrolledByUserId: actorUserId
      },
      $unset: { revokedAt: 1 }
    },
    { upsert: true, new: true }
  );

  if (!enrollment) throw new EnrollmentError(503, 'Enrollment could not be persisted');
  return {
    courseId: course._id,
    userId: studentUserId,
    enrollmentId: enrollment._id,
    status: enrollment.status
  };
}

/**
 * Revoke a student's enrollment or withdraw voluntarily.
 */
export async function withdrawOrRevokeEnrollment(
  actorUserId: string,
  courseIdRaw: string,
  targetUserId?: string
) {
  const courseId = parseId(courseIdRaw, 'Course');
  const isSelf = !targetUserId || targetUserId === actorUserId;
  const studentUserId = isSelf ? actorUserId : targetUserId!;

  if (!isSelf) {
    const authorized = await canManageEnrollments(actorUserId, courseId);
    if (!authorized) {
      throw new EnrollmentError(403, 'Forbidden: cannot revoke this enrollment');
    }
  }

  const enrollment = await CourseEnrollment.findOne({ courseId, userId: studentUserId });
  if (!enrollment) {
    throw new EnrollmentError(404, 'Enrollment not found');
  }

  const newStatus: CourseEnrollmentStatus = isSelf ? 'dropped' : 'revoked';
  enrollment.status = newStatus;
  enrollment.revokedAt = new Date();
  await CourseEnrollment.save(enrollment);

  return {
    courseId,
    userId: studentUserId,
    status: newStatus
  };
}

/**
 * List active enrollments for a course.
 */
export async function listCourseEnrollments(actorUserId: string, courseIdRaw: string) {
  const courseId = parseId(courseIdRaw, 'Course');
  const authorized = await canManageEnrollments(actorUserId, courseId);
  if (!authorized) {
    throw new EnrollmentError(403, 'Forbidden: cannot view course enrollment roster');
  }

  const enrollments = await CourseEnrollment.find({ courseId, status: 'active' })
    .sort({ enrolledAt: -1 })
    .lean();

  return enrollments.map((e) => ({
    enrollmentId: e._id.toString(),
    userId: e.userId,
    status: e.status,
    enrolledAt: e.enrolledAt
  }));
}

/**
 * List courses accessible to a user in a particular institutional or personal context.
 */
export async function listAccessibleCourses(userId: string, institutionIdRaw?: string) {
  if (!userId) return [];

  if (institutionIdRaw) {
    const institutionId = parseId(institutionIdRaw, 'Institution');

    if (!(await Institution.exists({ _id: institutionId, status: 'active' }))) {
      throw new EnrollmentError(403, 'Institution is not active');
    }

    // Check caller's role in this institution
    const membership = await InstitutionMembership.findOne({
      institutionId,
      userId,
      status: 'active'
    }).lean();

    if (!membership) {
      throw new EnrollmentError(403, 'User has no active membership in this institution');
    }

    if (membership.role === 'university_admin') {
      // Admin sees all institutional courses for this institution
      return Course.find({ institutionId, scope: 'institutional' })
        .select('_id title scope institutionId assignedInstructorIds createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean();
    }

    if (membership.role === 'instructor') {
      // Instructor sees courses where they are owner OR assigned instructor
      return Course.find({
        institutionId,
        scope: 'institutional',
        $or: [{ userId }, { ownerUserId: userId }, { assignedInstructorIds: userId }]
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Student sees courses where they are actively enrolled
    const activeEnrollments = await CourseEnrollment.find({
      institutionId,
      userId,
      status: 'active'
    })
      .select('courseId')
      .lean();

    const enrolledCourseIds = activeEnrollments.map((e) => e.courseId);
    return Course.find({
      _id: { $in: enrolledCourseIds },
      institutionId,
      scope: 'institutional'
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Personal mode / default:
  // Personal courses owned by user + any active enrollments + assigned courses
  const personalCourses = await Course.find({
    $or: [
      { userId, scope: 'personal' },
      { userId, scope: { $exists: false } },
      { ownerUserId: userId, scope: 'personal' }
    ]
  }).lean();

  return personalCourses;
}
