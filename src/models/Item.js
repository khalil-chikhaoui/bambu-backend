import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true }, // Stock Keeping Unit
    category: { type: String, required: true }, // e.g., "IT", "Tools", "Office" ... 
    currentQuantity: { type: Number, required: true, default: 0, min: 0 },
    minThreshold: { type: Number, required: true, default: 5 },
  },
  { timestamps: true },
);

export default mongoose.model("Item", itemSchema);
