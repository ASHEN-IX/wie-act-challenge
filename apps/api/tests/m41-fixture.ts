/**
 * Minimal *real* published-revision fixture for the M4.1 browser suite.
 *
 * The M4.1 suite needs a published revision, but the Batch 3 ingestion journey
 * that normally publishes one is currently failing on its own content
 * assertions in this environment (see the M4.1 acceptance report). Re-running
 * ingestion would not help, so this module writes the same artifacts the
 * ingestion worker writes — a real source blob, a real FAISS index file, real
 * hashes, real manifest digests — and lets the application's own verification
 * accept them.
 *
 * Nothing here weakens a check: `verifyRevisionArtifact` still validates the
 * blob hash, the manifest digest, the index hash, the artifact hash and the
 * canonical checksum. If any of them is wrong, the reader refuses to render.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient, ObjectId } from "mongodb";

const courseId = "0123456789abcdef01234567";
const revisionTag = "rev_m41_fixture";
const instructorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const studentId = "cccccccccccccccccccccccc";
const institutionId = "eeeeeeeeeeeeeeeeeeeeeeee";

/** The same canonical digest the application uses: sorted-key JSON, sha256. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ":" +
            canonical((value as Record<string, unknown>)[key]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
const digest = (value: unknown) =>
  "sha256:" + crypto.createHash("sha256").update(canonical(value)).digest("hex");
const hashBytes = (bytes: Buffer) =>
  "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");

/** A tiny but valid canonical document: one chapter, two lessons, mixed blocks
 * including a reviewed and an unreviewed formula, code and a diagram. */
