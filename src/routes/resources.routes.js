import express from "express";
import {
  getResources,
  getAllResourcesAdmin,
  createResource,
  updateResource,
  deleteResource,
  reorderResources,
} from "../controllers/resources.controller.js";

const router = express.Router();

// Public
router.get("/", getResources);

// Admin
router.get("/admin", getAllResourcesAdmin);
router.post("/", createResource);
router.put("/reorder", reorderResources);
router.put("/:id", updateResource);
router.delete("/:id", deleteResource);

export default router;
