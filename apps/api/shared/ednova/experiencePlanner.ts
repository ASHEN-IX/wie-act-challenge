/** Trusted experience-planner boundary.
 *
 * A planner proposes a configuration for an allowlisted renderer. It never
 * produces JSX, HTML, JavaScript, CSS, or an executable expression. The
 * canonical lesson remains in ReadingDocumentV2.canonical. */

import type { ReadingDocumentV2 } from './learningDocumentV2';

export const EXPERIENCE_PLAN_VERSION = '1.0.0' as const;

export const TRUSTED_COMPONENTS = [
  'explanation',
  'worked_example',
  'comparison_table',
  'bar_chart',
  'line_chart',
  'diagram_walkthrough',
  'code_walkthrough',
  'source_check',
] as const;

export type TrustedComponent = (typeof TRUSTED_COMPONENTS)[number];

export type PlannerRequest = {
  schemaVersion: typeof EXPERIENCE_PLAN_VERSION;
  courseId: string;
  revisionId: string;
  lesson: {
    topicId: string | null;
    subtopicId: string | null;
    title: string;
  };
  sourceReferences: Array<{
    chunkId: string;
    documentId: string;
    pageNumber: number | null;
    lineStart: number;
    lineEnd: number;
  }>;
  learnerRequest: string;
  availableComponents: TrustedComponent[];
  constraints: {
    maxComponents: number;
    maxDataPoints: number;
    allowMedia: boolean;
    allowCharts: boolean;
    locale: string;
  };
};

export type PlannedComponent =
  | { type: 'explanation'; title: string; text: string; sourceChunkIds: string[] }
  | { type: 'worked_example'; title: string; steps: string[]; sourceChunkIds: string[] }
  | {
      type: 'comparison_table';
      title: string;
      columns: string[];
      rows: string[][];
      sourceChunkIds: string[];
    }
  | {
      type: 'bar_chart' | 'line_chart';
      title: string;
      categories: string[];
      values: number[];
      sourceChunkIds: string[];
    }
  | { type: 'diagram_walkthrough'; title: string; steps: string[]; sourceChunkIds: string[] }
  | {
      type: 'code_walkthrough';
      title: string;
      language: string;
      code: string;
      focus: string[];
      sourceChunkIds: string[];
    }
  | { type: 'source_check'; prompt: string; answerChunkIds: string[]; sourceChunkIds: string[] };

export type PlannedExperience = {
  schemaVersion: '1.0.0';
  planner: 'trusted_component_config';
  components: PlannedComponent[];
  uncertainty: Array<{ message: string; sourceChunkIds: string[] }>;
};

export class ExperiencePlanError extends Error {
  readonly status = 422;
  readonly code = 'INVALID_EXPERIENCE_PLAN';
  constructor(message = 'The generated experience was not valid for trusted components.') {
    super(message);
  }
}

function fail(message?: string): never {
  throw new ExperiencePlanError(message);
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
};
const str = (value: unknown, max: number, min = 1): string => {
  if (typeof value !== 'string' || value.length < min || value.length > max) fail();
  return value;
};
const strs = (value: unknown, maxItems: number, maxLength = 500): string[] => {
  if (!Array.isArray(value) || value.length > maxItems) fail();
  return value.map((item) => str(item, maxLength, 0));
};
const exactKeys = (value: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail();
};

export function validatePlannerRequest(value: unknown): PlannerRequest {
  const v = record(value);
  exactKeys(v, [
    'schemaVersion', 'courseId', 'revisionId', 'lesson', 'sourceReferences',
    'learnerRequest', 'availableComponents', 'constraints',
  ]);
  if (v.schemaVersion !== EXPERIENCE_PLAN_VERSION) fail();
  const lesson = record(v.lesson);
  exactKeys(lesson, ['topicId', 'subtopicId', 'title']);
  const constraints = record(v.constraints);
  exactKeys(constraints, ['maxComponents', 'maxDataPoints', 'allowMedia', 'allowCharts', 'locale']);
  if (
    !Number.isSafeInteger(constraints.maxComponents) ||
    Number(constraints.maxComponents) < 1 ||
    Number(constraints.maxComponents) > 8 ||
    !Number.isSafeInteger(constraints.maxDataPoints) ||
    Number(constraints.maxDataPoints) < 1 ||
    Number(constraints.maxDataPoints) > 30 ||
    typeof constraints.allowMedia !== 'boolean' ||
    typeof constraints.allowCharts !== 'boolean'
  ) fail();
  if (!Array.isArray(v.sourceReferences) || v.sourceReferences.length > 32) fail();
  const sourceReferences = v.sourceReferences.map((entry) => {
    const ref = record(entry);
    exactKeys(ref, ['chunkId', 'documentId', 'pageNumber', 'lineStart', 'lineEnd']);
    if (ref.pageNumber !== null && (!Number.isSafeInteger(ref.pageNumber) || Number(ref.pageNumber) < 1)) fail();
    if (!Number.isSafeInteger(ref.lineStart) || !Number.isSafeInteger(ref.lineEnd) || Number(ref.lineStart) < 1 || Number(ref.lineEnd) < Number(ref.lineStart)) fail();
    return { chunkId: str(ref.chunkId, 128), documentId: str(ref.documentId, 128), pageNumber: ref.pageNumber as number | null, lineStart: ref.lineStart as number, lineEnd: ref.lineEnd as number };
  });
  if (!Array.isArray(v.availableComponents)) fail();
  const availableComponents = v.availableComponents.map((item) => {
    if (!TRUSTED_COMPONENTS.includes(item as TrustedComponent)) fail();
    return item as TrustedComponent;
  });
  return {
    schemaVersion: EXPERIENCE_PLAN_VERSION,
    courseId: str(v.courseId, 24),
    revisionId: str(v.revisionId, 128),
    lesson: {
      topicId: lesson.topicId === null ? null : str(lesson.topicId, 128),
      subtopicId: lesson.subtopicId === null ? null : str(lesson.subtopicId, 128),
      title: str(lesson.title, 500),
    },
    sourceReferences,
    learnerRequest: str(v.learnerRequest, 2000),
    availableComponents,
    constraints: {
      maxComponents: constraints.maxComponents as number,
      maxDataPoints: constraints.maxDataPoints as number,
      allowMedia: constraints.allowMedia as boolean,
      allowCharts: constraints.allowCharts as boolean,
      locale: str(constraints.locale, 24),
    },
  };
}

