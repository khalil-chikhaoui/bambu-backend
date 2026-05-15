/**
 * @fileoverview Local Storage Configuration
 * Handles saving files to the local 'images' directory.
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = process.env.UPLOAD_PATH || path.join(__dirname, "../../images");

/**
 * Factory function to create specific storage engines
 * @param {string} subfolder - The subfolder name (e.g., "users", "organizations")
 */
const createStorage = (subfolder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(UPLOADS_ROOT, subfolder);
      
      // Ensure directory exists, create if not
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });
};

// File Filter (Accept images only)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("UPLOAD_INVALID_TYPE")); 
  }
};

/**
 * Configure Upload Middlewares
 */
export const uploadUserAvatar = multer({ 
  storage: createStorage("users"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export const uploadOrganizationLogo = multer({ 
  storage: createStorage("organizations"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export const uploadMemory = multer({ storage: multer.memoryStorage() });