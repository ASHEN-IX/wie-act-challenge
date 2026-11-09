import type {
  FacilitatorIntervention as FacilitatorInterventionRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

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
  | 'confusion_signal'
  | 'phase_transition'
  | 'consensus_check';

export type InterventionStatus = 'proposed' | 'delivered' | 'accepted' | 'declined' | 'expired';

// The model had `timestamps: false`: there is no `updatedAt` column.
export type IFacilitatorIntervention = Omit<FacilitatorInterventionRow, 'proposedUICommand'> & {
  id: string;
  proposedUICommand?: {
    action: string;
    activityId?: string;
    reason?: string;
  } | null;
};

export const FacilitatorIntervention = table<IFacilitatorIntervention>({
  delegate: () => prisma.facilitatorIntervention,
  jsonColumns: ['proposedUICommand'],
  defaults: () => ({ trigger: 'explicit_ask', status: 'delivered', cooldownSeconds: 15 }),
  columns: (row) => ({
    interventionId: row.interventionId,
    roomId: row.roomId,
    strategy: row.strategy,
    trigger: row.trigger,
    targetUserId: row.targetUserId,
    targetSpeakerName: row.targetSpeakerName,
    reasoning: row.reasoning,
    message: row.message,
    executionMode: row.executionMode,
    proposedUICommand: row.proposedUICommand as unknown as Prisma.InputJsonValue,
    status: row.status,
    cooldownSeconds: row.cooldownSeconds,
    createdAt: row.createdAt
  })
});

export default FacilitatorIntervention;
