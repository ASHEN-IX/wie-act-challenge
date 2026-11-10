import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDraft, bloomFromStatement } from '../modules/study/src/services/courseReview';

const long =
  'A well formed lesson body that explains the idea in enough detail for students to study it properly and practise it.';

function topic(id: string, title: string, subs: Array<Record<string, unknown>>) {
  return { id, title, subtopics: subs };
}

describe('analyzeDraft', () => {
  it('is ready for a clean multi-chapter draft', () => {
    const r = analyzeDraft({
      summary: 'Intro course',
      sourceReviewPending: false,
      topics: [
        topic('t1', 'Arrays', [
          {
            id: 's1',
            title: 'Indexing arrays',
            summary: long,
            learning_objectives: [{ statement: 'Trace an index lookup.' }]
          }
        ]),
        topic('t2', 'Graphs', [
          {
            id: 's2',
            title: 'Shortest paths',
            summary: long,
            learning_objectives: [{ statement: 'Compare two path algorithms.' }]
          }
        ])
      ]
    });
    assert.equal(r.verdict, 'ready');
    assert.deepEqual(r.counts, { chapters: 2, lessons: 2, objectives: 2 });
  });

  it('blocks on pending source review and never clears it', () => {
    const r = analyzeDraft({
      summary: 'x',
      sourceReviewPending: true,
      topics: [
        topic('t1', 'A', [
          {
            id: 's1',
            title: 'Indexing arrays',
            summary: long,
            learning_objectives: [{ statement: 'Trace it.' }]
          }
        ])
      ]
    });
    assert.equal(r.verdict, 'blocked');
    assert.ok(
      r.findings.some((f) => f.code === 'SOURCE_REVIEW_PENDING' && f.severity === 'blocker')
    );
  });

  it('blocks an empty draft', () => {
    const r = analyzeDraft({ topics: [], sourceReviewPending: false });
    assert.equal(r.verdict, 'blocked');
    assert.ok(r.findings.some((f) => f.code === 'NO_CONTENT'));
  });

  it('flags placeholder objectives, missing objectives, thin and clipped lessons, duplicates', () => {
    const r = analyzeDraft({
      summary: 'x',
      sourceReviewPending: false,
      topics: [
        topic('t1', 'A', [
          { id: 's1', title: 'Explain the', summary: 'short', learning_objectives: [] },
          {
            id: 's2',
            title: 'Dup',
            summary: long,
            learning_objectives: [{ statement: 'Explain the main ideas and methods in Dup.' }]
          },
          {
            id: 's3',
            title: 'dup',
            summary: long,
            learning_objectives: [{ statement: 'Trace it.' }]
          }
        ]),
        topic('t2', 'B', [
          {
            id: 's4',
            title: 'Fine',
            summary: long,
            learning_objectives: [{ statement: 'Trace it.' }]
          }
        ])
      ]
    });
    const codes = r.findings.map((f) => f.code);
    for (const c of [
      'TITLE_CUT_OFF',
      'NO_OBJECTIVE',
      'THIN_LESSON',
      'GENERIC_OBJECTIVE',
      'DUPLICATE_TITLE'
    ])
      assert.ok(codes.includes(c), `missing ${c}`);
    assert.equal(r.verdict, 'needs_attention');
  });
});

describe('bloomFromStatement', () => {
  it('maps leading verbs and defaults to understand', () => {
    assert.equal(bloomFromStatement('Trace the algorithm on a graph'), 'apply');
    assert.equal(bloomFromStatement('Compare BFS and DFS'), 'analyze');
    assert.equal(bloomFromStatement('Describe how hashing works'), 'understand');
  });
});
