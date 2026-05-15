// services/audit.service.js
import AuditLog from "../models/AuditLog.js";

/**
 * Creates an audit log entry asynchronously.
 */
export const logAudit = async ({
  organizationId,
  actor,
  module,
  action,
  targetModel = null,
  targetId = null,
  metadata = {},
  diff = null,
}) => {
  try {
    await AuditLog.create({
      organizationId,
      actor,
      module,
      action,
      targetModel,
      targetId,
      metadata,
      diff,
    });
  } catch (error) {
    // We catch the error so it doesn't block the main API response
    console.log("❌ Failed to save AuditLog:", error.message);
  }
};
