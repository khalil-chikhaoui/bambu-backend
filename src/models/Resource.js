import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true }, // e.g., "Conference Room A", "Ford Transit 01"
    type: { type: String, enum: ["ROOM", "VEHICLE", "EQUIPMENT"], required: true },
    capacity: { type: Number }, // Number of seats, payload size, etc.
    status: { type: String, enum: ["ACTIVE", "MAINTENANCE", "RETIRED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

export default mongoose.model("Resource", resourceSchema);