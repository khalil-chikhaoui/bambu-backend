import express from "express";
import { protect } from "../middlewares/auth.js";
import { 
  getItems,
  getItemById,
  createItem,
  updateItem,
} from "../controllers/inventory/items.controller.js";
import {
  recordStockMovement,
  getInventoryLedger,
} from "../controllers/inventory/stock.controller.js";

const router = express.Router();

// Routes for the main items collection
router.route("/items")
  .post(protect, createItem)
  .get(protect, getItems);

// Route for specific item details
router.route("/items/:id")
  .get(protect, getItemById).put(protect, updateItem); 

router.route("/history").get(protect, getInventoryLedger);

// Route for ACID stock movements
router.route("/movement")
  .post(protect, recordStockMovement);

export default router; 