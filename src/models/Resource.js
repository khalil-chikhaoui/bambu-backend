import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["VEHICLE", "ROOM", "EQUIPMENT", "OTHER"], 
      required: true 
    },
    isActive: { type: Boolean, default: true },
    // Flexible metadata for specific types (e.g., license plate for cars, capacity for rooms)
    details: { type: mongoose.Schema.Types.Mixed }, 
  },
  { timestamps: true }
);

export default mongoose.model("Resource", resourceSchema);