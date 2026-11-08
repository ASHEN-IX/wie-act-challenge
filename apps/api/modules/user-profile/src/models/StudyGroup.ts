import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * A small, reusable set of learners who study together.
 *
 * Deliberately minimal: a name, a subject, an owner, members and pending
 * invites. It has no messaging (Study Together chat covers that) and grants no
 * access to anything. Joining a group never opens a course, a document or an
 * institution's data; course-bound rooms still check enrollment on join.
 */
export interface IStudyGroup extends Document {
  groupId: string;
  name: string;
  subject: string;
  ownerId: string;
  members: Array<{ userId: string; joinedAt: Date }>;
  invites: Array<{ userId: string; invitedBy: string; createdAt: Date }>;
  /** Last shared study room, so members can rejoin; cleared when stale. */
  activeSession?: {
    roomId: string;
    title: string;
    inviteCode: string;
    startedBy: string;
    startedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_GROUP_MEMBERS = 10;
export const MAX_GROUP_INVITES = 10;
export const MAX_OWNED_GROUPS = 10;

const schema = new Schema<IStudyGroup>(
  {
    groupId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    subject: { type: String, trim: true, maxlength: 60, default: '' },
    ownerId: { type: String, required: true, index: true },
    members: [
      new Schema(
        { userId: { type: String, required: true }, joinedAt: { type: Date, default: Date.now } },
        { _id: false }
      )
    ],
    invites: [
      new Schema(
        {
          userId: { type: String, required: true },
          invitedBy: { type: String, required: true },
          createdAt: { type: Date, default: Date.now }
        },
        { _id: false }
      )
    ],
    activeSession: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: 'study_groups' }
);
schema.index({ 'members.userId': 1 });
schema.index({ 'invites.userId': 1 });

const StudyGroup =
  (mongoose.models.StudyGroup as Model<IStudyGroup>) ||
  mongoose.model<IStudyGroup>('StudyGroup', schema);

export default StudyGroup;
module.exports = StudyGroup;
