/** ED-26 review candidate. Pure JSON validation, never an authorization grant.
 * Existing AI envelopes/room receipts remain on their existing wire versions. */
import { BLOOM_LEVELS } from '../bloom/taxonomy';

type Check<T> = (value: unknown) => T;
type Output<C> = C extends Check<infer T> ? T : never;
const fail = (): never => {
  throw new Error('INVALID_CONTRACT');
};
const text =
  (max = 128, pattern?: RegExp): Check<string> =>
  (value) => {
    if (
      typeof value !== 'string' ||
      !value.length ||
      Array.from(value).length > max ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value) ||
      (pattern && !pattern.test(value))
    )
      return fail();
    return value;
  };
const number =
  (min: number, max: number, integer = true): Check<number> =>
  (value) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isSafeInteger(value))
      ? value
      : fail();
const boolean: Check<boolean> = (value) => (typeof value === 'boolean' ? value : fail());
const enumeration =
  <T extends string>(...values: T[]): Check<T> =>
  (value) =>
    typeof value === 'string' && values.includes(value as T) ? (value as T) : fail();
const nullable =
  <T>(check: Check<T>): Check<T | null> =>
  (value) =>
    value === null ? null : check(value);
const list =
  <T>(check: Check<T>, min: number, max: number): Check<T[]> =>
  (value) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) return fail();
    return value.map(check);
  };
const object =
  <S extends Record<string, Check<unknown>>>(shape: S): Check<{ [K in keyof S]: Output<S[K]> }> =>
  (value) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      return fail();
    const data = value as Record<string, unknown>;
    if (
      Object.keys(data).length !== Object.keys(shape).length ||
      Object.keys(data).some((k) => !Object.hasOwn(shape, k))
    )
      return fail();
    return Object.fromEntries(Object.entries(shape).map(([k, check]) => [k, check(data[k])])) as {
      [K in keyof S]: Output<S[K]>;
    };
  };
const unique = <T>(items: T[], key: (value: T) => unknown): T[] => {
  if (new Set(items.map(key)).size !== items.length) return fail();
  return items;
};
const refine =
  <T>(check: Check<T>, predicate: (value: T) => boolean): Check<T> =>
  (value) => {
    const parsed = check(value);
    return predicate(parsed) ? parsed : fail();
  };
const union =
  <A, B>(a: Check<A>, b: Check<B>): Check<A | B> =>
  (value) => {
    try {
      return a(value);
    } catch {
      return b(value);
    }
  };
