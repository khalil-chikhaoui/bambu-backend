import mongoose from "mongoose";

const memberHistorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    action: {
      type: String,
      enum: [
        // --- Actions sur les membres ---
        "INVITE_SENT",       // X a invité Y
        "INVITE_ACCEPTED",   // Y a accepté l'invitation
        "INVITE_CANCELLED",  // X a annulé l'invitation de Y
        "ROLE_UPDATED",      // X a changé le rôle de Y
        "MEMBER_REMOVED",    // X a supprimé Y
        "MEMBER_LEFT",       // X a quitté l'organisation
        
        // --- Actions sur l'organisation ---
        "ORG_UPDATED",           // X a modifié les paramètres généraux
        "ORG_ADDRESS_UPDATED",   // X a modifié l'adresse
        "ORG_LOGO_UPLOADED",     // X a ajouté/modifié le logo
        "ORG_LOGO_DELETED",      // X a supprimé le logo
      ],
      required: true,
    },
    // Celui qui effectue l'action (Admin ou l'utilisateur lui-même)
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Celui qui subit l'action (le membre)
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // L'email cible (très utile pour les invitations)
    targetEmail: {
      type: String,
    },
    // Données supplémentaires 
    details: {
      role: String,
      oldRole: String,
      changedFields: [String], // Nouveau : pour lister ce qui a changé (ex: ["name", "email"])
    },
  },
  {
    timestamps: true, // Gère automatiquement createdAt
  }
);

export default mongoose.model("MemberHistory", memberHistorySchema);