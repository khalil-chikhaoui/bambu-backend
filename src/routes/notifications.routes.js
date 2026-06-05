// src/routes/notifications.routes.js
import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notifications.controller.js";

const router = express.Router();

// All routes are private and user-specific
router.use(protect);

router.route("/")
  .get(getNotifications);

router.route("/read-all")
  .patch(markAllAsRead);

router.route("/:id/read")
  .patch(markAsRead);

export default router;
