/**
 * BLOOM-06 — LearningObjective persistence service.
 *
 * Handles versioned upsert (no duplicates) and superseding of removed
 * objectives on course (re-)ingestion.  The unique key per AC is scoped to
 * the document: (documentId, topicId, textHash).  Node is the sole Mongo
 * writer — Python never writes objectives.
 */

import crypto from 'crypto';
import { LearningObjective } from '../models/index';

// --- helpers -----------------------------------------------------------------

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export interface ExtractedObjective {
  documentId: string;
  objectiveId: string;
  topicId: string;
  knowledgeType: string;
  bloomLevel: string;
  verb: string;
  text: string;
  textHash: string;
  classification: any;
}

/**
 * Flatten every objective carried in the course topics array into a flat
 * list ready for upsert.  Each element has the fields the model expects
 * plus textHash (for the unique index).
 */
function extractObjectives(documentId: string, topics: any[]): ExtractedObjective[] {
  if (!Array.isArray(topics)) return [];
  const results: ExtractedObjective[] = [];
  for (const topic of topics) {
    if (!Array.isArray(topic.subtopics)) continue;
    for (const sub of topic.subtopics) {
      const objs = sub.learning_objectives || [];
      for (const obj of objs) {
        if (!obj || !obj.text) continue;
        results.push({
          documentId,
          objectiveId: obj.objectiveId || '',
          topicId: obj.topicId || topic.id || '',
          knowledgeType: obj.knowledgeType || '',
          bloomLevel: obj.bloomLevel || '',
          verb: obj.verb || '',
          text: obj.text,
          textHash: sha256(obj.text),
          classification: obj.classification || null
        });
      }
    }
  }
  return results;
}

export interface SyncObjectivesParams {
  userId: string;
  documentId: string;
  topics: any[];
}

export interface SyncObjectivesResult {
  inserted: number;
  updated: number;
  superseded: number;
}

/**
 * Persist / supersede objectives for a document (course).
 */
async function syncObjectivesForDocument({
  userId,
  documentId,
  topics
}: SyncObjectivesParams): Promise<SyncObjectivesResult> {
  const incoming = extractObjectives(documentId, topics);
  if (incoming.length === 0) return { inserted: 0, updated: 0, superseded: 0 };

  const incomingKeys = new Set(incoming.map((o) => `${o.topicId}\0${o.textHash}`));

  // 1. Supersede active objectives that are no longer present
  const previouslyActive = await LearningObjective.find({
    documentId,
    isActive: true
  })
    .select('topicId textHash')
    .lean();

  const toSupersede = previouslyActive.filter(
    (p: any) => !incomingKeys.has(`${p.topicId}\0${p.textHash}`)
  );

  let superseded = 0;
  if (toSupersede.length > 0) {
    const supersedeResult = await LearningObjective.updateMany(
      {
        documentId,
        $or: toSupersede.map((s: any) => ({
          topicId: s.topicId,
          textHash: s.textHash
        }))
      },
      { $set: { isActive: false, supersededAt: new Date() } }
    );
    superseded = supersedeResult.modifiedCount || 0;
  }

  // 2. Upsert each incoming objective (version bump or insert)
  let inserted = 0;
  let updated = 0;

  const ops = incoming.map((obj) => {
    const filter = { documentId, topicId: obj.topicId, textHash: obj.textHash };
    const existing = previouslyActive.find(
      (p: any) => p.topicId === obj.topicId && p.textHash === obj.textHash
    );

    if (existing) {
      // version bump
      updated++;
      return {
        updateOne: {
          filter,
          update: {
            $set: {
              userId,
              objectiveId: obj.objectiveId,
              knowledgeType: obj.knowledgeType,
              bloomLevel: obj.bloomLevel,
              verb: obj.verb,
              text: obj.text,
              classification: obj.classification,
              isActive: true,
              supersededAt: null
            },
            $inc: { version: 1 }
          }
        }
      };
    }

    // new objective
    inserted++;
    return {
      updateOne: {
        filter,
        update: {
          $setOnInsert: {
            userId,
            documentId: obj.documentId,
            objectiveId: obj.objectiveId,
            topicId: obj.topicId,
            knowledgeType: obj.knowledgeType,
            bloomLevel: obj.bloomLevel,
            verb: obj.verb,
            text: obj.text,
            textHash: obj.textHash,
            classification: obj.classification,
            version: 1,
            isActive: true
          }
        },
        upsert: true
      }
    };
  });

  await LearningObjective.bulkWrite(ops as any, { ordered: false });

  return { inserted, updated, superseded };
}

/**
 * Remove all objectives for a document (course deletion).
 */
async function deleteObjectivesForDocument(documentId: string): Promise<number> {
  const result = await LearningObjective.deleteMany({ documentId });
  return result.deletedCount || 0;
}

export { sha256, extractObjectives, syncObjectivesForDocument, deleteObjectivesForDocument };

module.exports = {
  sha256,
  extractObjectives,
  syncObjectivesForDocument,
  deleteObjectivesForDocument
};
