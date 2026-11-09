import type { Prisma } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { json, jsonOrNull } from './_helpers';

export const MAX_GROUP_MEMBERS = 10;
export const MAX_GROUP_INVITES = 10;
export const MAX_OWNED_GROUPS = 10;

export interface IStudyGroup {
  _id: string;
  id: string;
  groupId: string;
  name: string;
  subject: string;
  ownerId: string;
  /** Last shared study room, so members can rejoin; cleared when stale. */
  activeSession?: {
    roomId: string;
    title: string;
    inviteCode: string;
    startedBy: string;
    startedAt: Date;
  } | null;
  members: Array<{ userId: string; joinedAt: Date }>;
  invites: Array<{ userId: string; invitedBy: string; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const include = {
  members: { orderBy: { joinedAt: 'asc' as const } },
  invites: { orderBy: { createdAt: 'asc' as const } }
};

type GroupRow = Prisma.StudyGroupGetPayload<{ include: typeof include }>;

function hydrate(row: GroupRow): IStudyGroup {
  return toDocument(row) as unknown as IStudyGroup;
}

export const StudyGroup = {
  async findById(id: string): Promise<IStudyGroup | null> {
    const row = await prisma.studyGroup.findUnique({ where: { id }, include });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.StudyGroupWhereInput): Promise<IStudyGroup | null> {
    const row = await prisma.studyGroup.findFirst({ where, include });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.StudyGroupWhereInput = {},
    options: { take?: number; orderBy?: Prisma.StudyGroupOrderByWithRelationInput } = {}
  ): Promise<IStudyGroup[]> {
    const rows = await prisma.studyGroup.findMany({ where, include, ...options });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.StudyGroupWhereInput = {}): Promise<number> {
    return prisma.studyGroup.count({ where });
  },

  async exists(where: Prisma.StudyGroupWhereInput): Promise<boolean> {
    return (await prisma.studyGroup.findFirst({ where, select: { id: true } })) !== null;
  },

  async create(data: {
    groupId: string;
    name: string;
    subject?: string;
    ownerId: string;
    members?: Array<{ userId: string; joinedAt?: Date }>;
    invites?: Array<{ userId: string; invitedBy: string; createdAt?: Date }>;
  }): Promise<IStudyGroup> {
    const row = await prisma.studyGroup.create({
      data: {
        id: newId(),
        groupId: data.groupId,
        name: data.name,
        subject: data.subject ?? '',
        ownerId: data.ownerId,
        members: {
          create: (data.members ?? []).map((member) => ({
            id: newId(),
            userId: member.userId,
            joinedAt: member.joinedAt ?? new Date()
          }))
        },
        invites: {
          create: (data.invites ?? []).map((invite) => ({
            id: newId(),
            userId: invite.userId,
            invitedBy: invite.invitedBy,
            createdAt: invite.createdAt ?? new Date()
          }))
        }
      },
      include
    });
    return hydrate(row);
  },

  async updateOne(where: Prisma.StudyGroupWhereInput, data: Prisma.StudyGroupUpdateInput) {
    const result = await prisma.studyGroup.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async findOneAndUpdate(
    where: Prisma.StudyGroupWhereInput,
    data: Prisma.StudyGroupUpdateInput
  ): Promise<IStudyGroup | null> {
    const existing = await prisma.studyGroup.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    const row = await prisma.studyGroup.update({ where: { id: existing.id }, data, include });
    return hydrate(row);
  },

  async deleteOne(where: Prisma.StudyGroupWhereInput) {
    const existing = await prisma.studyGroup.findFirst({ where, select: { id: true } });
    if (!existing) return { deletedCount: 0 };
    await prisma.studyGroup.delete({ where: { id: existing.id } });
    return { deletedCount: 1 };
  },

  async addMember(groupId: string, userId: string): Promise<void> {
    await prisma.studyGroupMember.create({
      data: { id: newId(), groupId, userId }
    });
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    await prisma.studyGroupMember.deleteMany({ where: { groupId, userId } });
  },

  async addInvite(groupId: string, userId: string, invitedBy: string): Promise<void> {
    await prisma.studyGroupInvite.create({ data: { id: newId(), groupId, userId, invitedBy } });
  },

  async removeInvite(groupId: string, userId: string): Promise<void> {
    await prisma.studyGroupInvite.deleteMany({ where: { groupId, userId } });
  },

  async setActiveSession(groupId: string, activeSession: IStudyGroup['activeSession']) {
    await prisma.studyGroup.update({
      where: { id: groupId },
      data: { activeSession: activeSession ? json(activeSession) : jsonOrNull(null) }
    });
  }
};

export default StudyGroup;
