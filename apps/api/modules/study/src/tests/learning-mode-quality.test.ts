/** M4.3 hardening: do the five modes actually differ, on real lesson shapes?
 *
 * The mode contract is tested elsewhere. This asks a narrower question: given a
 * lesson whose blocks are knowable, does each mode produce an observably
 * different arrangement — or does it correctly report that it cannot?
 *
 * Only the deterministic parts are asserted here: preferred-component
 * selection against the real capability registry, disclosure policy, and the
 * indistinguishable-from-Read predicate. Nothing here claims a pedagogical
 * benefit, because no student outcomes were measured.
 */
import {
  LEARNING_MODES,
  MODE_POLICIES,
  indistinguishableFromRead,
  modePolicy,
} from '../../../../shared/ednova/learningModes';
import { COMPONENT_CAPABILITIES } from '../../../../shared/ednova/componentRegistry';
import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';

/** A lesson shape like the QA fixture: prose, definition, reviewed formula,
 * unreviewed formula, proof, code, exercise. */
const lessonBlocks: LessonBlockV2[] = [
  { type: 'heading', id: 'h1', level: 2, text: 'Summation identities' },
  { type: 'paragraph', id: 'p1', text: 'A series is the limit of its partial sums.', evidence: ['c1'] },
  { type: 'callout', id: 'd1', kind: 'definition', title: 'Convergent series', text: 'A series converges…', evidence: ['c1'] },
  {
    type: 'math',
    id: 'm1',
    expression: '\\sum_{k=1}^{n} k',
    notation: 'latex',
    evidence: ['c1'],
    review: { state: 'accepted', originalExpression: 'sum k', modelExpression: '\\sum k', reviewer: 'r' },
  },
  { type: 'math', id: 'm2', expression: 'S_n = \\sum u_p', notation: 'plain', evidence: ['c1'] },
  { type: 'callout', id: 'pr1', kind: 'proof', title: 'Proof', text: 'By induction.', evidence: ['c1'] },
  { type: 'code', id: 'code1', language: 'python', code: 'def total(n):\n    return n', evidence: ['c1'] },
  { type: 'callout', id: 'ex1', kind: 'exercise', title: 'Exercise 1', text: 'Prove it.', evidence: ['c1'] },
];

describe('mode quality on a realistic lesson', () => {
  it('every mode preference names a component the registry actually owns', () => {
    // A mode must never prefer a component that does not exist; otherwise the
    // preference is a silent no-op and the mode collapses into Read.
    for (const mode of LEARNING_MODES) {
      for (const component of MODE_POLICIES[mode].preferredComponents)
        expect(COMPONENT_CAPABILITIES[component]).toBeDefined();
    }
  });

  it('Guided prefers reading aids and collapses proof disclosure', () => {
    const policy = modePolicy('guided');
    expect(policy.preferredComponents).toContain('DefinitionCard');
    expect(policy.preferredComponents).toContain('ExampleBlock');
    expect(policy.prefers.disclosure).toBe('collapsed');
    expect(policy.prefers.proofs).toBe(true);
  });

  it('Practice prefers exercises, and the lesson has one to surface', () => {
    const exercises = lessonBlocks.filter(
      (block) => block.type === 'callout' && block.kind === 'exercise',
    );
    expect(exercises).toHaveLength(1);
    expect(modePolicy('practice').preferredComponents[0]).toBe('ExerciseBlock');
  });

  it('Deep Dive prefers proofs and source references, both present in this lesson', () => {
    const proves = lessonBlocks.filter(
      (block) => block.type === 'callout' && block.kind === 'proof',
    );
    expect(proves).toHaveLength(1);
    const policy = modePolicy('deep_dive');
    expect(policy.preferredComponents).toContain('ProofBlock');
    expect(policy.preferredComponents).toContain('SourceReference');
    expect(policy.prefers.disclosure).toBe('expanded');
  });

  it('Deep Dive cannot promote an unreviewed formula: the fallback is preferred', () => {
    const unreviewed = lessonBlocks.find(
      (block) => block.type === 'math' && !('review' in block && block.review),
    );
    expect(unreviewed).toBeDefined();
    // The mode prefers the source-faithful component over anything that would
    // typeset unreviewed mathematics as approved.
    expect(modePolicy('deep_dive').preferredComponents).toContain('SourceMathFallback');
  });

  it('Explore reports it cannot differ when the lesson has no interactive material', () => {
    // This lesson has code and math but no structured asset and no diagram
    // block, so Explore has nothing interactive to offer.
    const hasStructuredAsset = false;
    const hasInteractiveBlock = lessonBlocks.some((block) => block.type === 'diagram');
    expect(hasInteractiveBlock).toBe(false);
    expect(indistinguishableFromRead('explore', { hasStructuredAsset, hasInteractiveBlock })).toBe(
      true,
    );
  });

  it('Explore is distinguishable once a structured asset exists', () => {
    expect(
      indistinguishableFromRead('explore', {
        hasStructuredAsset: true,
        hasInteractiveBlock: false,
      }),
    ).toBe(false);
  });

  it('Read is never indistinguishable-from-Read, and never plans', () => {
    expect(
      indistinguishableFromRead('read', { hasStructuredAsset: false, hasInteractiveBlock: false }),
    ).toBe(false);
    expect(modePolicy('read').usesPlanner).toBe(false);
    expect(modePolicy('read').preferredComponents).toHaveLength(0);
  });

  it('reading modes remain distinguishable from each other', () => {
    // Guided, Practice and Deep Dive differ by disclosure and preference, so
    // none is ever reported as identical to Read.
    for (const mode of ['guided', 'practice', 'deep_dive'] as const)
      expect(
        indistinguishableFromRead(mode, {
          hasStructuredAsset: false,
          hasInteractiveBlock: false,
        }),
      ).toBe(false);
  });

  it('each mode has a distinct preferred-component signature', () => {
    const signatures = LEARNING_MODES.map((mode) => MODE_POLICIES[mode].preferredComponents.join('|'));
    // Read is empty by design; the four planned modes must not be identical to
    // each other, or the selector would offer duplicate experiences.
    const planned = signatures.slice(1);
    expect(new Set(planned).size).toBe(planned.length);
  });
});
