import express from "express";
import { protect } from "../middlewares/auth.js";
import { 
  createItem, 
  recordStockMovement, 
  getItems, 
  getItemById, 

} from "../controllers/inventory.controller.js";

const router = express.Router();

// Routes for the main items collection
router.route("/items")
  .post(protect, createItem)
  .get(protect, getItems);

// Route for specific item details
router.route("/items/:id")
  .get(protect, getItemById);



// Route for ACID stock movements
router.route("/movement")
  .post(protect, recordStockMovement);

export default router; 