const findById = jest.fn();
const institutionExists = jest.fn();

jest.mock('../models', () => ({
  Course: { findById: (...a: unknown[]) => findById(...a) },
  CourseEnrollment: { exists: jest.fn(async () => null) },
  Institution: { exists: (...a: unknown[]) => institutionExists(...a) },
  InstitutionMembership: { findOne: jest.fn(() => ({ lean: async () => null })) },
  StudyPlan: {}
}));

import { getCourseAccessRole, canReadCourse, canManageCourse } from '../services/resourceAccess';

const id = '0123456789abcdef01234567';
const stranger = 'someone-else';

function stored(doc: Record<string, unknown>) {
  findById.mockReturnValue({ select: () => ({ lean: async () => doc }) });
}

describe('public course read grant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets any signed-in user read a published public personal course, read only', async () => {
    stored({ scope: 'personal', userId: 'owner', visibility: 'public', activeRevisionId: 'r1' });
    expect(await getCourseAccessRole(stranger, id)).toBe('student');
    expect(await canReadCourse(stranger, id)).toBe(true);
    expect(await canManageCourse(stranger, id)).toBe(false);
  });

  it('does not expose a public course that has no published version', async () => {
    stored({ scope: 'personal', userId: 'owner', visibility: 'public' });
    expect(await canReadCourse(stranger, id)).toBe(false);
  });

  it('does not expose a private course', async () => {
    stored({ scope: 'personal', userId: 'owner', visibility: 'private', activeRevisionId: 'r1' });
    expect(await canReadCourse(stranger, id)).toBe(false);
    stored({ scope: 'personal', userId: 'owner', activeRevisionId: 'r1' });
    expect(await canReadCourse(stranger, id)).toBe(false);
  });

  it('keeps the owner as owner', async () => {
    stored({ scope: 'personal', userId: 'owner', visibility: 'public', activeRevisionId: 'r1' });
    expect(await getCourseAccessRole('owner', id)).toBe('owner');
  });

  it('closes a public institutional course when the institution is not active', async () => {
    stored({
      scope: 'institutional',
      institutionId: 'i1',
      visibility: 'public',
      activeRevisionId: 'r1'
    });
    institutionExists.mockResolvedValue(null);
    expect(await canReadCourse(stranger, id)).toBe(false);
    institutionExists.mockResolvedValue({ _id: 'i1' });
    expect(await canReadCourse(stranger, id)).toBe(true);
  });
});
