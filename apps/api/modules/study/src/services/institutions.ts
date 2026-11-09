import crypto from 'node:crypto';
import { isDuplicateKey } from '../models/_table';
import {
  IInstitution,
  IInstitutionInvitation,
  IInstitutionMembership,
  Institution,
  InstitutionInvitation,
  InstitutionInvitationRole,
  InstitutionMembership,
  InstitutionMembershipRole
} from '../models/Institution';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const INVITATION_TOKEN = /^[A-Za-z0-9_-]{32,200}$/;
const DEFAULT_INVITATION_HOURS = 168;
const MAX_INVITATION_HOURS = 720;

type LeanInstitution = IInstitution & { _id: string };
type LeanMembership = IInstitutionMembership & { _id: string };
type LeanInvitation = IInstitutionInvitation & { _id: string };

export class InstitutionError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'InstitutionError';
  }
}

export interface InstitutionContext {
  institution: {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    isVerified: boolean;
  };
  membership: {
    id: string;
    role: InstitutionMembershipRole;
    status: string;
    createdAt: Date;
  };
}

function parseInstitutionId(value: string): string {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    throw new InstitutionError(404, 'Institution not found');
  }
  return value;
}

function parseInvitationId(value: string): string {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    throw new InstitutionError(404, 'Invitation not found');
  }
  return value;
}

function parseUserId(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw new InstitutionError(404, 'Membership not found');
  }
  return value;
}

function publicInstitution(institution: LeanInstitution) {
  return {
    id: String(institution._id),
    name: institution.name,
    slug: institution.slug,
    ...(institution.domain ? { domain: institution.domain } : {}),
    isVerified: institution.isVerified
  };
}

function publicMembership(membership: LeanMembership) {
  return {
    id: String(membership._id),
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt
  };
}

function context(institution: LeanInstitution, membership: LeanMembership): InstitutionContext {
  return {
    institution: publicInstitution(institution),
    membership: publicMembership(membership)
  };
}

async function activeMembership(userId: string, institutionId: string) {
  return InstitutionMembership.findOne({
    institutionId,
    userId,
    status: 'active'
  });
}

async function anyMembership(userId: string, institutionId: string) {
  return InstitutionMembership.findOne({
    institutionId,
    userId
  });
}

