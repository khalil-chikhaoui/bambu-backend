// src/controllers/notifications.controller.js
import asyncHandler from "express-async-handler";
import Notification from "../models/chat/Notification.js";

// @desc    Get user's notifications (unread first, then sorted by newest, limit 20)
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req, res) => {
  const { orgId } = req.query;
  const query = { recipient: req.user._id };

  if (orgId) {
    query.organizationId = orgId;
  }

  const notifications = await Notification.find(query)
    .populate("sender", "firstName lastName email profileImage")
    .sort({ isRead: 1, createdAt: -1 })
    .limit(20);

  res.status(200).json(notifications);
});

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOne({
    _id: id,
    recipient: req.user._id,
  });

  if (!notification) {
    res.status(404);
    throw new Error("NOTIFICATION_NOT_FOUND");
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json(notification);
});

// @desc    Mark all unread notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req, res) => {
  const { orgId } = req.body;
  const query = { recipient: req.user._id, isRead: false };

  if (orgId) {
    query.organizationId = orgId;
  }

  await Notification.updateMany(query, { $set: { isRead: true } });

  res.status(200).json({ message: "ALL_NOTIFICATIONS_MARKED_READ" });
});
