import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { 
  deleteUserAvatar, forgotPassword, getProfile, 
  registerUser, resendVerificationCode, resetPassword, signIn, 
  updateProfile, 
  verifyEmail
} from "../controllers/users.controller.js";
import rateLimit from "express-rate-limit";

const router = Router();




// --- RATE LIMITERS ---
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, 
  message: { message: "Too many requests. Please try again later." },
});

/**
 * Public Authentication Routes
 */
router.post("/signin", signIn);
router.post("/signup", registerUser);

router.post("/verify-email", verifyEmail);
router.post("/resend-verification", emailLimiter, resendVerificationCode);

router.post("/forgot-password", emailLimiter, forgotPassword);
router.post("/reset-password", resetPassword);

/**
 * Protected User Routes
 */
router.use(protect);

router.route("/profile")
  .get(getProfile)
  .put(updateProfile);

router.delete("/avatar", deleteUserAvatar);

export default router;