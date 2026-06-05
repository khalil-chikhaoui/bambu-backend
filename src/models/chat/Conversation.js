// src/models/chat/Conversation.js
import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String, // Group chat name (optional)
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true }
);

// Index to quickly search for conversation containing exact set of participants
conversationSchema.index({ organizationId: 1, participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
