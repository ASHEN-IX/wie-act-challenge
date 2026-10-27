/**
 * Course-grounded tutor and verifiable citation service (ED-10 / Contract 03).
 *
 * Enforces:
 * - Code-side access validation before retrieval via resolveCourseSource.
 * - Published revision pinning (courseId, revisionId, contentHash).
 * - Document authorization boundaries against publishedContext.authorizedDocumentIds.
 * - Validation of GroundingContext against Contract 03.
 */

import { CourseRevision } from '../models';
import { verifyRevisionArtifact } from './revisionSources';
import aiClient from '../../../../shared/aiClient';
import { canReadCourse } from './resourceAccess';
import { parseContract } from '../../../../shared/ednova/contracts';
import {
  getPublishedCourseContext,
  resolveCourseSource,
  PublicationForbiddenError,
  UnpublishedCourseError
} from './coursePublication';

export interface TutorAskParams {
  question: string;
  topicId?: string;
  objectiveId?: string;
  revisionId?: string;
}

export interface CitationResult {
  documentId: string;
  pageNumber?: number | null;
  quote?: string;
  verified: boolean;
}

export interface TutorAnswerResponse {
  answer: string;
  hasSufficientEvidence: boolean;
  citationsValid: boolean;
  status: 'verified' | 'tentative' | 'insufficient_evidence';
  pin: {
    courseId: string;
    revisionId: string;
    contentHash: string;
  };
  citations: CitationResult[];
  groundingContext?: Record<string, unknown> | null;
  executionMode: string;
}

export class TutorValidationError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_QUESTION';
  constructor(message = 'Invalid question or query parameters') {
    super(message);
    this.name = 'TutorValidationError';
  }
}

export class TutorServiceUnavailableError extends Error {
  readonly status = 503;
  readonly code = 'AI_SERVICE_UNAVAILABLE';
  constructor(message = 'AI tutor grounding service unavailable') {
    super(message);
    this.name = 'TutorServiceUnavailableError';
  }
}

