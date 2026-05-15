import asyncHandler from "express-async-handler";
import AuditLog from "../../models/AuditLog.js";

/**
 * @desc    Get organization history (audit logs) with pagination and module/target filtering
 * @route   GET /api/organizations/:id/history?module=TEAM&page=1&targetId=123
 * @access  Private
 */
export const getOrganizationHistory = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  const { page = 1, limit = 10, module, targetId, action } = req.query;
  const skip = (page - 1) * limit;

  // Base query for AuditLog
  const query = { organizationId };
  if (module) query.module = module;
  if (targetId) query.targetId = targetId;
  if (action) query.action = action;

  const totalItems = await AuditLog.countDocuments(query);

  const history = await AuditLog.find(query)
    .populate("actor", "firstName lastName email profileImage")
    .populate("targetId", "firstName lastName email profileImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    data: history,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit: Number(limit),
    },
  });
});
