import { Router } from "express";
import { emailLimiter, protect } from "../middlewares/auth.js";
import { 
  signIn,
  forgotPassword,
  validateResetToken,
  resetPassword,
} from "../controllers/users/auth.controller.js";
import {
  getProfile,
  updateProfile,
  uploadUserAvatar,
  deleteUserAvatar,
} from "../controllers/users/profile.controller.js";
import { uploadUserAvatar as avatarUploadMiddleware } from "../config/localUpload.js";

const router = Router();



/**
 * Public Authentication Routes
 */
router.post("/signin", signIn);

router.post("/forgot-password", emailLimiter, forgotPassword);

router.get("/reset-password/:token", validateResetToken);
router.post("/reset-password", resetPassword);

/**
 * Protected User Routes
 */
router.use(protect);

router.route("/profile")
  .get(getProfile)
  .put(updateProfile);

router.post("/avatar", avatarUploadMiddleware.single("file"), uploadUserAvatar);
router.delete("/avatar", deleteUserAvatar);

export default router;