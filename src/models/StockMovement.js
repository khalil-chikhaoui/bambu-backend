import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    type: { type: String, enum: ["IN", "OUT", "CREATED", "UPDATED", "DELETED"], required: true },
    quantity: { type: Number, required: true, default: 0 }, 
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    notes: { type: String },

    // track changes
    diff: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

export default mongoose.model("StockMovement", stockMovementSchema);