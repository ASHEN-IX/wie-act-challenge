/** Provisional internal artifact format v1. Never a browser authorization grant. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { type ICourseFile, Course, CourseRevision } from '../models';
import { activityDigest } from './activityIdentity';
import { canAuthorCourse } from './resourceAccess';
import aiClient from '../../../../shared/aiClient';
export class SourceIntegrityError extends Error {
  readonly status = 503;
  readonly code = 'SOURCE_INTEGRITY_UNAVAILABLE';
}
export const contentHash = (bytes: Buffer | string) =>
  'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
export function sourceRoots() {
  return {
    uploads: path.resolve(process.env.INGEST_UPLOADS_DIR || 'uploads'),
    indexes: path.resolve(process.env.FAISS_INDEX_DIR || 'var/faiss')
  };
}
export function contained(root: string, relative: string) {
  const target = path.resolve(root, relative);
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    !target.startsWith(root + path.sep)
  )
    throw new SourceIntegrityError('Unsafe artifact reference');
  return target;
}
export interface SourceDocument {
  documentId: string;
  filename: string;
  contentHash: string;
  provenance: 'extracted';
  storageRef: string;
  mediaType: string;
}
export interface SourcePassage {
  documentId: string;
  contentHash: string;
  chunkId: string;
  text: string;
  textHash: string;
  pageNumber: number | null;
  sectionId: string;
  extractionMethod?: 'text' | 'ocr';
  ocrConfidence?: number | null;
  reviewRequired?: boolean;
  extractionWarning?: 'ocr_low_confidence' | 'ocr_no_text' | null;
}
export interface RevisionArtifact {
  schemaVersion: '1.0.0';
  courseId: string;
  revisionId: string;
  contentHash: string;
  documents: SourceDocument[];
  manifestDigest: string;
  indexHash: string;
  chunks: string[];
  metas: Array<Record<string, unknown>>;
}
export function manifestDigest(
  courseId: string,
  revisionId: string,
  hash: string,
  documents: SourceDocument[]
) {
  return activityDigest({ courseId, revisionId, contentHash: hash, documents });
}
export async function verifyBlob(document: SourceDocument) {
  const root = await fs.realpath(sourceRoots().uploads);
  const file = await fs.realpath(contained(root, document.storageRef));
  if (
    !file.startsWith(root + path.sep) ||
    document.storageRef !== 'originals/' + document.contentHash.slice(7)
  )
    throw new SourceIntegrityError('Invalid original identity');
  const bytes = await fs.readFile(file);
  if (contentHash(bytes) !== document.contentHash)
    throw new SourceIntegrityError('Original bytes mismatch');
  return file;
}
export async function captureImmutableSources(courseId: string, uploadedFiles?: ICourseFile[]) {
  const files = uploadedFiles || (await Course.findById(courseId).lean())?.files;
  if (!files?.length) throw new SourceIntegrityError('Original documents required');
  const root = sourceRoots().uploads;
  const documents: SourceDocument[] = [];
  for (const file of files) {
    if (!file.filename || path.basename(file.filename) !== file.filename)
      throw new SourceIntegrityError('Unsafe filename');
    if (!file.fileHash || !/^(sha256:)?[a-f0-9]{64}$/.test(file.fileHash))
      throw new SourceIntegrityError('Original digest unavailable');
    const hash = 'sha256:' + file.fileHash.replace(/^sha256:/, '');
    const storageRef = 'originals/' + hash.slice(7);
    const document: SourceDocument = {
      documentId: 'doc_' + hash.slice(7, 23),
      filename: file.filename,
      contentHash: hash,
      provenance: 'extracted',
      storageRef,
      mediaType: file.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'
    };
    await fs.mkdir(path.join(root, 'originals'), { recursive: true });
    try {
      await verifyBlob(document);
    } catch {
      // Only capture from a verified current upload. Never replace an existing blob.
      const original = await fs.realpath(
        contained(root, 'courses/' + courseId + '/' + file.filename)
      );
      if (!original.startsWith((await fs.realpath(root)) + path.sep))
        throw new SourceIntegrityError('Foreign original');
      const bytes = await fs.readFile(original);
      if (contentHash(bytes) !== hash) throw new SourceIntegrityError('Uploaded bytes mismatch');
      try {
        await fs.writeFile(contained(root, storageRef), bytes, { flag: 'wx', mode: 0o444 });
      } catch (e) {
        if ((e as { code?: string }).code !== 'EEXIST') throw e;
      }
      await verifyBlob(document);
    }
    if (!documents.some((d) => d.documentId === document.documentId)) documents.push(document);
  }
  return documents;
}
export async function verifyRevisionArtifact(revision: {
  courseId: unknown;
  revisionTag: string;
  contentHash: string;
  sourceManifest?: unknown;
  sourceManifestDigest?: string;
  vectorIndexRef?: string;
  indexHash?: string;
  artifactHash?: string;
}) {
  try {
    const courseId = String(revision.courseId),
      revisionId = revision.revisionTag;
    if (!/^[a-f0-9]{24}$/.test(courseId) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(revisionId))
      throw new Error();
    const documents = revision.sourceManifest as SourceDocument[];
    if (!documents?.length || documents.some((d) => !d.storageRef)) throw new Error();
    for (const d of documents) await verifyBlob(d);
    const hash = 'sha256:' + revision.contentHash.replace(/^sha256:/, '');
    const digest = manifestDigest(courseId, revisionId, hash, documents);
    if (
      digest !== revision.sourceManifestDigest ||
      revision.vectorIndexRef !== 'faiss/' + courseId + '/' + revisionId + '.faiss'
    )
      throw new Error();
    const base = contained(sourceRoots().indexes, courseId + '/' + revisionId);
    const metadataBytes = await fs.readFile(base + '.meta.json');
    if (revision.artifactHash && revision.artifactHash !== contentHash(metadataBytes))
      throw new Error();
    const metadata = JSON.parse(metadataBytes.toString('utf8')) as RevisionArtifact;
    const index = await fs.readFile(base + '.faiss');
    if (
      metadata.schemaVersion !== '1.0.0' ||
      metadata.courseId !== courseId ||
      metadata.revisionId !== revisionId ||
      metadata.contentHash !== hash ||
      metadata.manifestDigest !== digest ||
      activityDigest(metadata.documents) !== activityDigest(documents) ||
      metadata.indexHash !== contentHash(index) ||
      (revision.indexHash && revision.indexHash !== metadata.indexHash) ||
      !metadata.chunks.length ||
      metadata.chunks.length !== metadata.metas.length
    )
      throw new Error();
    const passages: SourcePassage[] = metadata.chunks.map((text, i) => {
      const m = metadata.metas[i],
        document = documents.find((d) => d.documentId === m.document_id);
      if (
        !document ||
        m.course_id !== courseId ||
        m.revision_id !== revisionId ||
        m.content_hash !== document.contentHash ||
        m.text_hash !== contentHash(text) ||
        m.chunk_id !== 'chk_' + contentHash(text).slice(7) ||
        !(
          m.page_number === null ||
          (Number.isInteger(m.page_number) && Number(m.page_number) > 0)
        ) ||
        typeof m.section_id !== 'string' ||
        (m.extraction_method !== undefined &&
          !['text', 'ocr'].includes(String(m.extraction_method))) ||
        (m.extraction_method === 'ocr' &&
          (typeof m.ocr_confidence !== 'number' ||
            !Number.isFinite(m.ocr_confidence) ||
            m.ocr_confidence < 0 ||
            m.ocr_confidence > 100 ||
            m.review_required !== true)) ||
        (m.extraction_warning !== undefined &&
          m.extraction_warning !== null &&
          !['ocr_low_confidence', 'ocr_no_text'].includes(String(m.extraction_warning)))
      )
        throw new Error();
      return {
        documentId: document.documentId,
        contentHash: document.contentHash,
        chunkId: String(m.chunk_id),
        text,
        textHash: String(m.text_hash),
        pageNumber: m.page_number as number | null,
        sectionId: String(m.section_id),
        extractionMethod: m.extraction_method as SourcePassage['extractionMethod'],
        ocrConfidence: m.ocr_confidence as number | null | undefined,
        reviewRequired: m.review_required === true,
        extractionWarning: m.extraction_warning as SourcePassage['extractionWarning']
      };
    });
    return { metadata, passages, artifactHash: contentHash(metadataBytes) };
  } catch {
    throw new SourceIntegrityError('Exact original/manifest/index integrity unavailable');
  }
}
export async function prepareRevisionSources(actor: string, courseId: string, revisionId: string) {
  if (!(await canAuthorCourse(actor, courseId)))
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  const draft = await CourseRevision.findOne({
    courseId,
    revisionTag: revisionId,
    status: 'draft',
    activationState: { $ne: 'prepared' }
  }).lean();
  if (!draft) throw Object.assign(new Error('Draft conflict'), { status: 409 });
  const documents = await captureImmutableSources(courseId),
    hash = 'sha256:' + draft.contentHash.replace(/^sha256:/, '');
  const digest = manifestDigest(courseId, revisionId, hash, documents);
  await aiClient.post('/api/ai/sources/index', {
    schemaVersion: '1.0.0',
    courseId,
    revisionId,
    contentHash: hash,
    documents,
    manifestDigest: digest
  });
  if (!(await canAuthorCourse(actor, courseId)))
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  // The source manifest becomes fixed when artifacts are prepared. Legacy rows
  // are updated only by explicit authorized preparation, never by a read.
  const changed = await CourseRevision.collection.updateOne(
    {
      _id: draft._id,
      revisionTag: revisionId,
      status: 'draft',
      __v: draft.__v,
      activationState: { $ne: 'prepared' }
    },
    {
      $set: {
        sourceManifest: documents,
        sourceManifestDigest: digest,
        vectorIndexRef: 'faiss/' + courseId + '/' + revisionId + '.faiss'
      }
    }
  );
  if (!changed.matchedCount) throw Object.assign(new Error('Draft conflict'), { status: 409 });
  const ready = await verifyRevisionArtifact({
    ...draft,
    sourceManifest: documents,
    sourceManifestDigest: digest,
    vectorIndexRef: 'faiss/' + courseId + '/' + revisionId + '.faiss'
  });
  const pinned = await CourseRevision.updateOne(
    {
      _id: draft._id,
      revisionTag: revisionId,
      status: 'draft',
      __v: draft.__v,
      activationState: { $ne: 'prepared' }
    },
    { $set: { artifactHash: ready.artifactHash, indexHash: ready.metadata.indexHash } }
  );
  if (!pinned.matchedCount)
    throw Object.assign(new Error('Draft changed while preparing artifacts'), { status: 409 });
  return { ready: true, revisionId, manifestDigest: digest, indexHash: ready.metadata.indexHash };
}
