import mongoose from "mongoose";

const ContactMessageSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      // Store keys, not translated strings
      enum: ["volunteer", "application", "partnership", "info", "service", "other"],
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    message: { type: String, required: true },
    language: { type: String, enum: ["en", "fr"], default: "en" },
    status: { type: String, enum: ["new", "read", "replied", "archived"], default: "new" },
  },
  { timestamps: true }
);

export default mongoose.model("ContactMessage", ContactMessageSchema);