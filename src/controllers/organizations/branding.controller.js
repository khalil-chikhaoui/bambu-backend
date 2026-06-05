// src/controllers/organizations/branding.controller.js
import asyncHandler from "express-async-handler";
import Organization from "../../models/Organization.js";
import { v2 as cloudinary } from "cloudinary";
import { logAudit } from "../../middlewares/audit.service.js";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const confirmOrganizationLogo = asyncHandler(async (req, res) => {
  const { secureUrl, publicId } = req.body;

  if (!secureUrl || !publicId) {
    res.status(400);
    throw new Error("UPLOAD_MISSING_DATA");
  }

  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  // Delete previous logo from Cloudinary if different
  if (organization.logoPublicId && organization.logoPublicId !== publicId) {
    try {
      await cloudinary.uploader.destroy(organization.logoPublicId);
    } catch (err) {
      console.log("Failed to delete old organization logo from Cloudinary:", err.message);
    }
  }

  organization.logo = secureUrl;
  organization.logoPublicId = publicId;
  await organization.save();

  logAudit({
    organizationId: organization._id,
    actor: req.user._id,
    module: "SETTINGS",
    action: "ORG_LOGO_UPLOADED",
    targetModel: "Organization",
    targetId: organization._id,
  });

  res.status(200).json({
    message: "LOGO_UPLOADED",
    logo: organization.logo,
  });
});

export const deleteOrganizationLogo = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  if (organization.logoPublicId) {
    try {
      await cloudinary.uploader.destroy(organization.logoPublicId);
    } catch (error) {
      console.log("Cloudinary Organization Logo Delete Error:", error.message);
    }
  }

  organization.logo = "";
  organization.logoPublicId = "";
  await organization.save();

  logAudit({
    organizationId: organization._id,
    actor: req.user._id,
    module: "SETTINGS",
    action: "ORG_LOGO_DELETED",
    targetModel: "Organization",
    targetId: organization._id,
  });

  res.json({ message: "LOGO_REMOVED", logo: "" });
});
