import asyncHandler from "express-async-handler";
import Resource from "../../models/Resource.js";
import { logAudit } from "../../middlewares/audit.service.js";

/**
 * @desc    Get all resources with filters (name, type)
 * @route   GET /api/resources
 */
export const getResources = asyncHandler(async (req, res) => {
  const { organizationId, search, type } = req.query;

  const query = { organizationId };
  if (search) query.name = new RegExp(search, "i");
  if (type) query.type = type;

  const resources = await Resource.find(query).sort({ name: 1 });
  res.json(resources);
});

/**
 * @desc    Create a new resource
 * @route   POST /api/resources
 */
export const createResource = asyncHandler(async (req, res) => {
  const { organizationId, name, type, details } = req.body;

  const resource = await Resource.create({
    organizationId,
    name,
    type,
    details,
  });

  await logAudit({
    organizationId,
    actor: req.user._id,
    module: "RESERVATIONS",
    action: "RESOURCE_CREATED",
    targetModel: "Resource",
    targetId: resource._id,
    metadata: { name: resource.name, type: resource.type },
  });

  res.status(201).json(resource);
});

/**
 * @desc    Update resource details
 * @route   PUT /api/resources/:id
 */
export const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    res.status(404);
    throw new Error("RESOURCE_NOT_FOUND");
  }

  const diff = { before: {}, after: {} };
  let hasChanges = false;

  const fieldsToCheck = ["name", "type", "isActive", "details"];
  fieldsToCheck.forEach((key) => {
    if (req.body[key] !== undefined && JSON.stringify(req.body[key]) !== JSON.stringify(resource[key])) {
      diff.before[key] = resource[key];
      diff.after[key] = req.body[key];
      resource[key] = req.body[key];
      hasChanges = true;
    }
  });

  const updatedResource = await resource.save();

  if (hasChanges) {
    await logAudit({
      organizationId: resource.organizationId,
      actor: req.user._id,
      module: "RESERVATIONS",
      action: "RESOURCE_UPDATED",
      targetModel: "Resource",
      targetId: resource._id,
      diff,
    });
  }

  res.json(updatedResource);
});