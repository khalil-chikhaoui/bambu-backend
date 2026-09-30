// src/controllers/resources.controller.js
import asyncHandler from "express-async-handler";
import { v2 as cloudinary } from "cloudinary";
import DownloadableResource from "../models/DownloadableResource.js";

// Lazy Cloudinary config (env vars aren't available at import time due to ES module hoisting)
let cloudinaryConfigured = false;
function ensureCloudinary() {
  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    cloudinaryConfigured = true;
  }
}

/**
 * Helper: detect file type from extension
 */
function detectFileType(fileName) {
  const ext = fileName.split(".").pop().toUpperCase();
  const supported = ["PDF", "DOCX", "XLSX", "PPTX", "CSV", "ZIP"];
  return supported.includes(ext) ? ext : "OTHER";
}

/**
 * Helper: format label from type
 */
function formatLabelFromType(type) {
  const labels = {
    PDF: "Document PDF",
    DOCX: "Modèle Word",
    XLSX: "Tableau Excel",
    PPTX: "Présentation PowerPoint",
    CSV: "Fichier CSV",
    ZIP: "Archive ZIP",
    OTHER: "Fichier",
  };
  return labels[type] || "Fichier";
}

/**
 * @desc    Get all active downloadable resources (public)
 * @route   GET /api/resources
 * @access  Public
 */
export const getResources = asyncHandler(async (req, res) => {
  const resources = await DownloadableResource.find({ isActive: true }).sort({
    order: 1,
  });

  res.status(200).json({
    status: "success",
    data: resources,
  });
});

/**
 * @desc    Get ALL resources including inactive (admin)
 * @route   GET /api/resources/admin
 * @access  Admin (password-gated on frontend)
 */
export const getAllResourcesAdmin = asyncHandler(async (req, res) => {
  const resources = await DownloadableResource.find().sort({ order: 1 });

  res.status(200).json({
    status: "success",
    data: resources,
  });
});

/**
 * @desc    Create a new downloadable resource with file upload
 * @route   POST /api/resources
 * @access  Admin
 */
export const createResource = asyncHandler(async (req, res) => {
  ensureCloudinary();
  const { title, short_description, fileData, fileName, order } = req.body;

  if (!title || !short_description || !fileData || !fileName) {
    res.status(400);
    throw new Error("MISSING_FIELDS");
  }

  // Upload file to Cloudinary (raw for non-image files)
  const uploadResult = await cloudinary.uploader.upload(fileData, {
    resource_type: "raw",
    folder: "bambu-resources",
    public_id: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    use_filename: true,
    unique_filename: false,
  });

  const type = detectFileType(fileName);

  // Calculate file size from Cloudinary response
  const bytes = uploadResult.bytes;
  let fileSize;
  if (bytes >= 1024 * 1024) {
    fileSize = `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  } else {
    fileSize = `${Math.round(bytes / 1024)} Ko`;
  }

  // Determine order: if not provided, place at end
  let resourceOrder = order;
  if (resourceOrder === undefined || resourceOrder === null) {
    const lastResource = await DownloadableResource.findOne().sort({
      order: -1,
    });
    resourceOrder = lastResource ? lastResource.order + 1 : 0;
  }

  const resource = await DownloadableResource.create({
    title,
    short_description,
    type,
    formatLabel: formatLabelFromType(type),
    fileSize,
    fileUrl: uploadResult.secure_url,
    fileName,
    cloudinaryPublicId: uploadResult.public_id,
    order: resourceOrder,
    isActive: true,
  });

  res.status(201).json({
    status: "success",
    data: resource,
  });
});

/**
 * @desc    Update a downloadable resource
 * @route   PUT /api/resources/:id
 * @access  Admin
 */
export const updateResource = asyncHandler(async (req, res) => {
  ensureCloudinary();
  const resource = await DownloadableResource.findById(req.params.id);

  if (!resource) {
    res.status(404);
    throw new Error("RESOURCE_NOT_FOUND");
  }

  const { title, short_description, fileData, fileName, order, isActive } =
    req.body;

  // If a new file is uploaded, replace the old one
  if (fileData && fileName) {
    // Delete old file from Cloudinary
    if (resource.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(resource.cloudinaryPublicId, {
          resource_type: "raw",
        });
      } catch (err) {
        console.log("Failed to delete old Cloudinary file:", err.message);
      }
    }

    // Upload new file
    const uploadResult = await cloudinary.uploader.upload(fileData, {
      resource_type: "raw",
      folder: "bambu-resources",
      public_id: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      use_filename: true,
      unique_filename: false,
    });

    const type = detectFileType(fileName);
    const bytes = uploadResult.bytes;
    let fileSize;
    if (bytes >= 1024 * 1024) {
      fileSize = `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    } else {
      fileSize = `${Math.round(bytes / 1024)} Ko`;
    }

    resource.type = type;
    resource.formatLabel = formatLabelFromType(type);
    resource.fileSize = fileSize;
    resource.fileUrl = uploadResult.secure_url;
    resource.fileName = fileName;
    resource.cloudinaryPublicId = uploadResult.public_id;
  }

  if (title !== undefined) resource.title = title;
  if (short_description !== undefined)
    resource.short_description = short_description;
  if (order !== undefined) resource.order = order;
  if (isActive !== undefined) resource.isActive = isActive;

  const updated = await resource.save();

  res.status(200).json({
    status: "success",
    data: updated,
  });
});

/**
 * @desc    Delete a downloadable resource
 * @route   DELETE /api/resources/:id
 * @access  Admin
 */
export const deleteResource = asyncHandler(async (req, res) => {
  ensureCloudinary();
  const resource = await DownloadableResource.findById(req.params.id);

  if (!resource) {
    res.status(404);
    throw new Error("RESOURCE_NOT_FOUND");
  }

  // Delete file from Cloudinary
  if (resource.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(resource.cloudinaryPublicId, {
        resource_type: "raw",
      });
    } catch (err) {
      console.log("Failed to delete Cloudinary file:", err.message);
    }
  }

  await DownloadableResource.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: "success",
    message: "RESOURCE_DELETED",
  });
});

/**
 * @desc    Reorder resources (batch update)
 * @route   PUT /api/resources/reorder
 * @access  Admin
 */
export const reorderResources = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    res.status(400);
    throw new Error("INVALID_ORDER_DATA");
  }

  // Update each resource's order based on position in array
  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { order: index },
    },
  }));

  await DownloadableResource.bulkWrite(bulkOps);

  const resources = await DownloadableResource.find().sort({ order: 1 });

  res.status(200).json({
    status: "success",
    data: resources,
  });
});
