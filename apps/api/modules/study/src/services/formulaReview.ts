import katex from 'katex';
import { CourseRevision } from '../models';
import { FormulaProposal } from '../models/FormulaProposal';
import { canManageCourse } from './resourceAccess';
import { findEditableDraft } from './courseDraft';
import { verifyBlob, type SourceDocument } from './revisionSources';

export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

export function validateCorrection(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 8000 ||
    /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) ||
    /\\(?:html\w*|href|url|includegraphics|input|write|def|gdef|edef|newcommand|renewcommand)\b/i.test(
      value
    )
  )
    fail(422, 'INVALID_LATEX');
  // Same KaTeX safety/compatibility rules as the trusted reader. Syntax is not proof of accuracy.
  try {
    katex.renderToString(value, {
      displayMode: true,
      throwOnError: true,
      strict: 'error',
      trust: false,
      maxExpand: 50,
      output: 'htmlAndMathml'
    });
  } catch {
    fail(422, 'INVALID_LATEX');
  }
  return value;
}

export async function reviewContext(
  actor: string | undefined,
  courseId: string,
  tag: string,
  proposalId: string
) {
  if (!actor) fail(401, 'UNAUTHENTICATED');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      proposalId
    ) ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tag)
  )
    fail(422, 'INVALID_REQUEST');
  if (!(await canManageCourse(actor, courseId))) fail(403, 'FORBIDDEN');
  const draft = await findEditableDraft(courseId);
  if (!draft || draft.revisionTag !== tag || draft.revokedAt) fail(409, 'DRAFT_CHANGED');
  const proposal = await FormulaProposal.findOne({
    id: proposalId,
    courseId,
    revisionId: draft.id,
    revisionTag: tag
  }).lean();
  if (!proposal || Array.isArray(proposal)) fail(404, 'NOT_FOUND');
  if (proposal.draftVersion !== draft.__v) fail(409, 'DRAFT_CHANGED');
  const doc = draft.sourceManifest?.find((d) => d.documentId === proposal.documentId);
  if (
    !doc ||
    doc.contentHash !== proposal.documentHash ||
    !doc.storageRef ||
    doc.mediaType !== 'application/pdf'
  )
    fail(409, 'SOURCE_CHANGED');
  await verifyBlob(doc as SourceDocument);
  return { draft, proposal };
}

export async function ensureSnapshot(actor: string, draft: any) {
  if (
    !(await canManageCourse(actor, String(draft.courseId))) ||
    String((await findEditableDraft(String(draft.courseId)))?.id) !== String(draft.id) ||
    !(await CourseRevision.exists({
      id: draft.id,
      revisionTag: draft.revisionTag,
      __v: draft.__v,
      status: 'draft',
      revokedAt: { $exists: false }
    }))
  )
    fail(409, 'DRAFT_CHANGED');
}
