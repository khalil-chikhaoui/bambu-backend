import { Router } from "express";
import { protect } from "../middlewares/auth.js";

import {
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  uploadOrganizationLogo,
  deleteOrganizationLogo,
  inviteMember,
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
  leaveOrganization,
  getOrganizationHistory,
} from "../controllers/organizations.controller.js";
import { uploadOrganizationLogo as logoUploadMiddleware } from "../config/localUpload.js";

const router = Router();

// ==========================================
// --- All Organization Routes are Protected ---
// ==========================================
router.use(protect);

// --- Core Organization Profile ---
router.route("/:id")
  .get(getOrganizationById)
  .put(updateOrganization)
  .delete(deleteOrganization);

// --- Logo Management ---
// Expects form-data with a file field named 'logo'
router.post("/:id/upload-logo", logoUploadMiddleware.single("file"), uploadOrganizationLogo);
router.delete("/:id/logo", deleteOrganizationLogo);

// --- Team & Member Management ---
router.route("/:id/members")
  .get(getOrganizationMembers);

// ---  Members History ---
router.route("/:id/history")
  .get(getOrganizationHistory);

router.post("/:id/invite", inviteMember);

router.put("/:id/members/:memberId/role", updateMemberRole);
router.delete("/:id/members/:memberId", removeMember);

// --- Personal Member Actions ---
router.post("/:id/leave", leaveOrganization);

export default router;