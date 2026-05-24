import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    refCode: { type: String, unique: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
    },
    purpose: { type: String, required: true }, // Why they need it
    adminNotes: { type: String }, // For rejections or special instructions
  },
  { timestamps: true }
);

// Prevent fetching overlapping reservations easily
reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });

export default mongoose.model("Reservation", reservationSchema);