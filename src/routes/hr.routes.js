// src/routes/hr.routes.js
import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { uploadHRDocument } from "../config/localUpload.js"; // Assurez-vous de créer ce middleware dans localUpload.js

// Import Controllers
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateAssurances,
} from "../controllers/hr/employees.controller.js";

import {
  getEmployeeContracts,
  createContract,
  updateContract,
} from "../controllers/hr/contracts.controller.js";

import {
  getEmployeeDocuments,
  uploadDocument,
  deleteDocument,
} from "../controllers/hr/documents.controller.js";

import {
  getOrgLeaves,
  getEmployeeLeaves,
  createLeaveRequest,
  updateLeaveStatus,
} from "../controllers/hr/leaves.controller.js";

const router = Router({ mergeParams: true }); // Important : Permet d'accéder à :orgId depuis app.use

// Toutes les routes RH sont protégées
router.use(protect);

// ==========================================
// --- Global Organization HR Routes ---
// ==========================================
router.route("/employees")
  .get(getEmployees)
  .post(createEmployee);

router.route("/leaves")
  .get(getOrgLeaves);


// ==========================================
// --- Specific Employee HR Routes ---
// ==========================================
const employeeRouter = Router({ mergeParams: true });

// -- Core Profile --
employeeRouter.route("/")
  .get(getEmployeeById)
  .put(updateEmployee);

employeeRouter.put("/assurances", updateAssurances);

// -- Contracts --
employeeRouter.route("/contracts")
  .get(getEmployeeContracts)
  .post(createContract);

employeeRouter.put("/contracts/:contractId", updateContract);

// -- Documents --
employeeRouter.route("/documents")
  .get(getEmployeeDocuments)
  .post(uploadHRDocument.single("file"), uploadDocument);

employeeRouter.delete("/documents/:documentId", deleteDocument);

// -- Leaves --
employeeRouter.route("/leaves")
  .get(getEmployeeLeaves)
  .post(createLeaveRequest);

employeeRouter.put("/leaves/:leaveId/status", updateLeaveStatus);

// Mount the employee router
router.use("/employees/:employeeId", employeeRouter);

export default router;