import mongoose, { Document, Model, Schema } from 'mongoose';

export type FacilitatorStrategy =
  | 'PEER_CHALLENGE'
  | 'SOCRATIC_NUDGE'
  | 'CONCEPT_PROMPT'
  | 'INCLUSIVE_INVITATION'
  | 'CONSENSUS_CHECK'
  | 'DISAGREEMENT_RESOLUTION';

export type FacilitatorTrigger =
  | 'explicit_ask'
  | 'request_hint'
  | 'misconception_detected'
  | 'phase_transition'
  | 'consensus_check';

export type InterventionStatus = 'proposed' | 'delivered' | 'accepted' | 'declined' | 'expired';

export interface IFacilitatorIntervention extends Document {
  interventionId: string;
  roomId: string;
  strategy: FacilitatorStrategy;
  trigger: FacilitatorTrigger;
  targetUserId?: string;
  targetSpeakerName?: string;
  reasoning: string;
  message: string;
  proposedUICommand?: {
    action: string;
    activityId?: string;
    reason?: string;
  };
  status: InterventionStatus;
  cooldownSeconds: number;
  createdAt: Date;
}

const facilitatorInterventionSchema = new Schema<IFacilitatorIntervention>(
  {
    interventionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      index: true
    },
    strategy: {
      type: String,
      enum: [
        'PEER_CHALLENGE',
        'SOCRATIC_NUDGE',
        'CONCEPT_PROMPT',
        'INCLUSIVE_INVITATION',
        'CONSENSUS_CHECK',
        'DISAGREEMENT_RESOLUTION'
      ],
      required: true
    },
    trigger: {
      type: String,
      enum: [
        'explicit_ask',
        'request_hint',
        'misconception_detected',
        'phase_transition',
        'consensus_check'
      ],
      default: 'explicit_ask'
    },
    targetUserId: {
      type: String
    },
    targetSpeakerName: {
      type: String
    },
    reasoning: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    proposedUICommand: {
      action: { type: String },
      activityId: { type: String },
      reason: { type: String }
    },
    status: {
      type: String,
      enum: ['proposed', 'delivered', 'accepted', 'declined', 'expired'],
      default: 'delivered'
    },
    cooldownSeconds: {
      type: Number,
      default: 15
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

facilitatorInterventionSchema.index({ roomId: 1, createdAt: -1 });

export const FacilitatorIntervention: Model<IFacilitatorIntervention> =
  mongoose.models.FacilitatorIntervention ||
  mongoose.model<IFacilitatorIntervention>(
    'FacilitatorIntervention',
    facilitatorInterventionSchema
  );

export default FacilitatorIntervention;
