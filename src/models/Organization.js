import mongoose from "mongoose";

/**
 * @description Organization Schema for the ERP system.
 * Represents a primary company, branch, or entity using the platform.
 */
const organizationSchema = new mongoose.Schema(
  {
    // --- Identity & Branding ---
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
    legalName: { 
      type: String,
      trim: true 
    },
    description: { 
      type: String,
      trim: true 
    },
    logo: { 
      type: String,
      default: "" 
    },
    
    // --- System Limits ---
    maxMembers: { 
      type: Number, 
      required: true,
    },

    // --- Contact Information ---
    email: { 
      type: String,
      lowercase: true,
      trim: true
    },
    
    website: { 
      type: String,
      trim: true 
    },

    phoneNumber: {
      country: { type: String, default: "FR" }, // Default ISO Code 
      number: { type: String, default: "" },    // e.g. "+33 6 00 00 00 00"
    },

    // --- Geographic Location ---
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    // --- Regulatory Information ---
    taxId: { type: String, default: "" }, // e.g., Numéro de TVA intracommunautaire
    registrationNumber: { type: String, default: "" }, // e.g., SIRET/SIREN

   
    // --- Online Presence ---
    socialLinks: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },

  
    timezone: { type: String, default: "Europe/Paris" },
  },
  { 
    timestamps: true 
  }
);

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;