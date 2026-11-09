import type {
  Institution as InstitutionRow,
  InstitutionInvitation as InstitutionInvitationRow,
  InstitutionMembership as InstitutionMembershipRow
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export const INSTITUTION_MEMBERSHIP_ROLES = [
  'university_admin',
  'instructor',
  'university_student'
] as const;
export type InstitutionMembershipRole = (typeof INSTITUTION_MEMBERSHIP_ROLES)[number];

export const INSTITUTION_MEMBERSHIP_STATUSES = ['active', 'invited', 'suspended'] as const;
export type InstitutionMembershipStatus = (typeof INSTITUTION_MEMBERSHIP_STATUSES)[number];

export const INSTITUTION_INVITATION_ROLES = ['instructor', 'university_student'] as const;
export type InstitutionInvitationRole = (typeof INSTITUTION_INVITATION_ROLES)[number];

export const INSTITUTION_INVITATION_STATUSES = [
  'pending',
  'accepted',
  'revoked',
  'expired'
] as const;
export type InstitutionInvitationStatus = (typeof INSTITUTION_INVITATION_STATUSES)[number];

export type IInstitution = InstitutionRow & { id: string };
export type IInstitutionMembership = InstitutionMembershipRow & { id: string };
export type IInstitutionInvitation = InstitutionInvitationRow & { id: string };

export const Institution = table<IInstitution>({
  delegate: () => prisma.institution,
  defaults: () => ({ isVerified: false, status: 'active' }),
  columns: (row) => ({
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    isVerified: row.isVerified,
    status: row.status,
    createdByUserId: row.createdByUserId
  })
});

export const InstitutionMembership = table<IInstitutionMembership>({
  delegate: () => prisma.institutionMembership,
  defaults: () => ({ status: 'active' }),
  columns: (row) => ({
    institutionId: row.institutionId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    invitedByUserId: row.invitedByUserId
  })
});

export const InstitutionInvitation = table<IInstitutionInvitation>({
  delegate: () => prisma.institutionInvitation,
  defaults: () => ({ status: 'pending' }),
  columns: (row) => ({
    institutionId: row.institutionId,
    role: row.role,
    tokenHash: row.tokenHash,
    status: row.status,
    issuedByUserId: row.issuedByUserId,
    acceptedByUserId: row.acceptedByUserId,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt
  })
});

export default Institution;
