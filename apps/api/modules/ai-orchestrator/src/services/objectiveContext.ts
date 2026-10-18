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
  objectiveId: string
): Promise<{ targetBloomLevel: string; knowledgeType: string | null } | null> {
  if (!objectiveId) return null;
  const objective = await (LearningObjective as any)
    .findOne({
      objectiveId,
      isActive: true
    })
    .select('bloomLevel knowledgeType')
    .lean();
  if (!objective || !objective.bloomLevel) return null;
  return {
    targetBloomLevel: objective.bloomLevel,
    knowledgeType: objective.knowledgeType || null
  };
}

export default { resolveObjectiveContext };
module.exports = { resolveObjectiveContext };
