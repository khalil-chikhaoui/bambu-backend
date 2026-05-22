// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["admin", "employee"];

const UserSchema = new mongoose.Schema(
  {
    // --- Basic Information ---
    firstName: { 
      type: String, 
      required: true,
      trim: true
    },
    lastName: { 
      type: String, 
      required: true,
      trim: true
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true
    },
    password: { 
      type: String, 
      required: true 
    },
    profileImage: { 
      type: String, 
      default: "" 
    },

    // --- Organization Memberships ---
    memberships: [
      {
        organizationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organization", 
          required: true,
        },
        role: {
          type: String,
          enum: ROLES,
          default: "employee", 
        },
        title: { 
          type: String, 
          default: "Staff" 
        },
      },
    ],
  },
  { 
    timestamps: true 
  }
);

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.model("User", UserSchema);