// Acceptance is a durable claim followed by a separate membership write. On a
// standalone MongoDB without cross-collection transactions, a process can stop
// between those writes. Re-entering this function for the same accepted actor
// completes the missing membership without letting a different actor reuse the
// token. An existing suspended or non-active membership is never reactivated.
async function completeAcceptedInvitation(
  invitation: LeanInvitation,
  actorUserId: string
): Promise<InstitutionContext> {
  if (invitation.acceptedByUserId !== actorUserId) {
    throw new InstitutionError(409, 'Invitation has already been used');
  }
  const institutionId = String(invitation.institutionId);
  let membership = await anyMembership(actorUserId, String(invitation.institutionId));
  if (!membership) {
    try {
      membership = await InstitutionMembership.findOneAndUpdate(
        {
          institutionId: invitation.institutionId,
          userId: actorUserId
        },
        {
          $setOnInsert: {
            institutionId: invitation.institutionId,
            userId: actorUserId,
            role: invitation.role,
            status: 'active',
            invitedByUserId: invitation.issuedByUserId
          }
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // A concurrent retry inserted the same unique membership first.
      membership = await anyMembership(actorUserId, institutionId);
    }
  }
  if (!membership) {
    throw new InstitutionError(500, 'Membership could not be established');
  }
  if (membership.status === 'suspended') {
    throw new InstitutionError(403, 'Institution membership is suspended');
  }
  if (membership.status !== 'active') {
    throw new InstitutionError(409, 'Institution membership is not active');
  }
  const institution = await Institution.findById(invitation.institutionId);
  if (!institution) throw new InstitutionError(404, 'Institution not found');
  return context(institution, membership);
}

async function requireInstitutionAdmin(userId: string, institutionId: string) {
  const membership = await activeMembership(userId, institutionId);
  if (!membership || membership.role !== 'university_admin') {
    // 404 avoids confirming whether an institution exists to an outsider.
    throw new InstitutionError(404, 'Institution administrator access required');
  }
  return membership;
}

export async function listInstitutionContexts(userId: string): Promise<InstitutionContext[]> {
  const memberships = await InstitutionMembership.find({ userId, status: 'active' }).sort({
    createdAt: 1
  });
  if (!memberships.length) return [];
  const institutions = await Institution.find({
    _id: { $in: memberships.map((membership) => membership.institutionId) }
  });
  const byId = new Map(institutions.map((institution) => [String(institution._id), institution]));
  return memberships.flatMap((membership) => {
    const institution = byId.get(String(membership.institutionId));
    return institution ? [context(institution, membership)] : [];
  });
}

export async function getInstitutionContext(
  userId: string,
  rawInstitutionId: string
): Promise<InstitutionContext> {
  const institutionId = parseInstitutionId(rawInstitutionId);
  const membership = await activeMembership(userId, institutionId);
  if (!membership) throw new InstitutionError(404, 'Institution not found');
  const institution = await Institution.findById(institutionId);
  if (!institution) throw new InstitutionError(404, 'Institution not found');
  return context(institution, membership);
}

export async function bootstrapInstitution(input: {
  actorUserId: string;
  name: string;
  slug: string;
  domain?: string;
}): Promise<InstitutionContext> {
  if (!input.actorUserId) throw new InstitutionError(401, 'Authentication required');
  let institution: LeanInstitution;
  try {
    institution = (await Institution.create({
      name: input.name,
      slug: input.slug,
      ...(input.domain ? { domain: input.domain } : {}),
      isVerified: false,
      createdByUserId: input.actorUserId
    })) as unknown as LeanInstitution;
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new InstitutionError(409, 'Institution identity already exists');
    }
    throw error;
  }
  try {
    const membership = (await InstitutionMembership.create({
      institutionId: institution._id,
      userId: input.actorUserId,
      role: 'university_admin',
      status: 'active'
    })) as unknown as LeanMembership;
    return context(institution, membership);
  } catch (error) {
    // Mongo standalone has no cross-collection transaction here. Compensate so
    // a failed bootstrap cannot leave an institution without its initial admin.
    await Institution.deleteOne({ _id: institution._id }).catch(() => undefined);
    throw error;
  }
}

export async function updateInstitutionMetadata(
  userId: string,
  rawInstitutionId: string,
  updates: { name?: string; domain?: string }
): Promise<InstitutionContext> {
  const institutionId = parseInstitutionId(rawInstitutionId);
  const membership = await requireInstitutionAdmin(userId, institutionId);
  const set: Record<string, string> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.domain !== undefined) set.domain = updates.domain;
  if (!Object.keys(set).length) throw new InstitutionError(400, 'No supported metadata supplied');
  const institution = await Institution.findByIdAndUpdate(
    institutionId,
    { $set: set },
    { new: true, runValidators: true }
  );
  if (!institution) throw new InstitutionError(404, 'Institution not found');
  return context(institution, membership);
}

export async function issueInstitutionInvitation(input: {
  actorUserId: string;
  institutionId: string;
  role: InstitutionInvitationRole;
  expiresInHours?: number;
}): Promise<{
  invitation: {
    id: string;
    institutionId: string;
    role: InstitutionInvitationRole;
    expiresAt: Date;
  };
  token: string;
}> {
  const institutionId = parseInstitutionId(input.institutionId);
  await requireInstitutionAdmin(input.actorUserId, institutionId);
  const hours = input.expiresInHours ?? DEFAULT_INVITATION_HOURS;
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_INVITATION_HOURS) {
    throw new InstitutionError(400, 'Invitation expiry must be between 1 and 720 hours');
  }
  const now = new Date();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  // Independent pending invitations are permitted for the same institution and
  // role. Without a reviewed recipient-binding field, there is no authoritative
  // way to identify "the same intended recipient" and silently collapsing
  // invitations would prevent legitimate multi-student onboarding.
  const invitation = (await InstitutionInvitation.create({
    institutionId,
    role: input.role,
    tokenHash,
    status: 'pending',
    issuedByUserId: input.actorUserId,
    expiresAt: new Date(now.getTime() + hours * 60 * 60 * 1000)
  })) as unknown as LeanInvitation;
  return {
    invitation: {
      id: String(invitation._id),
      institutionId: String(invitation.institutionId),
      role: invitation.role,
      expiresAt: invitation.expiresAt
    },
    token
  };
}

