// models/MemberHistory.js
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
        "INVITE_SENT",       // X a invité Y
        "INVITE_ACCEPTED",   // Y a accepté l'invitation
        "INVITE_CANCELLED",  // X a annulé l'invitation de Y
        "ROLE_UPDATED",      // X a changé le rôle de Y
        "MEMBER_REMOVED",    // X a supprimé Y
        "MEMBER_LEFT",       // X a quitté l'organisation
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
    // L'email cible (très utile pour les invitations car le 'targetUser' n'a pas encore de compte)
    targetEmail: {
      type: String,
    },
    // Données supplémentaires (ex: quel était l'ancien rôle, quel est le nouveau)
    details: {
      role: String,
      oldRole: String,
    },
  },
  {
    timestamps: true, // Gère automatiquement createdAt
  }
);

export default mongoose.model("MemberHistory", memberHistorySchema);