import { canReadCourse } from '../../../study/src/services/resourceAccess';
/**
 * objectiveContext — resolve a learning objective's Bloom context (EVAL-02b).
 *
 * Given an `objectiveId` from an eval request, load the objective's
 * `bloomLevel` + `knowledgeType` from the shared learning_objectives collection
 * (read-only — the study service owns writes). The resolved target is carried
 * into the study.eval.step job payload as evaluation context so the Python
 * evaluator can target that Bloom depth without touching MongoDB.
 *
 * A missing / inactive / superseded objective returns null; the caller treats a
 * present-but-unresolvable objectiveId as a client error (422).
 */

import LearningObjective from '../models/LearningObjective';

/**
 * @param {string} objectiveId
 * @returns {Promise<{targetBloomLevel: string, knowledgeType: string}|null>}
 */
export async function resolveObjectiveContext(
  objectiveId: string,
  userId: string
): Promise<{ targetBloomLevel: string; knowledgeType: string | null; courseId: string } | null> {
  if (!objectiveId) return null;
  const objective = await LearningObjective.findOne({
    objectiveId,
    userId,
    isActive: true
  })
    .select('bloomLevel knowledgeType documentId')
    .lean();
  if (!objective || !objective.bloomLevel || !(await canReadCourse(userId, objective.documentId)))
    return null;
  return {
    courseId: objective.documentId,
    targetBloomLevel: objective.bloomLevel,
    knowledgeType: objective.knowledgeType || null
  };
}

export default { resolveObjectiveContext };
module.exports = { resolveObjectiveContext };
