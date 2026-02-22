import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES } from "../config/constants.js";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    profileImage: { type: String, default: "" },

    // --- NEW LOCALIZATION FIELD ---
    language: {
      type: String,
      enum: ["en", "fr"],
      default: "en", // Default fallback if frontend sends nothing
    },
    
    // --- NEW VERIFICATION FIELDS ---
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
    },
    verificationCodeExpires: {
      type: Date,
    },

    memberships: [
      {
        businessId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Business",
          required: true,
        },
        role: {
          type: String,
          enum: Object.values(ROLES),
          default: ROLES.VIEWER,
        },
        title: { type: String, default: "Staff" },
      },
    ],
  },
  { timestamps: true },
);

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.pre("save", async function () {
  // If password is not modified, just return (Promise resolves automatically)
  if (!this.isModified("password")) {
    return;
  }
  // Otherwise hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.model("User", UserSchema);
