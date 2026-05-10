// models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // The user who performed the action
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The application module (crucial for frontend filtering)
    module: {
      type: String,
      enum: [
        "TEAM", 
        "SETTINGS", 
        "PROJECTS", 
        "HR", 
        "FINANCE", 
        "INVENTORY", 
        "LOGISTICS",
       
      ], 
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true, // e.g., "INVITE_SENT", "ORG_ADDRESS_UPDATED"
    },
    // Polymorphic association (What was affected?)
    targetModel: {
      type: String, // e.g., "User", "Organization", "Invitation", "Project"
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    // Flexible data container for fast frontend rendering without complex joins
    metadata: {
      type: mongoose.Schema.Types.Mixed, 
      // ex: { targetEmail: "...", targetName: "...", role: "admin" }
    },
    // Strict change tracking
    diff: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

// Compound index: Super fast when fetching history for a specific org AND specific module
auditLogSchema.index({ organizationId: 1, module: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);