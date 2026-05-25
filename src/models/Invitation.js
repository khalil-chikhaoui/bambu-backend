import mongoose from "mongoose";

/**
 * @description Stores pending invitations for users to join an organization.
 * Uses a TTL (Time To Live) index to auto-expire after 7 days.
 */
const invitationSchema = new mongoose.Schema({
  email: { type: String, required: true },

  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },

  role: {
    type: String,
    enum: ["admin", "employee"],
    default: "employee",
  },

  title: { type: String, default: "Staff" },
  token: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["Pending", "Accepted"],
    default: "Pending",
  },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800, // Document automatically removed by MongoDB after 7 days
  },
});

export default mongoose.model("Invitation", invitationSchema);
