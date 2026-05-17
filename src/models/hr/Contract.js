// src/models/hr/Contract.js
import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    employeeRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeRecord",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // Contract specifics
    type: {
      type: String,
      enum: ["CDI", "CDD", "ALTERNANCE", "STAGE", "FREELANCE"],
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "TERMINATED"],
      default: "DRAFT",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date }, // Required for CDD/Stage
    probationEndDate: { type: Date }, // Fin de période d'essai

    // Classification & Convention Collective
    classification: {
      status: { 
        type: String, 
        enum: ["CADRE", "EMPLOYE", "OUVRIER", "AGENT_DE_MAITRISE"] 
      },
      coefficient: { type: String },
      position: { type: String },
      conventionCollective: { type: String }, // e.g., "Syntec", "Métallurgie"
    },

    // Temps de travail
    workingTime: {
      type: {
        type: String,
        enum: ["TEMPS_PLEIN", "TEMPS_PARTIEL", "FORFAIT_JOURS"],
        required: true,
      },
      value: { type: Number }, // e.g., 35 (hours) or 218 (days)
    },


    // Lieu d'exécution du contrat
    workLocation: {
      isRemoteOnly: { type: Boolean, default: false },
      address: { type: String }, // Peut être l'adresse du siège par défaut
    },

    // Politique de Télétravail
    teleworkPolicy: {
      isAllowed: { type: Boolean, default: false },
      daysPerWeek: { type: Number, default: 0 },
    },

    // Entitlements (What the contract gives them per year)
    leaveEntitlements: {
      annualCpDays: { type: Number, default: 25 }, // Usually 25 in France
      annualRttDays: { type: Number, default: 0 }, // Depends on Forfait Jours
    },

    // Rémunération
    compensation: {
      baseSalary: { type: Number, required: true },
      currency: { type: String, default: "EUR" },
      frequency: { 
        type: String, 
        enum: ["MONTHLY", "ANNUAL", "HOURLY"], 
        default: "ANNUAL" 
      },
      transportAllowance: { type: Number, default: 50 }, // % of Pass Navigo
      mealVouchers: { type: Boolean, default: false }, // Tickets Restaurant
    },

    // Specific Clauses (Array of personalized strings or objects)
    clauses: [
      {
        title: { type: String }, // e.g., "Clause de non-concurrence"
        description: { type: String },
        isActive: { type: Boolean, default: true }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Contract", contractSchema);