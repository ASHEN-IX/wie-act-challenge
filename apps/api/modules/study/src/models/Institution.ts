import { Document, Model, Schema, Types, model, models } from 'mongoose';

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

export interface IInstitution {
  name: string;
  slug: string;
  domain?: string;
  isVerified: boolean;
  status: 'active' | 'suspended';
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstitutionMembership {
  institutionId: Types.ObjectId;
  userId: string;
  role: InstitutionMembershipRole;
  status: InstitutionMembershipStatus;
  invitedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstitutionInvitation {
  institutionId: Types.ObjectId;
  role: InstitutionInvitationRole;
  tokenHash: string;
  status: InstitutionInvitationStatus;
  issuedByUserId: string;
  acceptedByUserId?: string;
  acceptedAt?: Date;
  revokedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InstitutionDocument = IInstitution & Document & { _id: Types.ObjectId };
export type InstitutionMembershipDocument = IInstitutionMembership &
  Document & { _id: Types.ObjectId };
export type InstitutionInvitationDocument = IInstitutionInvitation &
  Document & { _id: Types.ObjectId };

const institutionSchema = new Schema<IInstitution>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 80
    },
    domain: { type: String, trim: true, lowercase: true, maxlength: 253 },
    isVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
    createdByUserId: { type: String, required: true }
  },
  { collection: 'institutions', timestamps: true }
);

const institutionMembershipSchema = new Schema<IInstitutionMembership>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true
    },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: INSTITUTION_MEMBERSHIP_ROLES, required: true },
    status: {
      type: String,
      enum: INSTITUTION_MEMBERSHIP_STATUSES,
      default: 'active',
      required: true
    },
    invitedByUserId: { type: String }
  },
  { collection: 'institution_memberships', timestamps: true }
);

institutionMembershipSchema.index({ institutionId: 1, userId: 1 }, { unique: true });

const institutionInvitationSchema = new Schema<IInstitutionInvitation>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true
    },
    role: { type: String, enum: INSTITUTION_INVITATION_ROLES, required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: INSTITUTION_INVITATION_STATUSES,
      default: 'pending',
      required: true
    },
    issuedByUserId: { type: String, required: true },
    acceptedByUserId: { type: String },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true }
  },
  { collection: 'institution_invitations', timestamps: true }
);

// Invitations are independent bearer capabilities: a university normally needs
// many simultaneous student/instructor invitations. The token hash is the only
// uniqueness key. Recipient binding is intentionally absent until the product
// contract defines it, so duplicate issuance to the same person cannot be
// detected here; an administrator must revoke an unwanted pending capability.
institutionInvitationSchema.index({ institutionId: 1, status: 1, expiresAt: 1 });

const Institution =
  (models.Institution as Model<IInstitution>) ||
  model<IInstitution>('Institution', institutionSchema, 'institutions');
const InstitutionMembership =
  (models.InstitutionMembership as Model<IInstitutionMembership>) ||
  model<IInstitutionMembership>(
    'InstitutionMembership',
    institutionMembershipSchema,
    'institution_memberships'
  );
const InstitutionInvitation =
  (models.InstitutionInvitation as Model<IInstitutionInvitation>) ||
  model<IInstitutionInvitation>(
    'InstitutionInvitation',
    institutionInvitationSchema,
    'institution_invitations'
  );

export { Institution, InstitutionMembership, InstitutionInvitation };
