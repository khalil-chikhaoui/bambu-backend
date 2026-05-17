// src/models/hr/HRDocument.js
import mongoose from "mongoose";

const hrDocumentSchema = new mongoose.Schema(
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
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Traces who uploaded it (Manager vs Employee)
    },
    
    // User requested fields
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    description: { 
      type: String,
      trim: true
    },


    // Permet d'envoyer des alertes RH (ex: "Titre de séjour expire dans 30 jours")
    expirationDate: { 
      type: Date 
    },
    
    type: {
      type: String,
      enum: [
        "PIECE_IDENTITE", 
        "RIB", 
        "CONTRAT_SIGNE", 
        "FICHE_PAIE", 
        "VISITE_MEDICALE", 
        "ARRET_MALADIE",
        "AUTRE"
      ],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    
  },
  { timestamps: true }
);

export default mongoose.model("HRDocument", hrDocumentSchema);