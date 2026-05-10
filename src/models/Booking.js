import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    purpose: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "CANCELLED", "COMPLETED"], default: "APPROVED" },
  },
  { timestamps: true }
);

// Crucial index for fast collision detection queries
bookingSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });

export default mongoose.model("Booking", bookingSchema);