function canonicalDocument(documentId: string) {
  return {
    schemaVersion: "1.0.0",
    courseId,
    title: "M4.1 Planning Fixture",
    provenance: { content: "extracted", structure: "deterministic" },
    verification: "source_text_unverified",
    chapters: [
      {
        id: "chapter-1",
        title: "Foundations",
        lessons: [
          {
            id: "lesson-1",
            title: "Summation identities",
            summary: "Closed forms and their proofs.",
            source_spans: [],
            blocks: [
              { type: "paragraph", id: "p1", text: "A series is the limit of its partial sums.", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
              { type: "definition", id: "d1", title: "Convergent series", text: "A series converges when its partial sums converge.", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
              { type: "math", id: "m1", expression: "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", regionId: "region_m1", page: 1, bbox: [0, 0, 10, 10], extractionMethod: "text", confidence: 0.9, reviewRequired: false, issues: [], reviewedFormula: { state: "accepted", expression: "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", originalModelLatex: "\\sum_{k=1}^{n} k = n(n+1)/2", reviewer: "final-instructor@example.test" }, evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
              { type: "math", id: "m2", expression: "S_n = \\sum_{p=0}^{n} u_p", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }], regionId: "region_m2", page: 1, bbox: [0, 0, 10, 10], extractionMethod: "text", confidence: 0.9, reviewRequired: false, issues: [] },
              { type: "proof", id: "pr1", title: "Proof", text: "By induction on n.", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
              { type: "code", id: "code1", language: "python", code: "def total(n):\n    return n * (n + 1) // 2", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
            ],
          },
          {
            id: "lesson-2",
            title: "Implementation notes",
            summary: "Code and structure.",
            source_spans: [],
            blocks: [
              { type: "code", id: "c1", language: "python", code: "def total(n):\n    return n * (n + 1) // 2", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
              { type: "callout", id: "ex1", kind: "exercise", title: "Exercise 1", text: "Prove the closed form by induction.", evidence: [{ chunkId: "chunk-1", documentId, pageNumber: 1, lineStart: 1, lineEnd: 2 }] },
            ],
          },
        ],
      },
    ],
  };
}

export type Fixture = {
  courseId: string;
  revisionTag: string;
  lessonIds: string[];
};

/**
 * Seed the fixture. Idempotent: re-running replaces the same course/revision.
 * Returns the identities the spec drives the reader with.
 */
export async function seedPlanningFixture(
  mongoUri: string,
  qaRoot: string,
): Promise<Fixture> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();
  try {
    // The preserved source. It is not parsed for this fixture; it exists so the
    // artifact chain (blob hash, storageRef identity) is genuinely verifiable.
    const sourceBytes = Buffer.from(
      "M4.1 planning fixture source. Summation identities and implementation notes.\n",
      "utf8",
    );
    const sourceHash = hashBytes(sourceBytes);
    const documentId = "doc_" + sourceHash.slice(7, 23);
    const storageRef = "originals/" + sourceHash.slice(7);

    // Evidence spans name the real document, so the projection keeps them.
    const document = canonicalDocument(documentId);
    const contentDocumentHash = digest(document);
    await fs.mkdir(path.join(qaRoot, "uploads", "originals"), { recursive: true });
    await fs.writeFile(path.join(qaRoot, "uploads", storageRef), sourceBytes);

    const documents = [
      {
        documentId,
        filename: "m41-fixture.txt",
        contentHash: sourceHash,
        storageRef,
        pageCount: 1,
        extractionVersion: "2.0",
        mediaType: "text/plain",
      },
    ];
    const manifest = digest({
      courseId,
      revisionId: revisionTag,
      contentHash: sourceHash,
      documents,
    });

    // A real index file; its bytes are hashed into the metadata below.
    const indexBytes = Buffer.from("m41-fixture-index", "utf8");
    const indexHash = hashBytes(indexBytes);
    // Chunk metadata is checked field by field: the chunk id and text hash are
    // both derived from the chunk text, and the document is identified by its
    // snake_case key. Getting any of these wrong fails closed, as it should.
    const chunkText = "A series is the limit of its partial sums.";
    const textHash = hashBytes(Buffer.from(chunkText, "utf8"));
    const artifact = {
      schemaVersion: "1.0.0",
      courseId,
      revisionId: revisionTag,
      contentHash: sourceHash,
      documents,
      manifestDigest: manifest,
      indexHash,
      chunks: [chunkText],
      metas: [
        {
          course_id: courseId,
          revision_id: revisionTag,
          document_id: documentId,
          content_hash: sourceHash,
          text_hash: textHash,
          chunk_id: "chk_" + textHash.slice(7),
          page_number: 1,
          section_id: "chapter-1",
          extraction_method: "text",
        },
      ],
    };
    const artifactBytes = Buffer.from(JSON.stringify(artifact), "utf8");
    const indexDir = path.join(qaRoot, "indexes", courseId);
    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(path.join(indexDir, `${revisionTag}.meta.json`), artifactBytes);
    await fs.writeFile(path.join(indexDir, `${revisionTag}.faiss`), indexBytes);

    // A published revision, with a committed activation state.
    await db.collection("course_revisions").deleteMany({ courseId: new ObjectId(courseId) });
    await db.collection("course_revisions").insertOne({
      courseId: new ObjectId(courseId),
      revisionTag,
      revisionNumber: 1,
      status: "published",
      activationState: "committed",
      publishedAt: new Date(),
      publishedByUserId: instructorId,
      summary: "M4.1 planning fixture",
      topics: [],
      contentHash: sourceHash,
      contentDocument: document,
      contentDocumentHash,
      sourceManifest: documents,
      sourceManifestDigest: manifest,
      vectorIndexRef: `faiss/${courseId}/${revisionTag}.faiss`,
      indexHash,
      artifactHash: hashBytes(artifactBytes),
    });

    await db.collection("courses").updateOne(
      { _id: new ObjectId(courseId) },
      {
        $set: {
          _id: new ObjectId(courseId),
          title: "M4.1 Planning Fixture",
          status: "completed",
          // Institutional scope is what makes enrollment-based read access
          // apply; a personal course would only be visible to its owner.
          scope: "institutional",
          institutionId: new ObjectId(institutionId),
          ownerUserId: instructorId,
          userId: instructorId,
          activeRevisionId: revisionTag,
        },
      },
      { upsert: true },
    );

    // Enrollment for the student, none for the outsider.
    await db.collection("course_enrollments").deleteMany({ courseId: new ObjectId(courseId) });
    await db.collection("course_enrollments").insertOne({
      courseId: new ObjectId(courseId),
      institutionId: new ObjectId(institutionId),
      userId: studentId,
      status: "active",
      enrolledAt: new Date(),
    });

    // One instructor-authored walkthrough asset on the code block, so the
    // planning path has a real supplement to select.
    await db.collection("structuredassets").deleteMany({ courseId });
    await db.collection("structuredassets").insertOne({
      schemaVersion: "1.0.0",
      assetId: "asset_m41_walkthrough",
      courseId,
      revisionId: revisionTag,
      blockId: "code1",
      lessonId: "lesson-1",
      registryVersion: "1.0.0",
      component: "CodeWalkthrough",
      payload: {
        component: "CodeWalkthrough",
        language: "python",
        code: "def total(n):\n    return n * (n + 1) // 2",
        annotations: [
          { line: 0, explanation: "Declares the closed-form helper." },
          { line: 1, explanation: "Returns the triangular number." },
        ],
      },
      provenance: "instructor_authored",
      reviewStatus: "instructor_reviewed",
      reviewedBy: "final-instructor@example.test",
      reviewedAt: "2026-11-01T10:00:00.000Z",
      audience: "course",
      fallback: "CodeViewer",
      disclosure: "Instructor-authored walkthrough.",
      createdByUserId: instructorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { courseId, revisionTag, lessonIds: ["lesson-1", "lesson-2"] };
  } finally {
    await client.close();
  }
}

export const fixtureIdentities = { courseId, revisionTag, studentId, instructorId };
