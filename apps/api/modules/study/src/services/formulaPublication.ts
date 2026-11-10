import { CourseRevision } from '../models';
import { FormulaProposal } from '../models/FormulaProposal';
import { parseCanonicalDocument } from '../../../../shared/ednova/canonicalDocument';
import { activityDigest } from './activityIdentity';
import { validateCorrection } from './formulaReview';
import {
  verifyBlob,
  manifestDigest,
  prepareRevisionSources,
  type SourceDocument
} from './revisionSources';
import { findEditableDraft } from './courseDraft';
import { canPublishCourse } from './resourceAccess';
import aiClient from '../../../../shared/aiClient';

const conflict: (message: string) => never = (message) => {
  throw Object.assign(new Error(message), { status: 409, code: 'FORMULA_SNAPSHOT_CHANGED' });
};
/** Freeze a reviewed source snapshot into a new immutable publication identity. */
type MathBlock = {
  type?: unknown;
  regionId?: unknown;
  page?: unknown;
  bbox?: unknown;
  expression?: unknown;
  evidence?: Array<{ documentId?: unknown }>;
  reviewedFormula?: unknown;
};

export async function reviewedPublication(
  actor: string,
  // The publication flow mutates several legacy revision fields that the model type does not yet describe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: any
): Promise<string | null> {
  if (draft.formulaPublication?.sourceDraftId) {
    if (draft.contentDocumentHash !== draft.formulaPublication.projectionHash)
      conflict('Frozen formula publication checksum changed');
    const source = await CourseRevision.findOne({
      id: draft.formulaPublication.sourceDraftId,
      courseId: draft.courseId,
      revisionTag: draft.formulaPublication.sourceTag,
      activationState: 'prepared',
      revokedAt: { $exists: false }
    }).lean();
    if (
      !source ||
      source.__v !== draft.formulaPublication.sourceVersion + 1 ||
      source.formulaPublication?.targetTag !== draft.revisionTag ||
      source.formulaPublication?.projectionHash !== draft.contentDocumentHash ||
      source.contentDocumentHash !== source.formulaPublication?.originalCanonicalHash
    )
      conflict('Frozen source revision changed; publication must be reviewed again');
    return null;
  }
  let receipt = draft.formulaPublication;
  if (!receipt?.targetTag) {
    const proposals = await FormulaProposal.find({
      courseId: draft.courseId,
      revisionId: draft.id,
      revisionTag: draft.revisionTag,
      draftVersion: draft.__v,
      state: { $in: ['accepted', 'corrected'] }
    })
      .sort({ id: 1 })
      .lean();
    if (!proposals.length) return null;
    if (String((await findEditableDraft(String(draft.courseId)))?.id) !== String(draft.id))
      conflict('Only the current draft can publish formula reviews');
    const canonical = parseCanonicalDocument(draft.contentDocument);
    const blocks = canonical.chapters.flatMap((c) =>
      c.lessons.flatMap((l) => l.blocks)
    ) as MathBlock[];
    const used = new Set<string>();
    for (const p of proposals) {
      const last = p.history[p.history.length - 1];
      if (
        !last ||
        last.next !== p.state ||
        last.reviewVersion !== p.reviewVersion ||
        last.draftVersion !== draft.__v ||
        last.revisionTag !== draft.revisionTag ||
        last.revisionId !== String(draft.id)
      )
        conflict('Formula review audit does not match this draft; review again');
      const block = blocks.find(
        (b) =>
          b.type === 'math' &&
          b.regionId === p.regionId &&
          b.evidence?.some((s) => s.documentId === p.documentId)
      );
      const doc = (draft.sourceManifest as SourceDocument[] | undefined)?.find(
        (d) => d.documentId === p.documentId
      );
      if (
        !block ||
        !doc ||
        doc.contentHash !== p.documentHash ||
        block.page !== p.page ||
        JSON.stringify(block.bbox) !== JSON.stringify(p.bbox) ||
        block.expression !== p.sourceText ||
        used.has(p.regionId)
      )
        conflict('Formula source binding changed or conflicts; review this draft again');
      await verifyBlob(doc as SourceDocument);
      const contentHash = 'sha256:' + draft.contentHash.replace(/^sha256:/, '');
      const { data: r } = await aiClient.post('/api/ai/sources/region-inspect', {
        schemaVersion: '1.0.0',
        courseId: String(draft.courseId),
        revisionId: draft.revisionTag,
        contentHash,
        documents: draft.sourceManifest,
        manifestDigest: manifestDigest(
          String(draft.courseId),
          draft.revisionTag,
          contentHash,
          draft.sourceManifest
        ),
        documentId: p.documentId,
        regionId: p.regionId
      });
      if (
        r.documentHash !== p.documentHash ||
        r.cropHash !== p.cropHash ||
        r.regionId !== p.regionId ||
        r.page !== p.page ||
        JSON.stringify(r.bbox) !== JSON.stringify(p.bbox)
      )
        conflict('Formula crop changed; review again before publishing');
      const expression = validateCorrection(
        p.state === 'corrected' ? last.expression : p.reviewedLatex
      );
      if (expression !== p.reviewedLatex || (p.state === 'accepted' && expression !== p.latex))
        conflict('Formula disposition expression mismatch');
      block.reviewedFormula = {
        expression,
        originalModelLatex: p.latex,
        proposalIdentity: p.identity,
        state: p.state,
        reviewer: last.reviewer,
        reviewedAt: new Date(last.at).toISOString(),
        documentHash: p.documentHash,
        cropHash: p.cropHash,
        sourceDraftId: String(draft.id),
        sourceTag: draft.revisionTag,
        sourceVersion: draft.__v
      };
      used.add(p.regionId);
    }
    const projectionHash = activityDigest(canonical);
    const targetTag =
      'rev_formula_' +
      activityDigest([String(draft.id), draft.revisionTag, draft.__v, projectionHash])
        .replace(/^sha256:/, '')
        .slice(0, 32);
    receipt = {
      originalCanonicalHash: draft.contentDocumentHash,
      targetTag,
      canonical,
      projectionHash,
      sourceVersion: draft.__v,
      sourceTag: draft.revisionTag
    };
    if (!(await canPublishCourse(actor, String(draft.courseId))))
      throw Object.assign(new Error('Publication forbidden'), { status: 403 });
    const frozen = await CourseRevision.findOneAndUpdate(
      {
        id: draft.id,
        status: 'draft',
        revisionTag: draft.revisionTag,
        __v: draft.__v,
        contentDocumentHash: draft.contentDocumentHash,
        revokedAt: { $exists: false },
        activationState: { $exists: false }
      },
      { $set: { activationState: 'prepared', formulaPublication: receipt }, $inc: { __v: 1 } },
      { new: true }
    );
    if (!frozen) conflict('Draft changed while freezing formulas; reload and retry');
    Object.assign(draft, frozen);
  }
  const target = await CourseRevision.findOneAndUpdate(
    { courseId: draft.courseId, revisionTag: receipt.targetTag },
    {
      $setOnInsert: {
        courseId: draft.courseId,
        revisionTag: receipt.targetTag,
        contentHash: draft.contentHash,
        status: 'draft',
        topics: draft.topics,
        summary: draft.summary,
        isInstructorReviewed: true,
        sourceManifest: draft.sourceManifest,
        contentDocument: receipt.canonical,
        contentDocumentHash: receipt.projectionHash,
        formulaPublication: {
          sourceDraftId: String(draft.id),
          sourceTag: receipt.sourceTag,
          sourceVersion: receipt.sourceVersion,
          projectionHash: receipt.projectionHash
        }
      }
    },
    { upsert: true, new: true }
  );
  if (
    target!.contentDocumentHash !== receipt.projectionHash ||
    target!.formulaPublication?.sourceDraftId !== String(draft.id)
  )
    conflict('Publication identity conflict');
  if (target!.status === 'draft' && !target!.activationState)
    await prepareRevisionSources(actor, String(draft.courseId), receipt.targetTag);
  return receipt.targetTag;
}
