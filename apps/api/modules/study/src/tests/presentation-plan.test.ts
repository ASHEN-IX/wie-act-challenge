import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';
import {
  buildPresentationPlan,
  isReaderMode,
  plansEqual,
  type PlanLessonInput,
} from '../../../../shared/ednova/presentationPlan';

const sourceMeta = {
  regionId: 'region_aaaaaaaaaaaaaaaaaaaa',
  page: 3,
  bbox: [1, 2, 3, 4] as [number, number, number, number],
  extractionMethod: 'text' as const,
  confidence: 0.9,
  reviewRequired: false,
  issues: [],
};

const lesson = (blocks: LessonBlockV2[]): PlanLessonInput => ({
  id: 'lesson-1',
  title: 'Lesson',
  blocks: blocks.map((block) => ({
    id: block.id,
    render:
      block.type === 'math' && !block.review
        ? ('source_faithful' as const)
        : ('primary' as const),
    reason:
      block.type === 'math' && !block.review
        ? ('unreviewed_formula' as const)
        : ('extracted_content' as const),
    block,
  })),
});

const plan = (blocks: LessonBlockV2[], mode: 'read' | 'explore' | 'practice' = 'read') =>
  buildPresentationPlan({
    courseId: 'a'.repeat(24),
    revisionId: 'rev_1',
    contentHash: 'sha256:' + 'b'.repeat(64),
    mode,
    lessons: [lesson(blocks)],
  });

