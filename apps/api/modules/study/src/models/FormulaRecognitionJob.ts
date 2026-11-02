import { Schema, model, models } from 'mongoose';
const schema = new Schema({
  identity: { type: String, required: true, unique: true },
  courseId: { type: String, required: true }, revisionId: { type: String, required: true },
  revisionTag: { type: String, required: true }, draftVersion: { type: Number, required: true },
  actor: { type: String, required: true }, documentId: { type: String, required: true },
  documentHash: { type: String, required: true }, regionId: { type: String, required: true },
  cropHash: { type: String, required: true }, page: Number, bbox: [Number], sourceText: String,
  model: { type: String, required: true },
  state: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'cancelled', 'stale', 'uncertain'], default: 'queued' },
  claim: String, startedAt: Date, finishedAt: Date, error: String, proposalId: String,
  usage: Schema.Types.Mixed, result: Schema.Types.Mixed,
}, { timestamps: true, strict: 'throw' });
export const FormulaRecognitionJob = models.FormulaRecognitionJob || model('FormulaRecognitionJob', schema);
