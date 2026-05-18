// src/controllers/hr/documents.controller.js
import asyncHandler from "express-async-handler";
import HRDocument from "../../models/hr/HRDocument.js";
import { logAudit } from "../../middlewares/audit.service.js";
import fs from "fs";
import path from "path";

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

// @desc    Upload an HR Document
// @route   POST /api/organizations/:orgId/hr/employees/:employeeId/documents
// @access  Private
export const uploadDocument = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;
  const { title, description, type, expirationDate } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error("UPLOAD_NO_FILE");
  }

  const fileUrl = `${process.env.BACKEND_URL}/api/images/hr/${req.file.filename}`;

  const newDoc = await HRDocument.create({
    employeeRecordId: employeeId,
    organizationId: orgId,
    uploadedBy: req.user._id,
    title,
    description,
    type,
    expirationDate,
    fileUrl,
  });

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "HR_DOCUMENT_UPLOADED", 
    targetModel: "EmployeeRecord", // Tie it to the employee
    targetId: employeeId,          // Tie it to the employee ID
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

  // Delete physical file
  try {
    const filename = document.fileUrl.split("/").pop();
    const storagePath = process.env.UPLOAD_PATH || path.join(process.cwd(), "images");
    const filePath = path.join(storagePath, "hr", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete HR physical file:", error.message);
  }

  await document.deleteOne();

 logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "HR_DOCUMENT_DELETED",
    targetModel: "EmployeeRecord", // Tie it to the employee
    targetId: employeeId,          // Tie it to the employee ID
    metadata: { 
      documentId: document._id, 
      documentTitle: document.title // Save the title so we can display what was deleted!
    }
  });

  res.status(200).json({ message: "DOCUMENT_DELETED" });
});