export function validatePlannedExperience(
  value: unknown,
  request: PlannerRequest,
  document: ReadingDocumentV2,
): PlannedExperience {
  const v = record(value);
  exactKeys(v, ['schemaVersion', 'planner', 'components', 'uncertainty']);
  if (v.schemaVersion !== EXPERIENCE_PLAN_VERSION || v.planner !== 'trusted_component_config') fail();
  if (!Array.isArray(v.components) || !v.components.length || v.components.length > request.constraints.maxComponents) fail();
  const evidence = new Map(
    document.canonical.mappings.map((mapping) => [mapping.chunkId, mapping]),
  );
  const requested = new Set(request.sourceReferences.map((ref) => ref.chunkId));
  const allowed = (ids: string[]) => {
    if (!ids.length || ids.some((id) => !evidence.has(id) || !requested.has(id))) fail('A component referenced unavailable source material.');
    return [...new Set(ids)];
  };
  const components = v.components.map((entry): PlannedComponent => {
    const component = record(entry);
    const type = component.type;
    if (!TRUSTED_COMPONENTS.includes(type as TrustedComponent)) fail('Unknown component.');
    if (!request.availableComponents.includes(type as TrustedComponent)) fail('Component unavailable for this lesson.');
    switch (type) {
      case 'explanation':
        exactKeys(component, ['type', 'title', 'text', 'sourceChunkIds']);
        return { type, title: str(component.title, 300), text: str(component.text, 4000), sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      case 'worked_example':
        exactKeys(component, ['type', 'title', 'steps', 'sourceChunkIds']);
        return { type, title: str(component.title, 300), steps: strs(component.steps, 12, 1200), sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      case 'comparison_table': {
        exactKeys(component, ['type', 'title', 'columns', 'rows', 'sourceChunkIds']);
        const columns = strs(component.columns, 8, 200);
        if (!Array.isArray(component.rows) || component.rows.length > 20) fail();
        const rows = component.rows.map((row) => {
          const cells = strs(row, 8, 1000);
          if (cells.length !== columns.length) fail();
          return cells;
        });
        return { type, title: str(component.title, 300), columns, rows, sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      }
      case 'bar_chart':
      case 'line_chart': {
        if (!request.constraints.allowCharts) fail('Charts are disabled for this lesson.');
        exactKeys(component, ['type', 'title', 'categories', 'values', 'sourceChunkIds']);
        const categories = strs(component.categories, request.constraints.maxDataPoints, 120);
        if (!Array.isArray(component.values) || component.values.length !== categories.length) fail();
        const values = component.values.map((number) => {
          if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > 1e12) fail();
          return number;
        });
        return { type, title: str(component.title, 300), categories, values, sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      }
      case 'diagram_walkthrough':
        exactKeys(component, ['type', 'title', 'steps', 'sourceChunkIds']);
        return { type, title: str(component.title, 300), steps: strs(component.steps, 12, 1200), sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      case 'code_walkthrough':
        exactKeys(component, ['type', 'title', 'language', 'code', 'focus', 'sourceChunkIds']);
        return { type, title: str(component.title, 300), language: str(component.language, 24), code: str(component.code, 20000), focus: strs(component.focus, 10, 500), sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      case 'source_check':
        exactKeys(component, ['type', 'prompt', 'answerChunkIds', 'sourceChunkIds']);
        return { type, prompt: str(component.prompt, 1200), answerChunkIds: allowed(strs(component.answerChunkIds, 8, 128)), sourceChunkIds: allowed(strs(component.sourceChunkIds, 8, 128)) };
      default:
        return fail();
    }
  });
  if (!Array.isArray(v.uncertainty) || v.uncertainty.length > 8) fail();
  const uncertainty = v.uncertainty.map((entry) => {
    const item = record(entry);
    exactKeys(item, ['message', 'sourceChunkIds']);
    return { message: str(item.message, 1000), sourceChunkIds: allowed(strs(item.sourceChunkIds, 8, 128)) };
  });
  return { schemaVersion: EXPERIENCE_PLAN_VERSION, planner: 'trusted_component_config', components, uncertainty };
}
