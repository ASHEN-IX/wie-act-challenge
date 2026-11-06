/** Strict browser-boundary parser for a published experience plan (M4.1).
 *
 * The server only ever sends a plan that passed the full validator. This parser
 * exists anyway, for the same reason `parsePublishedPresentation` does: the
 * browser must not trust a response just because it arrived over HTTP. A plan
 * with an unknown version, an unknown component, a duplicated block or a
 * reordered canonical sequence is a projection failure, not a partial render.
 *
 * Parsing here does NOT re-establish authorization. It proves the payload is
 * internally consistent and within the contract; the server already proved it
 * was safe.
 */

import { COMPONENT_TYPES, type ComponentType } from './componentRegistry';
import { EXPERIENCE_PLAN_LIMITS, PLACEMENT_GROUPS, DISCLOSURE_MODES } from './experiencePlan';

export const PUBLISHED_EXPERIENCE_PLAN_VERSION = '1.0.0' as const;

export type PublishedPlacement = {
  placementId: string;
  blockId: string;
  blockType: string;
  component: ComponentType;
  componentVersion: string;
  group: string;
  disclosure: string;
  interaction?: Record<string, string | number | boolean>;
  fallback: ComponentType;
  assetId?: string;
};

export type PublishedExperiencePlanV1 = {
  schemaVersion: typeof PUBLISHED_EXPERIENCE_PLAN_VERSION;
  planId: string;
  courseId: string;
  revisionId: string;
  contentHash: string;
  lessonId: string;
  mode: string;
  registryVersion: string;
  contextFingerprint: string;
  planner: { implementation: string; version: string };
  digest: string;
  canonical: PublishedPlacement[];
  supplemental: PublishedPlacement[];
  disclosure: string;
};

function fail(): never {
  throw new Error('INVALID_EXPERIENCE_PLAN');
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const exact = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key))) fail();
  return value;
};

const str = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || !value || value.length > max) fail();
  return value;
};

const list = <T>(value: unknown, check: (v: unknown) => T, max: number): T[] => {
  if (!Array.isArray(value) || value.length > max) fail();
  return value.map(check);
};

const component = (value: unknown): ComponentType => {
  if (!COMPONENT_TYPES.includes(value as ComponentType)) fail();
  return value as ComponentType;
};

function placement(value: unknown, kind: 'canonical' | 'supplemental'): PublishedPlacement {
  const keys = [
    'placementId',
    'blockId',
    'blockType',
    'component',
    'componentVersion',
    'group',
    'disclosure',
    'interaction',
    'fallback',
    ...(kind === 'supplemental' ? ['assetId'] : []),
  ];
  const v = exact(value, keys);
  if (!(PLACEMENT_GROUPS as readonly unknown[]).includes(v.group)) fail();
  if (!(DISCLOSURE_MODES as readonly unknown[]).includes(v.disclosure)) fail();
  if (kind === 'supplemental' && v.assetId === undefined) fail();

  let interaction: Record<string, string | number | boolean> | undefined;
  if (v.interaction !== undefined) {
    if (!isRecord(v.interaction)) fail();
    const entries = Object.entries(v.interaction);
    if (entries.length > EXPERIENCE_PLAN_LIMITS.maxInteractionEntries) fail();
    interaction = {};
    for (const [key, entry] of entries) {
      if (!/^[a-z][a-zA-Z0-9_]{0,39}$/.test(key)) fail();
      if (
        typeof entry !== 'string' &&
        typeof entry !== 'boolean' &&
        !(typeof entry === 'number' && Number.isFinite(entry))
      )
        fail();
      interaction[key] = entry as string | number | boolean;
    }
  }

  return {
    placementId: str(v.placementId, 128),
    blockId: str(v.blockId, 128),
    blockType: str(v.blockType, 32),
    component: component(v.component),
    componentVersion: str(v.componentVersion, 32),
    group: v.group as string,
    disclosure: v.disclosure as string,
    ...(interaction ? { interaction } : {}),
    fallback: component(v.fallback),
    ...(kind === 'supplemental' ? { assetId: str(v.assetId, 128) } : {}),
  };
}

/**
 * Parse a published plan and check it against the lesson's canonical block
 * order, which the caller supplies from the presentation it already trusts.
 *
 * That positional check is the browser-side half of the coverage guarantee: a
 * plan cannot omit, duplicate or reorder a block without failing here.
 */
export function parsePublishedExperiencePlan(
  value: unknown,
  canonicalBlockIds: readonly string[],
): PublishedExperiencePlanV1 {
  const v = exact(value, [
    'schemaVersion',
    'planId',
    'courseId',
    'revisionId',
    'contentHash',
    'lessonId',
    'mode',
    'registryVersion',
    'contextFingerprint',
    'planner',
    'digest',
    'canonical',
    'supplemental',
    'disclosure',
  ]);
  if (v.schemaVersion !== PUBLISHED_EXPERIENCE_PLAN_VERSION) fail();

  const planner = exact(v.planner, ['implementation', 'version']);
  const canonical = list(
    v.canonical,
    (entry) => placement(entry, 'canonical'),
    EXPERIENCE_PLAN_LIMITS.maxPlacements,
  );
  const supplemental = list(
    v.supplemental,
    (entry) => placement(entry, 'supplemental'),
    EXPERIENCE_PLAN_LIMITS.maxSupplemental,
  );

  if (canonical.length !== canonicalBlockIds.length) fail();
  canonical.forEach((entry, index) => {
    if (entry.blockId !== canonicalBlockIds[index]) fail();
  });

  const ids = new Set<string>();
  for (const entry of [...canonical, ...supplemental]) {
    if (ids.has(entry.placementId)) fail();
    ids.add(entry.placementId);
  }

  return {
    schemaVersion: PUBLISHED_EXPERIENCE_PLAN_VERSION,
    planId: str(v.planId, 128),
    courseId: str(v.courseId, 64),
    revisionId: str(v.revisionId, 128),
    contentHash: str(v.contentHash, 71),
    lessonId: str(v.lessonId, 128),
    mode: str(v.mode, 32),
    registryVersion: str(v.registryVersion, 32),
    contextFingerprint: str(v.contextFingerprint, 71),
    planner: {
      implementation: str(planner.implementation, 64),
      version: str(planner.version, 32),
    },
    digest: str(v.digest, 71),
    canonical,
    supplemental,
    disclosure: str(v.disclosure, 500),
  };
}
