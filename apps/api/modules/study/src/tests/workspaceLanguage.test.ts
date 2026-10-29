import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
/**
 * Persisted interface language. The choice must survive a reload and must never
 * accept a value the workspace cannot render, or the learner gets a
 * half-translated page with no way back.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../../../user-profile/src/models/UserProfile', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findOneAndUpdate: jest.fn() }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const UserProfile = require('../../../user-profile/src/models/UserProfile').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
import learningRoutes from '../routes/learning';

const app = express();
app.use(express.json());
const fakeAuth = (req: DomainRequest, _res: Response, next: NextFunction) => {
  req.user = { userId: 'learner-1', role: 'student' };
  next();
};
app.use('/api/v1/study/learning', fakeAuth, learningRoutes);

const profileResult = (preferences?: Record<string, unknown>) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(preferences === undefined ? null : { preferences })
});

describe('GET /language', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the stored language', async () => {
    UserProfile.findOne.mockReturnValue(profileResult({ language: 'ar' }));
    const res = await request(app).get('/api/v1/study/learning/language').expect(200);
    expect(res.body).toEqual({ language: 'ar' });
  });

  it('falls back to English when nothing is stored', async () => {
    UserProfile.findOne.mockReturnValue(profileResult());
    const res = await request(app).get('/api/v1/study/learning/language').expect(200);
    expect(res.body.language).toBe('en');
  });

  it('ignores a stored value the workspace cannot render', async () => {
    UserProfile.findOne.mockReturnValue(profileResult({ language: 'zz' }));
    const res = await request(app).get('/api/v1/study/learning/language').expect(200);
    expect(res.body.language).toBe('en');
  });
});

describe('PUT /language', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists a supported language on the learner profile', async () => {
    UserProfile.findOneAndUpdate.mockResolvedValue({});
    const res = await request(app)
      .put('/api/v1/study/learning/language')
      .send({ language: 'ary' })
      .expect(200);

    expect(res.body).toEqual({ language: 'ary' });
    const [filter, update] = UserProfile.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ userId: 'learner-1' });
    expect(update.$set).toEqual({ 'preferences.language': 'ary' });
  });

  it('rejects an unsupported language instead of storing it', async () => {
    const res = await request(app)
      .put('/api/v1/study/learning/language')
      .send({ language: 'zz' })
      .expect(400);

    expect(res.body.error).toMatch(/Unsupported interface language/);
    expect(UserProfile.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a missing language', async () => {
    await request(app).put('/api/v1/study/learning/language').send({}).expect(400);
    expect(UserProfile.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
