import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

import DownloadableResource from "./src/models/DownloadableResource.js";

// Load Environment Variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Path to the frontend docs folder
const DOCS_DIR = path.resolve(process.cwd(), "../newbambu/public/docs");

const RESOURCES_DATA = [
  {
    title: "Panorama des sources de financement",
    short_description:
      "Un panorama complet des principales ressources de financement mobilisables par une association loi 1901, détaillant les cotisations, le mécénat, les subventions publiques et les fonds européens.",
    type: "PDF",
    formatLabel: "Document PDF",
    localFile: "Tableau_sources_financement_association_1901_BAMBU.pdf",
    order: 0,
  },
  {
    title: "Fiche d'audit mécénat",
    short_description:
      "Un outil d'auto-diagnostic en 5 étapes pour vérifier l'éligibilité d'une association au mécénat, évaluer la maturité de son projet, sécuriser son budget et structurer sa demande de soutien.",
    type: "PDF",
    formatLabel: "Document PDF",
    localFile: "Fiche_audit_mecenat_on_se_lance_BAMBU.pdf",
    order: 1,
  },
  {
    title: "Modèles de fiche projet et argumentaire",
    short_description:
      "Des modèles prêts à l'emploi pour planifier un projet, incluant une trame de présentation, des argumentaires personnalisables, des scripts d'e-mails et un plan de ciblage de prospection sur 30 jours.",
    type: "DOCX",
    formatLabel: "Modèle Word",
    localFile: "FICHE PROJET.docx",
    order: 2,
  },
  {
    title: "Outil de pilotage du mécénat",
    short_description:
      "Un tableau de bord conçu pour organiser, gérer et suivre efficacement vos campagnes de recherche de mécénat et vos relations avec les entreprises partenaires.",
    type: "XLSX",
    formatLabel: "Tableau Excel",
    localFile: "05_Pilotage_mecenat.xlsx",
    order: 3,
  },
];

/**
 * Upload a file to Cloudinary and return the result
 */
async function uploadToCloudinary(filePath, fileName) {
  const publicId = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "raw",
    folder: "bambu-resources",
    public_id: publicId,
    use_filename: true,
    unique_filename: false,
  });

  return result;
}

/**
 * Format file size in Ko/Mo
 */
function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
  return `${Math.round(bytes / 1024)} Ko`;
}

const seedResources = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in your .env file.");
    }

    // Verify docs directory exists
    if (!fs.existsSync(DOCS_DIR)) {
      throw new Error(`Docs directory not found: ${DOCS_DIR}`);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    // Clear existing downloadable resources
    await DownloadableResource.deleteMany({});
    console.log("🧹 Cleared existing downloadable resources.");

    const createdResources = [];

    for (const res of RESOURCES_DATA) {
      const filePath = path.join(DOCS_DIR, res.localFile);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found, skipping: ${res.localFile}`);
        continue;
      }

      console.log(`☁️  Uploading to Cloudinary: ${res.localFile}...`);
      const uploadResult = await uploadToCloudinary(filePath, res.localFile);

      const resource = await DownloadableResource.create({
        title: res.title,
        short_description: res.short_description,
        type: res.type,
        formatLabel: res.formatLabel,
        fileSize: formatFileSize(uploadResult.bytes),
        fileUrl: uploadResult.secure_url,
        fileName: res.localFile,
        cloudinaryPublicId: uploadResult.public_id,
        order: res.order,
        isActive: true,
      });

      createdResources.push(resource);
      console.log(`   ✓ ${resource.title} (${resource.type} - ${resource.fileSize})`);
    }

    console.log(`\n📦 Seeded ${createdResources.length} downloadable resources with Cloudinary URLs.`);
    console.log("🌱 Resources seeded successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.log("❌ Error seeding resources:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedResources();
