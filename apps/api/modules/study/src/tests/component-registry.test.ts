import {
  COMPONENT_CAPABILITIES,
  COMPONENT_REGISTRY_VERSION,
  COMPONENT_TYPES,
  isComponentType,
  resolveComponent,
  semanticRole,
} from '../../../../shared/ednova/componentRegistry';

describe('trusted educational component registry', () => {
  it('freezes the capability table and version', () => {
    expect(COMPONENT_REGISTRY_VERSION).toBe('1.0.0');
    expect(Object.isFrozen(COMPONENT_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(COMPONENT_CAPABILITIES.FormulaBlock)).toBe(true);
    expect(COMPONENT_TYPES.length).toBeGreaterThanOrEqual(30);
  });

  it('only exposes literal component types and rejects arbitrary names', () => {
    expect(isComponentType('FormulaBlock')).toBe(true);
    expect(isComponentType('../../etc/passwd')).toBe(false);
    expect(isComponentType('eval')).toBe(false);
    expect(isComponentType('__proto__')).toBe(false);
    expect(isComponentType('constructor')).toBe(false);
  });

  it('gives every component a trusted fallback that exists', () => {
    for (const capability of Object.values(COMPONENT_CAPABILITIES)) {
      expect(Object.hasOwn(COMPONENT_CAPABILITIES, capability.fallback)).toBe(true);
    }
  });

  it('declares a text alternative for every component', () => {
    for (const capability of Object.values(COMPONENT_CAPABILITIES)) {
      expect(capability.accessibility.textAlternative).toBe(true);
    }
  });

  it('marks every interactive component as keyboard operable', () => {
    for (const capability of Object.values(COMPONENT_CAPABILITIES)) {
      if (capability.interaction === 'none') continue;
      expect(capability.accessibility.keyboardOperable).toBe(true);
    }
  });

  it('bounds every interactive component that computes', () => {
    for (const capability of Object.values(COMPONENT_CAPABILITIES)) {
      if (capability.performance.tier !== 'interactive') continue;
      expect(capability.performance.bounds).toBeDefined();
    }
  });

  it('resolves a reviewed formula only when the formula is reviewed', () => {
    expect(
      resolveComponent({
        component: 'ReviewedFormula',
        blockType: 'math',
        policy: 'primary',
        hasEvidence: true,
        hasSourceRegion: true,
        isReviewedFormula: true,
        hasStructuredFixture: false,
      }).ok,
    ).toBe(true);
    const refused = resolveComponent({
      component: 'ReviewedFormula',
      blockType: 'math',
      policy: 'primary',
      hasEvidence: true,
      hasSourceRegion: true,
      isReviewedFormula: false,
      hasStructuredFixture: false,
    });
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.reason).toBe('unreviewed_formula');
    expect(refused.ok === false && refused.fallback.type).toBe('SourceMathFallback');
  });

  it('refuses to place a source-faithful block in a primary-only component', () => {
    const result = resolveComponent({
      component: 'FormulaBlock',
      blockType: 'math',
      policy: 'source_faithful',
      hasEvidence: true,
      hasSourceRegion: true,
      isReviewedFormula: false,
      hasStructuredFixture: false,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('incompatible_policy');
  });

  it('refuses a semantic role a component does not accept', () => {
    const result = resolveComponent({
      component: 'DefinitionCard',
      blockType: 'callout',
      role: 'theorem',
      policy: 'primary',
      hasEvidence: true,
      hasSourceRegion: false,
      isReviewedFormula: false,
      hasStructuredFixture: false,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('incompatible_role');
    expect(result.ok === false && result.fallback.type).toBe('ImportantNote');
  });

  it('falls back to ConceptExplanation for an unknown component type', () => {
    const result = resolveComponent({
      // Simulates a tampered projection payload.
      component: 'EvilComponent' as never,
      blockType: 'paragraph',
      policy: 'primary',
      hasEvidence: true,
      hasSourceRegion: false,
      isReviewedFormula: false,
      hasStructuredFixture: false,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('unknown_component');
    expect(result.ok === false && result.fallback.type).toBe('ConceptExplanation');
  });

  it('classifies known semantic roles and leaves unknown kinds generic', () => {
    expect(semanticRole('definition')).toBe('definition');
    expect(semanticRole('corollary')).toBe('corollary');
    expect(semanticRole('guidance')).toBeUndefined();
    expect(semanticRole(undefined)).toBeUndefined();
    expect(semanticRole('constructor')).toBeUndefined();
  });

  it('covers every canonical block type with at least one component', () => {
    const covered = new Set<string>();
    for (const capability of Object.values(COMPONENT_CAPABILITIES))
      for (const blockType of capability.accepts) covered.add(blockType);
    for (const blockType of [
      'heading',
      'paragraph',
      'list',
      'quote',
      'code',
      'math',
      'table',
      'media',
      'diagram',
      'callout',
      'chart',
    ])
      expect(covered.has(blockType)).toBe(true);
  });
});
