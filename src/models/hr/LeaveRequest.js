// src/models/hr/LeaveRequest.js
import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: [
        "CP",               // Congés Payés
        "RTT",              // Réduction Temps de Travail
        "MALADIE",          // Congé Maladie (Requires documentUrl)
        "SANS_SOLDE",       // Congé Sans Solde
        "MATERNITE_PATERNITE", 
        "EVENEMENT_FAMILIAL" // Mariage, Décès, etc.
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    
    // Dates & Duration
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isHalfDayStart: { type: Boolean, default: false }, // "Matin" or "Après-midi"
    isHalfDayEnd: { type: Boolean, default: false },
    totalDays: { type: Number, required: true }, // The calculated business days taken

    // Metadata
    reason: { type: String }, // Optional explanation from employee
    documentUrl: { type: String }, // Mandatory if type === "MALADIE"
    
    // Approval Tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    managerComment: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("LeaveRequest", leaveRequestSchema);