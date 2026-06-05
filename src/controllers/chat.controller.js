// src/controllers/chat.controller.js
import asyncHandler from "express-async-handler";
import Conversation from "../models/chat/Conversation.js";
import Message from "../models/chat/Message.js";
import { sendRealtimeMessage } from "../config/socket.js";

// @desc    Get all conversations for a user in the current organization
// @route   GET /api/organizations/:orgId/chat
// @access  Private
export const getConversations = asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  const conversations = await Conversation.find({
    organizationId: orgId,
    participants: req.user._id,
  })
    .populate("participants", "firstName lastName email profileImage")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "firstName lastName email profileImage" },
    })
    .sort({ updatedAt: -1 });

  res.status(200).json(conversations);
});

// @desc    Get messages in a conversation (paginated, chronological order)
// @route   GET /api/organizations/:orgId/chat/:convId/messages
// @access  Private
export const getMessages = asyncHandler(async (req, res) => {
  const { orgId, convId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  // Verify conversation belongs to the org and user is a participant
  const conversation = await Conversation.findOne({
    _id: convId,
    organizationId: orgId,
    participants: req.user._id,
  });

  if (!conversation) {
    res.status(404);
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  // Mark all unread messages in this conversation as read by this user
  await Message.updateMany(
    {
      conversationId: convId,
      sender: { $ne: req.user._id },
      "readBy.user": { $ne: req.user._id },
    },
    {
      $push: { readBy: { user: req.user._id, readAt: new Date() } },
    }
  );

  const messages = await Message.find({ conversationId: convId })
    .populate("sender", "firstName lastName email profileImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Reverse so they are returned in chronological order
  res.status(200).json(messages.reverse());
});

// @desc    Create a new conversation (DM or Group)
// @route   POST /api/organizations/:orgId/chat
// @access  Private
export const createConversation = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { participantIds, isGroup, name } = req.body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400);
    throw new Error("PARTICIPANTS_REQUIRED");
  }

  // Ensure current user is in participants list
  const allParticipants = Array.from(
    new Set([req.user._id.toString(), ...participantIds.map(id => id.toString())])
  );

  // If 1-to-1 conversation, check if it already exists
  if (!isGroup && allParticipants.length === 2) {
    const existing = await Conversation.findOne({
      organizationId: orgId,
      isGroup: false,
      participants: { $all: allParticipants, $size: 2 },
    })
      .populate("participants", "firstName lastName email profileImage")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "firstName lastName email profileImage" },
      });

    if (existing) {
      return res.status(200).json(existing);
    }
  }

  const newConv = await Conversation.create({
    organizationId: orgId,
    participants: allParticipants,
    isGroup: !!isGroup,
    name: name || undefined,
  });

  const populatedConv = await Conversation.findById(newConv._id)
    .populate("participants", "firstName lastName email profileImage");

  res.status(201).json(populatedConv);
});

// @desc    Send a new message in a conversation
// @route   POST /api/organizations/:orgId/chat/:convId/messages
// @access  Private
export const sendMessage = asyncHandler(async (req, res) => {
  const { orgId, convId } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    res.status(400);
    throw new Error("MESSAGE_CONTENT_REQUIRED");
  }

  // Verify conversation and user participation
  const conversation = await Conversation.findOne({
    _id: convId,
    organizationId: orgId,
    participants: req.user._id,
  });

  if (!conversation) {
    res.status(404);
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  const message = await Message.create({
    conversationId: convId,
    sender: req.user._id,
    content,
  });

  // Update conversation's lastMessage reference
  conversation.lastMessage = message._id;
  await conversation.save();

  const populatedMessage = await Message.findById(message._id)
    .populate("sender", "firstName lastName email profileImage");

  // Send real-time event via Socket
  sendRealtimeMessage(conversation.participants, populatedMessage);

  res.status(201).json(populatedMessage);
});

// @desc    Mark all messages in a conversation as read
// @route   PATCH /api/organizations/:orgId/chat/:convId/read
// @access  Private
export const markConversationAsRead = asyncHandler(async (req, res) => {
  const { orgId, convId } = req.params;

  const conversation = await Conversation.findOne({
    _id: convId,
    organizationId: orgId,
    participants: req.user._id,
  });

  if (!conversation) {
    res.status(404);
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  await Message.updateMany(
    {
      conversationId: convId,
      sender: { $ne: req.user._id },
      "readBy.user": { $ne: req.user._id },
    },
    {
      $push: { readBy: { user: req.user._id, readAt: new Date() } },
    }
  );

  res.status(200).json({ message: "CONVERSATION_MARKED_READ" });
});
