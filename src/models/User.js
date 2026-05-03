import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * Define the base roles for the ERP. 
 * Kept simple for now as requested.
 */
const ROLES = ["admin", "employee"];

/**
 * User Schema for the ERP system.
 * Represents system users and their affiliations with various organizations.
 */
const UserSchema = new mongoose.Schema(
  {
    // --- Basic Information ---
    name: { 
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

    phoneNumber: {
      country: { type: String, default: "FR" },
      number: { type: String, default: "" },
    },

    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },


    // --- Organization Memberships ---
    // Replaced 'business' with 'organization' per the new domain model.
    // A user can be part of multiple organizations with different roles.
    memberships: [
      {
        organizationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organization", // Ensure you create an Organization model
          required: true,
        },
        role: {
          type: String,
          enum: ROLES,
          default: "employee", // Default role for a new organization member
        },
        title: { 
          type: String, 
          default: "Staff" 
        },
      },
    ],
  },
  { 
    timestamps: true // Automatically manages createdAt and updatedAt
  }
);

/**
 * Compares a plaintext password against the hashed password stored in the database.
 * 
 * @param {string} enteredPassword - The plain text password entered during login
 * @returns {Promise<boolean>} - Resolves to true if passwords match
 */
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Pre-save hook to automatically hash passwords before they hit the database.
 * This runs on creation and whenever the password field is modified.
 */
UserSchema.pre("save", async function () {
  // Skip hashing if the password field hasn't been modified
  if (!this.isModified("password")) {
    return;
  }
  
  // No need for 'next' in modern async Mongoose hooks
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.model("User", UserSchema);