export async function acceptInstitutionInvitation(input: {
  actorUserId: string;
  token: string;
}): Promise<InstitutionContext> {
  if (!input.actorUserId) throw new InstitutionError(401, 'Authentication required');
  if (typeof input.token !== 'string' || !INVITATION_TOKEN.test(input.token)) {
    throw new InstitutionError(400, 'A valid invitation token is required');
  }
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
  const invitation = await InstitutionInvitation.findOne({ tokenHash });
  if (!invitation) throw new InstitutionError(404, 'Invitation not found');
  const now = new Date();
  if (invitation.status === 'revoked' || invitation.status === 'expired') {
    throw new InstitutionError(410, 'Invitation is no longer available');
  }
  if (invitation.status === 'accepted') {
    return completeAcceptedInvitation(invitation, input.actorUserId);
  }
  if (invitation.expiresAt.getTime() <= now.getTime()) {
    await InstitutionInvitation.updateOne(
      { _id: invitation._id, status: 'pending' },
      { $set: { status: 'expired' } }
    );
    throw new InstitutionError(410, 'Invitation has expired');
  }
  const existing = await anyMembership(input.actorUserId, String(invitation.institutionId));
  if (existing) {
    if (existing.status === 'suspended') {
      throw new InstitutionError(403, 'Institution membership is suspended');
    }
    throw new InstitutionError(409, 'Already a member of this institution');
  }

  const claimed = await InstitutionInvitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: 'pending',
      expiresAt: { $gt: now }
    },
    {
      $set: {
        status: 'accepted',
        acceptedByUserId: input.actorUserId,
        acceptedAt: now
      }
    },
    { new: true }
  );
  if (!claimed) {
    const latest = await InstitutionInvitation.findById(invitation._id);
    if (!latest) throw new InstitutionError(404, 'Invitation not found');
    if (latest.status === 'revoked' || latest.status === 'expired') {
      throw new InstitutionError(410, 'Invitation is no longer available');
    }
    if (latest.status === 'accepted') {
      return completeAcceptedInvitation(latest, input.actorUserId);
    }
    if (latest.expiresAt.getTime() <= now.getTime()) {
      await InstitutionInvitation.updateOne(
        { _id: latest._id, status: 'pending' },
        { $set: { status: 'expired' } }
      );
      throw new InstitutionError(410, 'Invitation has expired');
    }
    throw new InstitutionError(409, 'Invitation is no longer available');
  }
  // The accepted claim is intentionally not rolled back if the following write
  // fails: the same actor can retry the token to reconcile, while another actor
  // can never claim it. Rolling back after a successful membership write would
  // turn an uncertain response into token multi-use.
  return completeAcceptedInvitation(claimed, input.actorUserId);
}

export async function revokeInstitutionInvitation(input: {
  actorUserId: string;
  institutionId: string;
  invitationId: string;
}): Promise<{ id: string; status: string }> {
  const institutionId = parseInstitutionId(input.institutionId);
  const invitationId = parseInvitationId(input.invitationId);
  await requireInstitutionAdmin(input.actorUserId, institutionId);
  const invitation = await InstitutionInvitation.findOneAndUpdate(
    { _id: invitationId, institutionId, status: 'pending' },
    { $set: { status: 'revoked', revokedAt: new Date() } },
    { new: true }
  );
  if (!invitation) throw new InstitutionError(404, 'Pending invitation not found');
  return { id: String(invitation._id), status: invitation.status };
}

export async function suspendInstitutionMembership(input: {
  actorUserId: string;
  institutionId: string;
  targetUserId: string;
}): Promise<{ id: string; userId: string; role: InstitutionMembershipRole; status: string }> {
  const institutionId = parseInstitutionId(input.institutionId);
  const targetUserId = parseUserId(input.targetUserId);
  await requireInstitutionAdmin(input.actorUserId, institutionId);
  if (targetUserId === input.actorUserId) {
    throw new InstitutionError(400, 'Administrators cannot suspend their own membership here');
  }
  const target = await InstitutionMembership.findOne({
    institutionId,
    userId: targetUserId,
    status: 'active'
  });
  if (!target) throw new InstitutionError(404, 'Active membership not found');
  if (target.role === 'university_admin') {
    throw new InstitutionError(403, 'Administrator membership requires platform setup');
  }
  const updated = await InstitutionMembership.findOneAndUpdate(
    { _id: target._id, status: 'active' },
    { $set: { status: 'suspended' } },
    { new: true }
  );
  if (!updated) throw new InstitutionError(409, 'Membership changed concurrently; retry');
  return {
    id: String(updated._id),
    userId: updated.userId,
    role: updated.role,
    status: updated.status
  };
}
