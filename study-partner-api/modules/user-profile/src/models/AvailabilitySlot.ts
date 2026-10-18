import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAvailabilitySlot extends Document {
  userId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  label: string;
  isRecurring: boolean;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySlotSchema = new Schema<IAvailabilitySlot>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    isRecurring: {
      type: Boolean,
      default: true
    },
    color: {
      type: String,
      default: '#ff6b6b'
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
availabilitySlotSchema.index({ userId: 1, dayOfWeek: 1 });

const AvailabilitySlot =
  (mongoose.models.AvailabilitySlot as Model<IAvailabilitySlot>) ||
  mongoose.model<IAvailabilitySlot>('AvailabilitySlot', availabilitySlotSchema);

export default AvailabilitySlot;
module.exports = AvailabilitySlot;
