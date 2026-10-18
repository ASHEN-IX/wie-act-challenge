/**
 * LearningObjective — read-only view (ai-orchestrator) of the learning_objectives
 * collection (F14 / BLOOM-06, written by the study service).
 *
 * EVAL-02b: the eval API resolves an objective's `bloomLevel` + `knowledgeType`
 * here (server-side, Node) so the target is carried into the job payload as
 * evaluation context. The Python evaluator never touches MongoDB, so the load
 * happens on this side before the job is published. No writes are made through
 * this model — the study service owns the collection.
 *
 * Write path: sole writer is modules/study (objectives.js). This model is
 * read-only and intentionally exposes only the fields evaluation needs.
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ILearningObjective extends Document {
  userId: string;
  documentId: string;
  objectiveId: string;
  topicId: string;
  knowledgeType: string;
  bloomLevel: string;
  verb: string;
  text: string;
  isActive: boolean;
}

const learningObjectiveSchema = new Schema<ILearningObjective>(
  {
    userId: { type: String, required: true },
    documentId: { type: String, required: true },
    objectiveId: { type: String, required: true },
    topicId: { type: String, required: true },
    knowledgeType: { type: String, required: true },
    bloomLevel: { type: String, required: true },
    verb: { type: String, required: true },
    text: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  },
  {
    collection: 'learning_objectives'
  }
);

// BLOOM-08 / EVAL-02b: an objective is addressed by its objectiveId; we only
// ever consider active (not superseded) objectives for targeting.
learningObjectiveSchema.index({ objectiveId: 1, isActive: 1 });

const LearningObjective =
  (mongoose.models.AiLearningObjectiveView as Model<ILearningObjective>) ||
  mongoose.model<ILearningObjective>('AiLearningObjectiveView', learningObjectiveSchema);

export default LearningObjective;
module.exports = LearningObjective;
