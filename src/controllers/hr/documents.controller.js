// src/controllers/hr/documents.controller.js
import asyncHandler from "express-async-handler";
import HRDocument from "../../models/hr/HRDocument.js";
import { logAudit } from "../../middlewares/audit.service.js";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// @desc    Get documents for an employee
// @route   GET /api/organizations/:orgId/hr/employees/:employeeId/documents
// @access  Private
export const getEmployeeDocuments = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;
  const documents = await HRDocument.find({ employeeRecordId: employeeId, organizationId: orgId })
    .populate("uploadedBy", "firstName lastName")
    .sort({ createdAt: -1 });

  res.status(200).json(documents);
});

// @desc    Confirm an HR Document upload
// @route   POST /api/organizations/:orgId/hr/employees/:employeeId/documents/confirm
// @access  Private
export const confirmDocument = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;
  const { title, description, type, expirationDate, secureUrl, publicId } = req.body;

  if (!secureUrl || !publicId) {
    res.status(400);
    throw new Error("UPLOAD_MISSING_DATA");
  }

  const newDoc = await HRDocument.create({
    employeeRecordId: employeeId,
    organizationId: orgId,
    uploadedBy: req.user._id,
    title,
    description,
    type,
    expirationDate: expirationDate || undefined,
    fileUrl: secureUrl,
    filePublicId: publicId,
  });

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "HR_DOCUMENT_UPLOADED", 
    targetModel: "EmployeeRecord", 
    targetId: employeeId,          
    metadata: { 
      documentId: newDoc._id, 
      documentTitle: title 
    }
  });

  res.status(201).json(newDoc);
});

// @desc    Delete an HR Document
// @route   DELETE /api/organizations/:orgId/hr/employees/:employeeId/documents/:documentId
// @access  Private (Admin/HR)
export const deleteDocument = asyncHandler(async (req, res) => {
  const { orgId, employeeId, documentId } = req.params;

  const document = await HRDocument.findOne({ _id: documentId, employeeRecordId: employeeId, organizationId: orgId });
  
  if (!document) {
    res.status(404);
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  // Delete from Cloudinary
  if (document.filePublicId) {
    try {
      const isImage = /\.(jpg|jpeg|png|webp)$/i.test(document.fileUrl);
      const resourceType = isImage ? 'image' : 'raw';
      
      await cloudinary.uploader.destroy(document.filePublicId, { resource_type: resourceType });
    } catch (error) {
      console.error("Failed to delete Cloudinary HR file:", error.message);
    }
  }

  await document.deleteOne();

 logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "HR_DOCUMENT_DELETED",
    targetModel: "EmployeeRecord",
    targetId: employeeId,          
    metadata: { 
      documentId: document._id, 
      documentTitle: document.title 
    }
  });

  res.status(200).json({ message: "DOCUMENT_DELETED" });
});