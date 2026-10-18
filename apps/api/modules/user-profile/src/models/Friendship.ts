import mongoose, { Document, Model, Schema } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface IFriendship extends Document {
  requester: string;
  recipient: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const friendshipSchema = new Schema<IFriendship>(
  {
    requester: { type: String, required: true, index: true },
    recipient: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
      default: 'pending',
      index: true
    }
  },
  { timestamps: true }
);

// One request per pair
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

const Friendship =
  (mongoose.models.Friendship as Model<IFriendship>) ||
  mongoose.model<IFriendship>('Friendship', friendshipSchema);

export default Friendship;
module.exports = Friendship;
