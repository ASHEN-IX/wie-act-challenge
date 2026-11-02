import mongoose, { Schema, type Model } from 'mongoose';

/**
 * Persisted Visual Learning Lab. Only validated definitions reach this collection;
 * the derived answer key stays here and is never projected to a browser.
 */
export interface IVisualLab {
  labId: string;
  schemaVersion: number;
  ownerUserId: string;
  scope: 'private';
  sourceMode: 'course' | 'topic';
  courseId?: string;
  revisionId?: string;
  topicId?: string;
  passageIds: string[];
  topic?: string;
  engine: 'weighted_graph' | 'parameter_model' | 'spatial_3d' | 'function_plot';
  title: string;
  concept: string;
  learningObjective: string;
  definition: Record<string, unknown>;
  guidance: Record<string, unknown>;
  check: {
    prompt: string;
    options: Array<{ id: string; label: string }>;
    correctOptionId: string;
    explanation: string;
  };
  generationMode: 'AI_PLANNED' | 'DETERMINISTIC_FALLBACK';
  generationKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisualLabSchema = new Schema<IVisualLab>(
  {
    labId: { type: String, required: true, unique: true, index: true },
    schemaVersion: { type: Number, required: true },
    ownerUserId: { type: String, required: true, index: true },
    scope: { type: String, enum: ['private'], required: true, default: 'private' },
    sourceMode: { type: String, enum: ['course', 'topic'], required: true },
    courseId: { type: String, index: true },
    revisionId: { type: String },
    topicId: { type: String },
    passageIds: { type: [String], default: [] },
    topic: { type: String },
    engine: { type: String, enum: ['weighted_graph', 'parameter_model', 'spatial_3d', 'function_plot'], required: true },
    title: { type: String, required: true },
    concept: { type: String, required: true },
    learningObjective: { type: String, required: true },
    definition: { type: Schema.Types.Mixed, required: true },
    guidance: { type: Schema.Types.Mixed, required: true },
    check: { type: Schema.Types.Mixed, required: true },
    generationMode: {
      type: String,
      enum: ['AI_PLANNED', 'DETERMINISTIC_FALLBACK'],
      required: true
    },
    generationKey: { type: String, required: true }
  },
  { collection: 'visual_labs', timestamps: true }
);

// One lab per owner and generation request keeps repeated clicks from re-billing the model.
VisualLabSchema.index({ ownerUserId: 1, generationKey: 1 }, { unique: true });
VisualLabSchema.index({ ownerUserId: 1, courseId: 1, revisionId: 1 });

export const VisualLab: Model<IVisualLab> =
  (mongoose.models.VisualLab as Model<IVisualLab>) ||
  mongoose.model<IVisualLab>('VisualLab', VisualLabSchema);
