import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" }, // Nullable
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("StockMovement", stockMovementSchema); 