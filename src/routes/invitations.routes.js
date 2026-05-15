import { Router } from "express";
import { 
  validateInvitation,
} from "../controllers/invitations/validation.controller.js";
import {
  acceptInviteLogin,
  acceptInviteRegister,
} from "../controllers/invitations/acceptance.controller.js";

const router = Router();

/**
 * @route   GET /api/invitations/:token
 * @desc    Verify invitation token validity and check user existence
 */
router.get("/:token", validateInvitation);

/**
 * @route   POST /api/invitations/accept-login
 * @desc    Accept invite for existing users (Login flow)
 */
router.post("/accept-login", acceptInviteLogin);

/**
 * @route   POST /api/invitations/accept-register
 * @desc    Accept invite for new users (Signup flow)
 */
router.post("/accept-register", acceptInviteRegister);

export default router;