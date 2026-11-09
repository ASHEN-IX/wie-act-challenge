/**
 * LearningObjective — read-only view (ai-orchestrator) of the
 * `learning_objectives` table (F14 / BLOOM-06, written by the study service).
 *
 * EVAL-02b: the eval API resolves an objective's `bloomLevel` + `knowledgeType`
 * here (server-side, Node) so the target is carried into the job payload as
 * evaluation context. No writes are made through this model — the study
 * service owns the table.
 *
 * Write path: sole writer is modules/study (objectives.js). This model is
 * read-only and intentionally exposes only the fields evaluation needs.
 */

import type {
  LearningObjective as LearningObjectiveRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';

export interface ILearningObjective extends LearningObjectiveRow {
  _id: string;
}

function hydrate(row: LearningObjectiveRow): ILearningObjective {
  return toDocument(row) as ILearningObjective;
}

export const LearningObjective = {
  async findOne(
    where: Prisma.LearningObjectiveWhereInput = {}
  ): Promise<ILearningObjective | null> {
    const row = await prisma.learningObjective.findFirst({ where });
    return row ? hydrate(row) : null;
  }
};

export default LearningObjective;
module.exports = LearningObjective;