const version = enumeration('1.0.0');
const id = text(128, /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const courseId = text(36, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const uuid = text(36, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const hash = text(71, /^sha256:[a-f0-9]{64}$/);
const time = refine(
  text(24, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/),
  (v) => {
    const date = new Date(v);
    return !v.startsWith('0000-') && Number.isFinite(date.getTime()) && date.toISOString() === v;
  }
);
const phase = enumeration('idle', 'peer_discussion', 'individual_attempt', 'debrief');
const bloom = enumeration(...BLOOM_LEVELS);
const pin = object({ courseId, revisionId: id, contentHash: hash });
const source = object({
  documentId: id,
  pageNumber: nullable(number(1, 100000)),
  contentHash: hash,
  provenance: enumeration('extracted', 'manual', 'ai_generated'),
  locationKnown: boolean
});
const sourceRef = refine(source, (v) => v.locationKnown === (v.pageNumber !== null));
const sources = refine(
  list(sourceRef, 1, 32),
  (v) => unique(v, (r) => `${r.documentId}:${r.pageNumber}`).length === v.length
);
const vectorIndexRef = text(
  280,
  /^faiss\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.faiss$/i
);
const objective = object({ objectiveId: id, statement: text(2000), bloomLevel: bloom });
const topic = union(
  object({ topicId: id, title: text(200), objectives: list(objective, 1, 50) }),
  object({
    topicId: id,
    title: text(200),
    objectives: list(objective, 1, 50),
    description: refine(text(2000), (value) => value.length > 0)
  })
);
const published = object({
  schemaVersion: version,
  visibility: enumeration('authorized_learner'),
  courseId,
  revisionId: id,
  contentHash: hash,
  title: text(200),
  isPublished: refine(boolean, (v) => v === true),
  sources,
  publishedAt: time,
  authorizedDocumentIds: refine(list(id, 1, 32), (v) => unique(v, (x) => x).length === v.length),
  topics: list(topic, 1, 50)
});
const failure = enumeration(
  'UNAUTHORIZED',
  'UNPUBLISHED',
  'UNAVAILABLE',
  'REVOKED',
  'STALE_REVISION',
  'UNSUPPORTED_VERSION'
);
const access = union(
  object({
    schemaVersion: version,
    decision: enumeration('allowed'),
    userId: id,
    pin,
    grant: enumeration('personal_owner', 'active_enrollment', 'assigned_instructor'),
    checkedAt: time
  }),
  object({
    schemaVersion: version,
    decision: enumeration('denied'),
    code: failure,
    retryable: boolean
  })
);
const resolution = object({
  schemaVersion: version,
  visibility: enumeration('server_only'),
  pin,
  access,
  sources,
  vectorIndexRef
});
const grounding = object({
  schemaVersion: version,
  visibility: enumeration('service_only'),
  pin,
  sources,
  excerpts: list(object({ documentId: id, text: text(8000) }), 1, 32)
});
const editor = object({
  schemaVersion: version,
  visibility: enumeration('editor_only'),
  courseId,
  revisionId: id,
  contentHash: hash,
  status: enumeration('draft', 'published', 'deprecated'),
  reviewStatus: enumeration('unreviewed', 'reviewed'),
  sources
});
const baseActivity = {
  schemaVersion: version,
  activityId: id,
  activityRevision: id,
  componentVersion: version,
  courseId,
  revisionId: id,
  contentHash: hash,
  objectiveId: id,
  title: text(200),
  instructions: text(4000),
  timeLimitSeconds: nullable(number(1, 86400)),
  visibility: enumeration('public'),
  language: text(35, /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  sourceRefs: sources,
  constraints: object({ maxAttempts: number(1, 20), allowCalculator: boolean })
};
const options = refine(
  list(object({ id, label: text(1000) }), 2, 20),
  (v) => unique(v, (x) => x.id).length === v.length
);
const quiz = object({
  ...baseActivity,
  activityType: enumeration('InteractiveQuiz'),
  presentationData: object({ question: text(4000), options, isMultiSelect: boolean })
});
const steps = refine(
  list(object({ stepId: id, prompt: text(4000) }), 1, 20),
  (v) => unique(v, (x) => x.stepId).length === v.length
);
const problem = object({
  ...baseActivity,
  activityType: enumeration('GuidedProblem'),
  presentationData: object({ problem: text(8000), steps })
});
const activity = union(quiz, problem);
const activityRef = object({
  activityId: id,
  activityRevision: id,
  activityType: enumeration('InteractiveQuiz', 'GuidedProblem'),
  courseId,
  revisionId: id,
  contentHash: hash
});
const evaluation = object({
  schemaVersion: version,
  visibility: enumeration('server_only'),
  activity: activityRef,
  evaluationRef: id,
  evaluatorType: enumeration('deterministic_rubric', 'llm_evaluation'),
  rubricVersion: id,
  rubric: text(16000),
  answerKey: list(text(4000), 1, 20)
});
const answers = union(
  object({
    selectedOptionIds: refine(list(id, 1, 20), (v) => unique(v, (x) => x).length === v.length)
  }),
  object({
    steps: refine(
      list(object({ stepId: id, answer: text(8000) }), 1, 20),
      (v) => unique(v, (x) => x.stepId).length === v.length
    )
  })
);
const submission = object({
  schemaVersion: version,
  attemptId: uuid,
  activity: activityRef,
  roomId: nullable(id),
  timeSpentSeconds: number(0, 86400),
  answers
});
const privateAttempt = object({
  schemaVersion: version,
  visibility: enumeration('recipient_only'),
  userId: id,
  submission,
  status: enumeration('in_progress', 'submitted', 'graded'),
  submittedAt: time,
  payloadHash: hash
});
const graded = object({
  schemaVersion: version,
  visibility: enumeration('recipient_only'),
  userId: id,
  attemptId: uuid,
  activity: activityRef,
  status: enumeration('graded'),
  score: number(0, 1, false),
  isCorrect: boolean,
  feedback: text(8000),
  socraticHint: nullable(text(8000)),
  recommendedNextStep: nullable(
    object({ type: enumeration('advance'), nextObjectiveId: id, title: text(200) })
  ),
  bloomLevelDemonstrated: bloom,
  evidenceId: nullable(id),
  evaluatedAt: time
});
const unresolved = object({
  schemaVersion: version,
  visibility: enumeration('recipient_only'),
  userId: id,
  attemptId: uuid,
  activity: activityRef,
  status: enumeration('pending', 'rejected', 'failed', 'unavailable'),
  code: enumeration(
    'PENDING',
    'INVALID_SUBMISSION',
    'STALE_REVISION',
    'REVOKED',
    'UNSUPPORTED_VERSION',
    'UNAVAILABLE',
    'EVALUATION_FAILED',
    'UNCERTAIN'
  ),
  retryable: boolean
});
const result = union(graded, unresolved);
const evidence = object({
  schemaVersion: version,
  evidenceVersion: version,
  evidenceId: id,
  visibility: enumeration('server_only'),
  userId: id,
  attemptId: uuid,
  activity: activityRef,
  objectiveId: id,
  status: enumeration('accepted'),
  bloomLevel: bloom,
  score: number(0, 1, false),
  masteryAchieved: boolean,
  evaluator: object({
    type: enumeration('deterministic_rubric', 'llm_evaluation'),
    model: nullable(id),
    validationVersion: id,
    executionMode: enumeration('REAL_APPROVED', 'MOCK_TEST', 'DETERMINISTIC_FALLBACK')
  }),
  timestamp: time
});
const evidenceDecision = union(
  object({ schemaVersion: version, status: enumeration('accepted'), evidence }),
  object({
    schemaVersion: version,
    status: enumeration('rejected', 'unavailable'),
    attemptId: uuid,
    code: enumeration('UNVALIDATED', 'UNCERTAIN', 'REVOKED', 'STALE_REVISION', 'UNAVAILABLE'),
    retryable: boolean
  })
);
const completion = object({
  schemaVersion: version,
  visibility: enumeration('public'),
  completionId: id,
  roomId: id,
  activity: activityRef,
  publicSubmissionsCount: number(0, 10)
});
const reward = object({
  schemaVersion: version,
  visibility: enumeration('server_only'),
  userId: id,
  evidenceId: id,
  completionId: nullable(id),
  rewardCandidateId: id,
  policyVersion: id,
  eventKey: text(512),
  finalAwardId: nullable(id)
});
const member = object({
  userId: id,
  name: text(200),
  role: enumeration('host', 'participant'),
  isOnline: boolean,
  isSpeaking: boolean,
  hasSubmitted: boolean
});
const room = object({
  schemaVersion: version,
  type: enumeration('ROOM_ACTIVITY_STATE'),
  roomId: id,
  seq: number(1, Number.MAX_SAFE_INTEGER),
  presenterUserId: id,
  currentPhase: phase,
  pin: nullable(pin),
  activity: nullable(activityRef),
  publicSubmissionsCount: number(0, 10),
  participants: list(member, 1, 10)
});
const selectActivity = object({
  schemaVersion: version,
  commandId: uuid,
  expectedSeq: number(1, Number.MAX_SAFE_INTEGER),
  roomId: id,
  action: enumeration('DISPLAY_ACTIVITY'),
  activity: activityRef
});
const facilitatorContext = object({
  schemaVersion: version,
  visibility: enumeration('service_only'),
  roomId: id,
  seq: number(1, Number.MAX_SAFE_INTEGER),
  pin: nullable(pin),
  activity: nullable(activityRef),
  currentPhase: phase,
  publicSubmissionsCount: number(0, 10),
  recentDialogue: list(object({ speaker: text(200), text: text(2000) }), 0, 20)
});
const proposal = object({
  schemaVersion: version,
  status: enumeration('proposed'),
  interventionId: id,
  roomId: id,
  expectedSeq: number(1, Number.MAX_SAFE_INTEGER),
  pin: nullable(pin),
  strategy: enumeration(
    'PEER_CHALLENGE',
    'SOCRATIC_NUDGE',
    'CONCEPT_PROMPT',
    'INCLUSIVE_INVITATION',
    'CONSENSUS_CHECK',
    'DISAGREEMENT_RESOLUTION'
  ),
  messageText: text(2000),
  proposedUICommand: nullable(
    object({ action: enumeration('DISPLAY_ACTIVITY'), activity: activityRef })
  ),
  cooldownSeconds: number(0, 300)
});
const proposalDecision = union(
  object({
    schemaVersion: version,
    interventionId: id,
    roomId: id,
    status: enumeration('validated'),
    expectedSeq: number(1, Number.MAX_SAFE_INTEGER)
  }),
  union(
    object({
      schemaVersion: version,
      interventionId: id,
      roomId: id,
      status: enumeration('accepted'),
      commandId: uuid,
      seq: number(1, Number.MAX_SAFE_INTEGER)
    }),
    union(
      object({
        schemaVersion: version,
        interventionId: nullable(id),
        roomId: id,
        status: enumeration('rejected'),
        code: enumeration('UNAUTHORIZED', 'UNPUBLISHED', 'REVOKED', 'UNSUPPORTED_VERSION')
      }),
      union(
        object({
          schemaVersion: version,
          interventionId: nullable(id),
          roomId: id,
          status: enumeration('stale'),
          code: enumeration('STALE_REVISION')
        }),
        object({
          schemaVersion: version,
          interventionId: nullable(id),
          roomId: id,
          status: enumeration('unavailable'),
          code: enumeration('UNAVAILABLE')
        })
      )
    )
  )
);
const helpRequest = object({
  schemaVersion: version,
  requestId: uuid,
  activity: activityRef,
  roomId: nullable(id),
  userQuestion: text(4000)
});
const help = object({
  schemaVersion: version,
  visibility: enumeration('recipient_only'),
  userId: id,
  requestId: uuid,
  activity: activityRef,
  status: enumeration('available', 'unavailable'),
  tutorResponse: nullable(text(8000))
});

/** One shared set; no routes or persistence are created by these definitions. */
export const contracts = {
  PublishedContext: published,
  AccessDecision: access,
  SourceResolution: resolution,
  GroundingContext: grounding,
  EditorContext: editor,
  ActivityDefinition: activity,
  ServerEvaluationDefinition: evaluation,
  AttemptSubmission: submission,
  PrivateAttempt: privateAttempt,
  AssessmentResult: result,
  AcceptedEvidence: evidence,
  EvidenceDecision: evidenceDecision,
  PublicCompletion: completion,
  RewardReference: reward,
  RoomActivityState: room,
  SelectActivityCommand: selectActivity,
  FacilitatorContext: facilitatorContext,
  FacilitatorProposal: proposal,
  ProposalDecision: proposalDecision,
  PrivateHelpRequest: helpRequest,
  PrivateHelp: help
} as const;
export type ContractName = keyof typeof contracts;
export type Contract<N extends ContractName> = Output<(typeof contracts)[N]>;
export type ActivityDefinition = Contract<'ActivityDefinition'>;
export type AttemptSubmission = Contract<'AttemptSubmission'>;
export type SourcePin = Output<typeof pin>;
export class ContractError extends Error {
  readonly code = 'INVALID_CONTRACT';
  constructor() {
    super('Unsupported or invalid contract');
  }
}
const samePin = (a: SourcePin, b: SourcePin) =>
  a.courseId === b.courseId && a.revisionId === b.revisionId && a.contentHash === b.contentHash;
function invariants(name: ContractName, value: Record<string, unknown>) {
  const v = value;
  if (v.pin && v.activity && !samePin(v.pin as SourcePin, v.activity as SourcePin)) fail();
  if (name === 'PublishedContext') {
    const c = v as Contract<'PublishedContext'>;
    if (c.sources.some((s) => !c.authorizedDocumentIds.includes(s.documentId))) fail();
  }
  if (name === 'AssessmentResult' && v.status !== 'graded') {
    const codes: Record<string, string[]> = {
      pending: ['PENDING'],
      unavailable: ['UNAVAILABLE', 'UNCERTAIN'],
      failed: ['EVALUATION_FAILED'],
      rejected: ['INVALID_SUBMISSION', 'STALE_REVISION', 'REVOKED', 'UNSUPPORTED_VERSION']
    };
    if (!codes[String(v.status)]?.includes(String(v.code))) fail();
  }
  if (name === 'SourceResolution') {
    const r = v as Contract<'SourceResolution'>;
    if (
      r.access.decision !== 'allowed' ||
      !samePin(r.pin, r.access.pin) ||
      r.vectorIndexRef !== `faiss/${r.pin.courseId}/${r.pin.revisionId}.faiss`
    )
      fail();
  }
  if (name === 'GroundingContext') {
    const r = v as Contract<'GroundingContext'>;
    if (r.excerpts.some((x) => !r.sources.some((s) => s.documentId === x.documentId))) fail();
  }
  if (name === 'EditorContext' && v.status !== 'draft' && v.reviewStatus !== 'reviewed') fail();
  if (name === 'RoomActivityState') {
    const r = v as Contract<'RoomActivityState'>;
    unique(r.participants, (p) => p.userId);
    if (
      !r.participants.some((p) => p.userId === r.presenterUserId) ||
      r.publicSubmissionsCount > r.participants.length ||
      (r.activity !== null && r.pin === null)
    )
      fail();
  }
  if (name === 'FacilitatorContext' && v.activity && !v.pin) fail();
  if (name === 'FacilitatorProposal') {
    const r = v as Contract<'FacilitatorProposal'>;
    if (r.proposedUICommand && (r.pin === null || !samePin(r.pin, r.proposedUICommand.activity)))
      fail();
  }
  if (name === 'PrivateHelp' && (v.status === 'available') !== (v.tutorResponse !== null)) fail();
  if (name === 'RewardReference' && v.eventKey !== `xp:${v.userId}:${v.evidenceId}`) fail();
  if (name === 'AcceptedEvidence') {
    const r = v as Contract<'AcceptedEvidence'>;
    if (
      r.evaluator.type === 'llm_evaluation' &&
      (!r.evaluator.model || r.evaluator.executionMode !== 'REAL_APPROVED')
    )
      fail();
  }
  // Nested contracts need their relational invariants too.
  if (name === 'PrivateAttempt') parseContract('AttemptSubmission', v.submission);
  if (name === 'EvidenceDecision' && v.status === 'accepted')
    parseContract('AcceptedEvidence', v.evidence);
  if (name === 'AttemptSubmission') {
    const r = v as AttemptSubmission;
    if ((r.activity.activityType === 'InteractiveQuiz') !== 'selectedOptionIds' in r.answers)
      fail();
  }
}
/** Reject unknown fields rather than stripping them. Never echo rejected payloads. */
export function parseContract<N extends ContractName>(name: N, input: unknown): Contract<N> {
  try {
    const encoded = JSON.stringify(input);
    if (!encoded || new TextEncoder().encode(encoded).length > 65536) fail();
    const parsed = contracts[name](input) as Contract<N>;
    invariants(name, parsed as Record<string, unknown>);
    return parsed;
  } catch {
    throw new ContractError();
  }
}
export function validateActivityContext(input: unknown, contextInput: unknown): ActivityDefinition {
  const a = parseContract('ActivityDefinition', input);
  const c = parseContract('PublishedContext', contextInput);
  if (
    !samePin(a, c) ||
    a.sourceRefs.some(
      (s) =>
        !c.authorizedDocumentIds.includes(s.documentId) ||
        !c.sources.some(
          (ref) => ref.documentId === s.documentId && ref.contentHash === s.contentHash
        )
    ) ||
    !c.topics.some((t) => t.objectives.some((o) => o.objectiveId === a.objectiveId))
  )
    throw new ContractError();
  return a;
}
export function validateSubmission(input: unknown, definition: unknown): AttemptSubmission {
  const s = parseContract('AttemptSubmission', input),
    a = parseContract('ActivityDefinition', definition);
  if (
    !samePin(s.activity, a) ||
    s.activity.activityId !== a.activityId ||
    s.activity.activityRevision !== a.activityRevision ||
    s.activity.activityType !== a.activityType
  )
    throw new ContractError();
  if (a.activityType === 'InteractiveQuiz' && 'selectedOptionIds' in s.answers) {
    if (
      (!a.presentationData.isMultiSelect && s.answers.selectedOptionIds.length !== 1) ||
      s.answers.selectedOptionIds.some((x) => !a.presentationData.options.some((o) => o.id === x))
    )
      throw new ContractError();
  } else if (a.activityType === 'GuidedProblem' && 'steps' in s.answers) {
    if (
      s.answers.steps.some(
        (x) => !a.presentationData.steps.some((step) => step.stepId === x.stepId)
      )
    )
      throw new ContractError();
  }
  return s;
}
export function parseRecipient<N extends 'PrivateAttempt' | 'AssessmentResult' | 'PrivateHelp'>(
  name: N,
  input: unknown,
  authenticatedUserId: string
): Contract<N> {
  const value = parseContract(name, input);
  if (value.userId !== authenticatedUserId) throw new ContractError();
  return value;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
/** Pure retry classification only. ED-29 must persist actor-scoped receipts. */
export function compareAttempt(
  previous: unknown,
  retry: unknown
): 'identical' | 'conflict' | 'new' {
  const a = parseContract('AttemptSubmission', previous),
    b = parseContract('AttemptSubmission', retry);
  return a.attemptId !== b.attemptId
    ? 'new'
    : canonical(a) === canonical(b)
      ? 'identical'
      : 'conflict';
}
/** Schema/reference compatibility only; presenter/ACL checks still belong to Nest. */
export function validateProposal(
  input: unknown,
  context: unknown
): Contract<'FacilitatorProposal'> {
  const p = parseContract('FacilitatorProposal', input),
    c = parseContract('FacilitatorContext', context);
  const pinsMatch = p.pin === null ? c.pin === null : c.pin !== null && samePin(p.pin, c.pin);
  if (p.roomId !== c.roomId || p.expectedSeq !== c.seq || !pinsMatch) throw new ContractError();
  return p;
}
