// src/routes/chat.routes.js
import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  getConversations,
  getMessages,
  createConversation,
  sendMessage,
  markConversationAsRead,
  clearConversation,
} from "../controllers/chat.controller.js";

const router = express.Router({ mergeParams: true });

// All routes are private and organization-scoped
router.use(protect);

router.route("/")
  .get(getConversations)
  .post(createConversation);

router.route("/:convId/messages")
  .get(getMessages)
  .post(sendMessage);

router.route("/:convId/read")
  .patch(markConversationAsRead);

router.route("/:convId/clear")
  .delete(clearConversation);

export default router;
