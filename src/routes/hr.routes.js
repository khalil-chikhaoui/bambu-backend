// src/routes/hr.routes.js
import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { uploadHRDocument } from "../config/localUpload.js";

// Import Controllers
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateAssurances,
} from "../controllers/hr/employees.controller.js";

import {
  getEmployeeDocuments,
  uploadDocument,
  deleteDocument,
} from "../controllers/hr/documents.controller.js";

const router = Router({ mergeParams: true });

router.use(protect);

// ==========================================
// --- Global Organization HR Routes ---
// ==========================================
router.route("/employees").get(getEmployees).post(createEmployee);

// ==========================================
// --- Specific Employee HR Routes ---
// ==========================================
const employeeRouter = Router({ mergeParams: true });

// -- Core Profile --
employeeRouter.route("/").get(getEmployeeById).put(updateEmployee);

employeeRouter.put("/assurances", updateAssurances);

// -- Documents --
employeeRouter
  .route("/documents")
  .get(getEmployeeDocuments)
  .post(uploadHRDocument.single("file"), uploadDocument);

employeeRouter.delete("/documents/:documentId", deleteDocument);

// Mount the employee router
router.use("/employees/:employeeId", employeeRouter);

export default router;
