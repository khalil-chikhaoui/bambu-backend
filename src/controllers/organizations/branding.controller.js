// src/controllers/organizations/branding.controller.js
import asyncHandler from "express-async-handler";
import Organization from "../../models/Organization.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logAudit } from "../../middlewares/audit.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadOrganizationLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("UPLOAD_NO_FILE");
  }

  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    if (req.file.path) fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  if (organization.logo && organization.logo.includes("/api/images/")) {
    try {
      const oldFileName = organization.logo.split("/").pop();
      const storagePath =
        process.env.UPLOAD_PATH || path.join(__dirname, "../../../images");
      const oldPath = path.join(storagePath, "organizations", oldFileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (err) {
      console.log("Failed to delete old organization logo:", err.message);
    }
  }

  organization.logo = `${process.env.BACKEND_URL}/api/images/organizations/${req.file.filename}`;
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

  if (organization.logo && organization.logo.includes("/api/images/")) {
    try {
      const fileName = organization.logo.split("/").pop();
      const storagePath =
        process.env.UPLOAD_PATH || path.join(__dirname, "../../../images");
      const filePath = path.join(storagePath, "organizations", fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.log(
        "Persistent Organization Logo Delete Error:",
        error.message,
      );
    }
  }

  organization.logo = "";
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
