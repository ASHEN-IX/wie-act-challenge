import { Schema, model, models } from 'mongoose';

/** Separate from immutable canonical source blocks. */
const decisionSchema = new Schema({
  reviewer: { type: String, required: true },
  action: { type: String, enum: ['accepted', 'corrected', 'rejected'], required: true },
  previous: { type: String, required: true },
  next: { type: String, required: true },
  expression: { type: String },
  draftVersion: { type: Number, required: true },
  revisionTag: { type: String, required: true },
  revisionId: { type: String, required: true },
  reviewVersion: { type: Number, required: true },
  at: { type: Date, required: true },
}, { _id: false });
const schema = new Schema({
  courseId: { type: Schema.Types.ObjectId, required: true },
  revisionId: { type: Schema.Types.ObjectId, required: true },
  revisionTag: { type: String, required: true },
  draftVersion: { type: Number, required: true },
  documentId: { type: String, required: true },
  documentHash: { type: String, required: true },
  regionId: { type: String, required: true },
  page: { type: Number, required: true },
  bbox: { type: [Number], required: true },
  sourceText: { type: String, required: true },
  cropHash: { type: String, required: true },
  provider: { type: String, required: true }, model: { type: String, required: true },
  modelVersion: String, recognitionJobId: String, usage: Schema.Types.Mixed,
  latex: { type: String, required: true }, warnings: { type: [String], default: [] },
  identity: { type: String, required: true },
  reviewedLatex: { type: String },
  state: { type: String, enum: ['pending', 'accepted', 'corrected', 'rejected'], default: 'pending' },
  reviewVersion: { type: Number, default: 0 },
  history: { type: [decisionSchema], default: [] },
}, { timestamps: true, strict: 'throw' });
schema.index({ identity: 1 }, { unique: true });
schema.index({ courseId: 1, revisionId: 1, draftVersion: 1 });
export const FormulaProposal = models.FormulaProposal || model('FormulaProposal', schema);
