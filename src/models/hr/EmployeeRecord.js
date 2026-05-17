import mongoose from "mongoose";

const employeeRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Identité Légale
    socialSecurityNumber: {
      type: String, 
      trim: true,
    },
    birthDate: { type: Date },
    birthPlace: { type: String },
    nationality: { type: String, default: "Française" },

    emergencyContact: {
      name: { type: String },
      relationship: { type: String },
      // FIXED: emergency contact phone is now an object
      phoneNumber: { 
        country: { type: String, default: "FR" },
        number: { type: String, default: "" },
      },
    },

    // Données Bancaires
    bankDetails: {
      iban: { type: String, trim: true },
      bic: { type: String, trim: true },
      bankName: { type: String },
    },

    // Mutuelle & Prévoyance
    assurances: {
      mutuelleStatus: {
        type: String,
        enum: ["AFFILIE", "DISPENSE", "EN_ATTENTE"],
        default: "EN_ATTENTE",
      },
      mutuelleType: {
        type: String,
        enum: ["ISOLE", "FAMILLE", "NONE"],
        default: "NONE",
      },
      affiliationDate: { type: Date },
    },

    // Coordonnées strictement RH
    personalContact: {
      email: { type: String, trim: true },
      // FIXED: Phone is now an object matching the User model
      phone: {
        country: { type: String, default: "FR" },
        number: { type: String, default: "" },
      },
    },

    // Adresse 
    address: {
      street: { type: String },
      city: { type: String },
      zipCode: { type: String },
      country: { type: String, default: "" },
    },

    // Situation Familiale 
    familySituation: {
      maritalStatus: {
        type: String,
        enum: ["CELIBATAIRE", "MARIE", "PACS", "DIVORCE", "VEUF"],
      },
      dependentsCount: { type: Number, default: 0 }, 
    },

    // Autorisation de travail 
    workAuthorization: {
      hasWorkPermit: { type: Boolean, default: true }, 
      documentType: { type: String }, 
      expirationDate: { type: Date },
    },

    // Soldes actuels 
    leaveBalances: {
      cpBalance: { type: Number, default: 0 }, 
      rttBalance: { type: Number, default: 0 }, 
    },
  },
  { timestamps: true },
);

employeeRecordSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export default mongoose.model("EmployeeRecord", employeeRecordSchema);