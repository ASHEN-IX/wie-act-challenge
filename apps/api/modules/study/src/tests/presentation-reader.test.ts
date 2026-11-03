jest.mock('../services/courseReader', () => ({
  loadPublishedReading: jest.fn(),
  canonicalBlocks: jest.fn(() => []),
}));

import { loadPublishedReading } from '../services/courseReader';
import {
  PresentationUnavailableError,
  getPublishedPresentation,
} from '../services/presentationReader';

const load = loadPublishedReading as jest.MockedFunction<typeof loadPublishedReading>;

describe('published presentation projection', () => {
  it('fails closed with a 409 when the revision has no canonical document', async () => {
    load.mockResolvedValue({
      context: {
        courseId: '0123456789abcdef01234567',
        revisionId: 'rev_source',
        contentHash: 'sha256:' + 'a'.repeat(64),
        title: 'Math',
        topics: [],
      },
      revision: {},
      artifact: { metadata: { documents: [] } },
      canonical: null,
    } as never);
    await expect(
      getPublishedPresentation('owner', '0123456789abcdef01234567', 'rev_source'),
    ).rejects.toBeInstanceOf(PresentationUnavailableError);
    await expect(
      getPublishedPresentation('owner', '0123456789abcdef01234567', 'rev_source'),
    ).rejects.toMatchObject({ status: 409 });
    expect(load).toHaveBeenCalledWith('owner', '0123456789abcdef01234567', 'rev_source');
  });
});
