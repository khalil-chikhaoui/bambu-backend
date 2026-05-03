import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { 
  deleteUserAvatar, 
  forgotPassword, 
  getProfile, 
  resetPassword, 
  signIn, 
  updateProfile,
  uploadUserAvatar,
  validateResetToken, 
} from "../controllers/users.controller.js";
import rateLimit from "express-rate-limit";
import { uploadUserAvatar as avatarUploadMiddleware } from "../config/localUpload.js";

const router = Router();

// --- RATE LIMITERS ---
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, 
  message: { message: "Trop de requêtes. Veuillez réessayer plus tard." },
});

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

router.post("/avatar", avatarUploadMiddleware.single("avatar"), uploadUserAvatar);
router.delete("/avatar", deleteUserAvatar);

export default router;