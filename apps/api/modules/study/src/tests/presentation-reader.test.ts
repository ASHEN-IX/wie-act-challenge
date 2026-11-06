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

  it('projects a deterministic read-mode plan from canonical content', async () => {
    const { canonicalBlocks } = jest.requireMock('../services/courseReader');
    (canonicalBlocks as jest.Mock).mockImplementation(
      (blocks: Array<Record<string, unknown>>) =>
        blocks.map((block, index) => ({
          ...block,
          id: block.id ?? `b${index}`,
        })),
    );
    load.mockResolvedValue({
      context: {
        courseId: '0123456789abcdef01234567',
        revisionId: 'rev_plan',
        contentHash: 'sha256:' + 'b'.repeat(64),
        title: 'Séries',
        topics: [],
      },
      revision: { contentDocumentHash: 'sha256:' + 'c'.repeat(64), summary: '' },
      artifact: { metadata: { documents: [] } },
      canonical: {
        chapters: [
          {
            id: 'ch1',
            title: 'Chapitre 3',
            lessons: [
              {
                id: 'l1',
                title: 'Rappels',
                summary: '',
                blocks: [
                  { type: 'paragraph', id: 'p1', text: 'Prose.', evidence: ['c1'] },
                  {
                    type: 'callout',
                    id: 'd1',
                    kind: 'definition',
                    text: 'Definition body.',
                    evidence: ['c1'],
                  },
                  {
                    type: 'math',
                    id: 'm1',
                    expression: 'S_n = sum u_p',
                    notation: 'plain',
                  },
                ],
              },
            ],
          },
        ],
        quality: undefined,
      },
    } as never);

    const presentation = await getPublishedPresentation(
      'owner',
      '0123456789abcdef01234567',
      'rev_plan',
    );
    const plan = presentation.plan;
    expect(plan).toBeDefined();
    expect(plan!.mode).toBe('read');
    expect(plan!.lessons[0].instances.map((entry) => entry.component)).toEqual([
      'ConceptExplanation',
      'DefinitionCard',
      'SourceMathFallback',
    ]);
    // Read mode is a reading projection: nothing is interactive.
    expect(plan!.lessons[0].counts.interactive).toBe(0);
    expect(plan!.unclassified).toBe(0);
  });
});
