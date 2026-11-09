const courseDoc: Record<string, unknown> = {};
const findById = jest.fn();
const roleMock = jest.fn();

jest.mock('../models', () => ({
  Course: {
    findById: (...a: unknown[]) => findById(...a),
    findOne: jest.fn(),
    // The route saves through the model static now.
    save: jest.fn(async (row: Record<string, unknown>) => row)
  },
  Institution: { exists: jest.fn(), find: jest.fn() },
  PublicCourseJoin: { updateOne: jest.fn(), deleteOne: jest.fn(), find: jest.fn() }
}));
jest.mock('../services/resourceAccess', () => ({
  getCourseAccessRole: (...a: unknown[]) => roleMock(...a)
}));

import {
  effectiveVisibility,
  setCourseVisibility,
  VisibilityError
} from '../services/courseVisibility';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Course } = jest.requireMock('../models');

const id = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';

function course(over: Record<string, unknown>) {
  const doc: Record<string, unknown> & { save: jest.Mock } = {
    ...courseDoc,
    save: jest.fn(),
    ...over
  };
  findById.mockReturnValue({ select: () => Promise.resolve(doc) });
  return doc;
}

describe('effectiveVisibility', () => {
  it('keeps the old meaning for courses without the field', () => {
    expect(effectiveVisibility({})).toBe('private');
    expect(effectiveVisibility({ scope: 'personal' })).toBe('private');
    expect(effectiveVisibility({ scope: 'institutional' })).toBe('institution');
    expect(effectiveVisibility({ scope: 'institutional', visibility: 'public' })).toBe('public');
  });
});

describe('setCourseVisibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets the owner of a published personal course make it public', async () => {
    roleMock.mockResolvedValue('owner');
    const doc = course({ scope: 'personal', activeRevisionId: 'r1' });
    await expect(setCourseVisibility('u', id, 'public')).resolves.toEqual({ visibility: 'public' });
    expect(doc.visibility).toBe('public');
    expect(Course.save).toHaveBeenCalledWith(doc);
  });

  it('refuses public before the course is published', async () => {
    roleMock.mockResolvedValue('owner');
    course({ scope: 'personal' });
    await expect(setCourseVisibility('u', id, 'public')).rejects.toMatchObject({ status: 409 });
  });

  it('hides the course from learners and non-members', async () => {
    roleMock.mockResolvedValue('student');
    await expect(setCourseVisibility('u', id, 'public')).rejects.toMatchObject({ status: 404 });
    roleMock.mockResolvedValue(null);
    await expect(setCourseVisibility('u', id, 'public')).rejects.toMatchObject({ status: 404 });
  });

  it('lets the creating instructor or an institution admin go public, not another instructor', async () => {
    roleMock.mockResolvedValue('instructor');
    course({ scope: 'institutional', userId: 'someone-else', activeRevisionId: 'r1' });
    await expect(setCourseVisibility('u', id, 'public')).rejects.toMatchObject({ status: 403 });
    const mine = course({ scope: 'institutional', userId: 'u', activeRevisionId: 'r1' });
    await setCourseVisibility('u', id, 'public');
    expect(mine.visibility).toBe('public');
    roleMock.mockResolvedValue('admin');
    const doc = course({ scope: 'institutional', userId: 'someone-else', activeRevisionId: 'r1' });
    await setCourseVisibility('u', id, 'public');
    expect(doc.visibility).toBe('public');
  });

  it('rejects values that do not fit the course type or are unknown', async () => {
    roleMock.mockResolvedValue('owner');
    course({ scope: 'personal', activeRevisionId: 'r1' });
    await expect(setCourseVisibility('u', id, 'institution')).rejects.toBeInstanceOf(
      VisibilityError
    );
    course({ scope: 'institutional', activeRevisionId: 'r1' });
    await expect(setCourseVisibility('u', id, 'private')).rejects.toMatchObject({ status: 400 });
    await expect(setCourseVisibility('u', id, 'everyone')).rejects.toMatchObject({ status: 400 });
  });

  it('allows making a public course private again', async () => {
    roleMock.mockResolvedValue('owner');
    const doc = course({ scope: 'personal', visibility: 'public', activeRevisionId: 'r1' });
    await setCourseVisibility('u', id, 'private');
    expect(doc.visibility).toBe('private');
  });
});