describe('deterministic presentation plan', () => {
  it('is reproducible for identical inputs', () => {
    const blocks: LessonBlockV2[] = [
      { type: 'heading', id: 'h1', level: 2, text: 'Chapter' },
      { type: 'paragraph', id: 'p1', text: 'Prose.', evidence: ['c1'] },
    ];
    expect(plansEqual(plan(blocks), plan(blocks))).toBe(true);
  });

  it('preserves canonical order and emits one instance per block', () => {
    const blocks: LessonBlockV2[] = [
      { type: 'heading', id: 'a', level: 2, text: 'One' },
      { type: 'paragraph', id: 'b', text: 'Two', evidence: ['c1'] },
      { type: 'list', id: 'c', ordered: false, items: ['x'], evidence: ['c1'] },
      { type: 'quote', id: 'd', text: 'Three', evidence: ['c1'] },
    ];
    const result = plan(blocks);
    expect(result.lessons[0].instances.map((i) => i.blockId)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.lessons[0].counts.total).toBe(4);
    expect(result.unclassified).toBe(0);
  });

  it('routes reviewed mathematics to ReviewedFormula', () => {
    const result = plan([
      {
        type: 'math',
        id: 'm1',
        expression: '\\sum_{n=0}^{+\\infty} u_n',
        notation: 'latex',
        review: {
          state: 'accepted',
          originalExpression: 'X un',
          modelExpression: '\\sum u_n',
          reviewer: 'instructor',
        },
      },
    ]);
    expect(result.lessons[0].instances[0].component).toBe('ReviewedFormula');
    expect(result.lessons[0].instances[0].selection).toBe('reviewed_math');
  });

  it('never typesets unreviewed mathematics as primary', () => {
    const result = plan([
      { type: 'math', id: 'm1', expression: '∫ f x dx', notation: 'plain', sourceMeta },
    ]);
    const instance = result.lessons[0].instances[0];
    expect(instance.component).toBe('SourceMathFallback');
    expect(instance.render).toBe('source_faithful');
    expect(instance.reason).toBe('unreviewed_formula');
    expect(instance.interactive).toBe(false);
  });

  it('detects a multiline derivation only in reviewed LaTeX', () => {
    const reviewed = plan([
      {
        type: 'math',
        id: 'd1',
        expression: '\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}',
        notation: 'latex',
        review: {
          state: 'corrected',
          originalExpression: 'a=b',
          modelExpression: '\\begin{aligned}a&=b\\end{aligned}',
          reviewer: 'instructor',
        },
      },
    ]);
    expect(reviewed.lessons[0].instances[0].component).toBe('DerivationBlock');
    // The same text without review stays a source fallback.
    const unreviewed = plan([
      {
        type: 'math',
        id: 'd2',
        expression: '\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}',
        notation: 'latex',
      },
    ]);
    expect(unreviewed.lessons[0].instances[0].component).toBe('SourceMathFallback');
  });

  it('maps semantic callout roles to distinct components', () => {
    const roles = [
      ['definition', 'DefinitionCard'],
      ['theorem', 'TheoremCard'],
      ['proposition', 'TheoremCard'],
      ['lemma', 'TheoremCard'],
      ['corollary', 'TheoremCard'],
      ['proof', 'ProofBlock'],
      ['example', 'ExampleBlock'],
      ['exercise', 'ExerciseBlock'],
      ['remark', 'ImportantNote'],
      ['guidance', 'ImportantNote'],
    ] as const;
    for (const [kind, expected] of roles) {
      const result = plan([
        { type: 'callout', id: `c-${kind}`, kind, text: 'Body', evidence: ['c1'] },
      ]);
      expect(result.lessons[0].instances[0].component).toBe(expected);
    }
  });

  it('does not convert an exercise into a graded assessment', () => {
    const result = plan([
      { type: 'callout', id: 'ex', kind: 'exercise', text: 'Prove that…', evidence: ['c1'] },
    ]);
    const instance = result.lessons[0].instances[0];
    expect(instance.component).toBe('ExerciseBlock');
    expect(instance.interactive).toBe(false);
  });

  it('renders every canonical block type without dropping content', () => {
    const blocks: LessonBlockV2[] = [
      { type: 'heading', id: 'b1', level: 2, text: 'H' },
      { type: 'paragraph', id: 'b2', text: 'P', evidence: ['c'] },
      { type: 'list', id: 'b3', ordered: true, items: ['i'], evidence: ['c'] },
      { type: 'quote', id: 'b4', text: 'Q', evidence: ['c'] },
      { type: 'code', id: 'b5', language: 'python', code: 'print(1)' },
      {
        type: 'math',
        id: 'b6',
        expression: 'x',
        notation: 'latex',
        review: {
          state: 'accepted',
          originalExpression: 'x',
          modelExpression: 'x',
          reviewer: 'r',
        },
      },
      { type: 'table', id: 'b7', columns: ['a'], rows: [['1']], evidence: ['c'] },
      { type: 'media', id: 'b8', mediaType: 'image', alt: 'fig', src: '/api/v1/x' },
      { type: 'diagram', id: 'b9', title: 'D', description: 'desc', steps: [] },
      { type: 'callout', id: 'b10', kind: 'note', text: 'N', evidence: ['c'] },
      {
        type: 'chart',
        id: 'b11',
        title: 'C',
        kind: 'bar',
        categories: ['x'],
        series: [{ label: 's', values: [1] }],
        evidence: ['c'],
      },
    ];
    const result = plan(blocks);
    expect(result.lessons[0].counts.total).toBe(blocks.length);
    expect(result.unclassified).toBe(0);
    expect(new Set(result.lessons[0].instances.map((i) => i.blockId)).size).toBe(blocks.length);
  });

  it('degrades a media block with no source region to a trusted fallback', () => {
    const result = plan([
      { type: 'media', id: 'm', mediaType: 'image', alt: 'missing', src: '/api/v1/x' },
    ]);
    const instance = result.lessons[0].instances[0];
    // FigureViewer requires a source region; without one the engine degrades
    // rather than claiming the figure is verified.
    expect(instance.component).toBe('SourceDiagram');
    expect(instance.degraded?.failure).toBe('missing_source_region');
  });

  it('keeps Read mode free of interactions and offers them in Explore', () => {
    const blocks: LessonBlockV2[] = [
      { type: 'callout', id: 'pf', kind: 'proof', text: 'Proof.', evidence: ['c'] },
      {
        type: 'diagram',
        id: 'dg',
        title: 'Process',
        description: 'd',
        steps: [{ id: 's1', label: 'Step' }],
      },
    ];
    expect(plan(blocks, 'read').lessons[0].counts.interactive).toBe(0);
    expect(plan(blocks, 'explore').lessons[0].counts.interactive).toBe(2);
    // Practice is a layout policy; it does not invent graded activities.
    expect(plan(blocks, 'practice').lessons[0].counts.interactive).toBe(0);
  });

  it('never offers an interaction on unreviewed mathematics', () => {
    const blocks: LessonBlockV2[] = [
      { type: 'math', id: 'm', expression: 'x', notation: 'plain', sourceMeta },
    ];
    expect(plan(blocks, 'explore').lessons[0].instances[0].interactive).toBe(false);
  });

  it('accepts only the documented reader modes', () => {
    expect(isReaderMode('read')).toBe(true);
    expect(isReaderMode('explore')).toBe(true);
    expect(isReaderMode('practice')).toBe(true);
    expect(isReaderMode('ai-plan')).toBe(false);
    expect(isReaderMode(undefined)).toBe(false);
  });

  it('counts primary and source-faithful instances for the disclosure', () => {
    const result = plan([
      { type: 'paragraph', id: 'p', text: 'Prose', evidence: ['c'] },
      { type: 'math', id: 'm', expression: 'x', notation: 'plain', sourceMeta },
    ]);
    expect(result.lessons[0].counts.primary).toBe(1);
    expect(result.lessons[0].counts.sourceFallback).toBe(1);
  });
});
