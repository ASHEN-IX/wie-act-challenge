/** Real bytes + FAISS fixture. No production bypass or fabricated digest. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CourseRevision } from '../../modules/study/src/models';
import {
  sourceRoots,
  contentHash,
  manifestDigest,
  type SourceDocument
} from '../../modules/study/src/services/revisionSources';
const cleanup = new Set<string>();
export const FIXTURE_TEXT = 'Synthetic source: two plus two equals four.';
export async function materializeRevisionFixture(
  courseId: string,
  revisionId: string,
  text = FIXTURE_TEXT
) {
  const revision = await CourseRevision.findOne({ courseId, revisionTag: revisionId });
  if (!revision) throw new Error('Missing fixture revision');
  const roots = sourceRoots(),
    hash = contentHash(text),
    filename = 'synthetic.txt';
  const document: SourceDocument = {
    documentId: 'doc_' + hash.slice(7, 23),
    filename,
    contentHash: hash,
    storageRef: 'originals/' + hash.slice(7),
    mediaType: 'text/plain',
    provenance: 'extracted'
  };
  await fs.mkdir(path.join(roots.uploads, 'originals'), { recursive: true });
  // Shared synthetic fixture blob is never removed while another suite may use it.
  try {
    await fs.writeFile(path.join(roots.uploads, document.storageRef), text, {
      flag: 'wx',
      mode: 0o444
    });
  } catch (e) {
    if ((e as { code?: string }).code !== 'EEXIST') throw e;
    if (contentHash(await fs.readFile(path.join(roots.uploads, document.storageRef))) !== hash)
      throw new Error('Fixture original mismatch');
  }
  const index = await fs.readFile(path.resolve(__dirname, '../fixtures/p0r2-one-vector.faiss'));
  const meta = {
    schemaVersion: '1.0.0',
    courseId,
    revisionId,
    contentHash: 'sha256:' + revision.contentHash.replace(/^sha256:/, ''),
    documents: [document],
    manifestDigest: manifestDigest(
      courseId,
      revisionId,
      'sha256:' + revision.contentHash.replace(/^sha256:/, ''),
      [document]
    ),
    indexHash: contentHash(index),
    chunks: [text],
    metas: [
      {
        course_id: courseId,
        revision_id: revisionId,
        document_id: document.documentId,
        content_hash: hash,
        text_hash: hash,
        chunk_id: 'chk_' + hash.slice(7),
        page_number: null,
        section_id: 'section_1',
        provenance: 'extracted'
      }
    ]
  };
  const base = path.join(roots.indexes, courseId, revisionId);
  await fs.mkdir(path.dirname(base), { recursive: true });
  await fs.writeFile(base + '.faiss', index);
  await fs.writeFile(base + '.meta.json', JSON.stringify(meta));
  cleanup.add(path.dirname(base));
  await CourseRevision.collection.updateOne(
    { _id: revision._id },
    {
      $set: {
        sourceManifest: [document],
        sourceManifestDigest: meta.manifestDigest,
        vectorIndexRef: 'faiss/' + courseId + '/' + revisionId + '.faiss',
        ...(revision.status === 'published' || revision.status === 'deprecated'
          ? { activationState: 'committed' }
          : {})
      }
    }
  );
  return document;
}
export async function cleanupRevisionFixtures() {
  for (const directory of cleanup) await fs.rm(directory, { recursive: true, force: true });
  cleanup.clear();
}
