import { Router } from "express";
import { protect } from "../middlewares/auth.js";

import {
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
} from "../controllers/organizations/organization.controller.js";
import {
  uploadOrganizationLogo,
  deleteOrganizationLogo,
} from "../controllers/organizations/branding.controller.js";
import {
  inviteMember,
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
  leaveOrganization,
  getMembersWithoutEmployeeRecord,
} from "../controllers/organizations/members.controller.js";
import {
  getOrganizationHistory,
} from "../controllers/organizations/history.controller.js";
import { uploadOrganizationLogo as logoUploadMiddleware } from "../config/localUpload.js";

const router = Router();

// ==========================================
// --- Organization Routes  ---
// ==========================================
// ALL PROTECTED
router.use(protect);

// --- Core Organization Profile ---
router.route("/:id")
  .get(getOrganizationById)
  .put(updateOrganization)
  .delete(deleteOrganization);

// --- Logo Management ---
router.post("/:id/upload-logo", logoUploadMiddleware.single("file"), uploadOrganizationLogo);
router.delete("/:id/logo", deleteOrganizationLogo);

// --- Team & Member Management ---
router.route("/:id/members")
  .get(getOrganizationMembers);

router.get("/:id/members-without-records", getMembersWithoutEmployeeRecord);

// ---  History ---
router.route("/:id/history")
  .get(getOrganizationHistory);

router.post("/:id/invite", inviteMember);

router.put("/:id/members/:memberId/role", updateMemberRole);
router.delete("/:id/members/:memberId", removeMember);

// --- Personal Member Actions ---
router.post("/:id/leave", leaveOrganization);

export default router; 