export async function askGroundedTutor(
  actorUserId: string,
  courseId: string,
  params: TutorAskParams
): Promise<TutorAnswerResponse> {
  if (!params.question || typeof params.question !== 'string' || !params.question.trim()) {
    throw new TutorValidationError('Question cannot be empty');
  }
  if (params.question.length > 4000) {
    throw new TutorValidationError('Question exceeds maximum length of 4000 characters');
  }

  // 1. Authoritative code-side course and publication resolution
  const sourceRes = await resolveCourseSource(actorUserId, courseId, params.revisionId);
  if (sourceRes.access.decision === 'denied') {
    if (sourceRes.access.code === 'UNPUBLISHED') {
      throw new UnpublishedCourseError('Course has no published revision');
    }
    throw new PublicationForbiddenError('Access to course materials denied');
  }

  // 2. Resolve published context and authorized document manifest
  const pubContext = await getPublishedCourseContext(actorUserId, courseId, params.revisionId);
  const authorizedDocumentIds = pubContext.authorizedDocumentIds || [];

  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: pubContext.revisionId
  }).lean();
  if (!revision) throw new TutorServiceUnavailableError();
  const artifact = await verifyRevisionArtifact(revision);
  // 3. Dispatch to AI service for grounded retrieval and verified answer generation
  try {
    const aiRes = await aiClient.post('/api/ai/tutor/ask', {
      courseId,
      revisionId: pubContext.revisionId,
      contentHash: pubContext.contentHash,
      manifestDigest: revision.sourceManifestDigest,
      artifactHash: artifact.artifactHash,
      question: params.question.trim(),
      authorizedDocumentIds,
      topicId: params.topicId,
      objectiveId: params.objectiveId
    });

    if (!(await canReadCourse(actorUserId, courseId)))
      throw new PublicationForbiddenError('Access revoked');
    const raw = aiRes.data;
    // Closed internal transport candidate. No warn-and-continue or object spread
    // into browser output. Evidence identities are checked against local artifacts.
    const keys = [
      'schemaVersion',
      'answer',
      'hasSufficientEvidence',
      'citationsValid',
      'status',
      'pin',
      'citations',
      'groundingContext',
      'retrievedEvidence',
      'executionMode'
    ];
    if (
      !raw ||
      typeof raw !== 'object' ||
      Object.keys(raw).length !== keys.length ||
      Object.keys(raw).some((k) => !keys.includes(k))
    )
      throw new TutorServiceUnavailableError('Invalid tutor response');
    const data = raw as TutorAnswerResponse & {
      schemaVersion: string;
      retrievedEvidence: Array<Record<string, unknown>>;
    };
    if (
      data.schemaVersion !== '1.0.0' ||
      typeof data.answer !== 'string' ||
      data.answer.length > 16000 ||
      typeof data.hasSufficientEvidence !== 'boolean' ||
      typeof data.citationsValid !== 'boolean' ||
      !['verified', 'tentative', 'insufficient_evidence'].includes(data.status) ||
      !['REAL_APPROVED', 'MOCK_TEST', 'DETERMINISTIC_FALLBACK', 'UNAVAILABLE'].includes(
        data.executionMode
      ) ||
      JSON.stringify(data.pin) !==
        JSON.stringify({
          courseId,
          revisionId: pubContext.revisionId,
          contentHash: pubContext.contentHash
        }) ||
      !Array.isArray(data.citations) ||
      !Array.isArray(data.retrievedEvidence)
    )
      throw new TutorServiceUnavailableError('Invalid tutor response');
    if (data.groundingContext) {
      try {
        parseContract('GroundingContext', data.groundingContext);
      } catch {
        throw new TutorServiceUnavailableError('Invalid grounding context');
      }
    }
    const evidence = data.retrievedEvidence;
    const exactKeys = (value: unknown, keys: string[]) =>
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      Object.keys(value).every((k) => keys.includes(k));
    if (
      !exactKeys(data.pin, ['courseId', 'revisionId', 'contentHash']) ||
      evidence.some(
        (e) =>
          !exactKeys(e, [
            'documentId',
            'contentHash',
            'pageNumber',
            'chunkId',
            'textHash',
            'sectionId',
            'text'
          ])
      ) ||
      data.citations.some(
        (c) =>
          !exactKeys(c, ['documentId', 'pageNumber', 'chunkId', 'textHash', 'quote', 'verified']) ||
          typeof c.verified !== 'boolean'
      )
    )
      throw new TutorServiceUnavailableError('Invalid structured evidence');
    if (data.groundingContext) {
      const ctx = data.groundingContext as {
        pin?: unknown;
        sources?: Array<Record<string, unknown>>;
        excerpts?: Array<Record<string, unknown>>;
      };
      if (
        JSON.stringify(ctx.pin) !== JSON.stringify(data.pin) ||
        ctx.sources?.some(
          (ref) =>
            !evidence.some(
              (e) =>
                e.documentId === ref.documentId &&
                e.contentHash === ref.contentHash &&
                e.pageNumber === ref.pageNumber
            )
        ) ||
        ctx.excerpts?.some(
          (ref) => !evidence.some((e) => e.documentId === ref.documentId && e.text === ref.text)
        )
      )
        throw new TutorServiceUnavailableError('Grounding mismatch');
    }
    const markers = [
      ...data.answer.matchAll(/\[doc:([A-Za-z0-9_-]+)(?:, p:(\d+))?, chunk:(chk_[a-f0-9]{64})\]/g)
    ];
    if (
      (data.answer.match(/\[doc:/g) || []).length !== markers.length ||
      markers.some(
        (match) =>
          !evidence.some(
            (e) =>
              e.documentId === match[1] &&
              e.pageNumber === (match[2] ? Number(match[2]) : null) &&
              e.chunkId === match[3]
          )
      )
    )
      throw new TutorServiceUnavailableError('Unsupported answer citation');
    if (
      data.status === 'verified' &&
      (data.executionMode === 'UNAVAILABLE' || markers.length !== data.citations.length)
    )
      throw new TutorServiceUnavailableError('Unverified execution');

    if (
      evidence.some(
        (e) =>
          !artifact.passages.some(
            (p) =>
              p.documentId === e.documentId &&
              p.chunkId === e.chunkId &&
              p.textHash === e.textHash &&
              p.text === e.text &&
              p.contentHash === e.contentHash &&
              p.pageNumber === e.pageNumber &&
              p.sectionId === e.sectionId
          )
      )
    )
      throw new TutorServiceUnavailableError('Foreign retrieved evidence');
    if (
      data.citations.some(
        (c) =>
          !c.verified ||
          !evidence.some(
            (e) =>
              e.documentId === c.documentId &&
              e.pageNumber === c.pageNumber &&
              e.chunkId === (c as unknown as Record<string, unknown>).chunkId &&
              e.textHash === (c as unknown as Record<string, unknown>).textHash &&
              e.text === c.quote
          )
      )
    )
      throw new TutorServiceUnavailableError('Unverified citation');
    if (
      data.status === 'verified' &&
      (!data.citationsValid || !data.hasSufficientEvidence || !data.citations.length)
    )
      throw new TutorServiceUnavailableError('Insufficient verified evidence');

    if (!(await canReadCourse(actorUserId, courseId))) {
      throw new PublicationForbiddenError('Course access revoked before tutor result delivery');
    }
    await getPublishedCourseContext(actorUserId, courseId, pubContext.revisionId);
    await verifyRevisionArtifact(revision);
    return {
      answer: data.answer,
      hasSufficientEvidence: data.hasSufficientEvidence,
      citationsValid: data.citationsValid,
      status: data.status,
      pin: { courseId, revisionId: pubContext.revisionId, contentHash: pubContext.contentHash },
      citations: data.citations.map((c) => ({
        documentId: c.documentId,
        pageNumber: c.pageNumber,
        quote: c.quote,
        verified: c.verified
      })),
      executionMode: data.executionMode
    };
  } catch (err: unknown) {
    const errorObj = err as { response?: { status?: number; data?: unknown }; message?: string };
    if (errorObj?.response?.status === 401 || errorObj?.response?.status === 403) {
      throw new TutorServiceUnavailableError('AI service authentication failed');
    }
    if (errorObj?.response?.status === 503) {
      throw new TutorServiceUnavailableError('AI service currently unavailable');
    }
    if (err instanceof PublicationForbiddenError || err instanceof TutorServiceUnavailableError)
      throw err;
    throw new TutorServiceUnavailableError();
  }
}
