import mongoose from "mongoose";

const downloadableResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    short_description: { type: String, required: true },
    type: {
      type: String,
      enum: ["PDF", "DOCX", "XLSX", "PPTX", "CSV", "ZIP", "OTHER"],
      required: true,
    },
    formatLabel: { type: String, required: true },
    fileSize: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    cloudinaryPublicId: { type: String, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

downloadableResourceSchema.index({ order: 1 });

export default mongoose.model("DownloadableResource", downloadableResourceSchema);
