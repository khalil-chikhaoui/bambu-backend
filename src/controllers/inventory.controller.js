import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Item from "../models/Item.js";
import StockMovement from "../models/StockMovement.js";
import { logAudit } from "../middlewares/audit.service.js";


/**
 * @desc    Get all items for an organization
 * @route   GET /api/inventory/items
 */
export const getItems = asyncHandler(async (req, res) => {
  const { organizationId, search, category } = req.query;
  
  const query = { organizationId };
  if (search) {
    query.$or = [{ name: new RegExp(search, "i") }, { sku: new RegExp(search, "i") }];
  }
  if (category) query.category = category;

  const items = await Item.find(query).sort({ createdAt: -1 });
  res.json(items);
});

/**
 * @desc    Get single item
 * @route   GET /api/inventory/items/:id
 */
export const getItemById = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error("ITEM_NOT_FOUND");
  }
  res.json(item);
});

/**
 * @desc    Create a new inventory item
 * @route   POST /api/inventory/items
 */
export const createItem = asyncHandler(async (req, res) => {
  // FIX: Extract organizationId directly from req.body
  const { organizationId, name, sku, category, minThreshold } = req.body;
  
  const item = await Item.create({
    organizationId, // Now it correctly links to the DB!
    name, sku, category, minThreshold, currentQuantity: 0
  });

  logAudit({
    organizationId: item.organizationId,
    actor: req.user._id,
    module: "INVENTORY",
    action: "ITEM_CREATED",
    targetModel: "Item",
    targetId: item._id,
    metadata: { itemName: item.name, sku: item.sku }
  });

  res.status(201).json(item);
});


/**
 * @desc    Record a stock IN or OUT with ACID compliance
 * @route   POST /api/inventory/movement
 
export const recordStockMovement = asyncHandler(async (req, res) => {
const { organizationId, itemId, type, quantity, projectId, notes } = req.body;

  // 1. Initialize MongoDB Session for ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const item = await Item.findById(itemId).session(session);
    if (!item) throw new Error("ITEM_NOT_FOUND");

    // 2. Validate math
    const parsedQuantity = Math.abs(Number(quantity));
    if (type === "OUT" && item.currentQuantity < parsedQuantity) {
      throw new Error(`INSUFFICIENT_STOCK: Only ${item.currentQuantity} available.`);
    }

    // 3. Update Item Quantity
    const previousQuantity = item.currentQuantity;
    if (type === "IN") item.currentQuantity += parsedQuantity;
    if (type === "OUT") item.currentQuantity -= parsedQuantity;
    await item.save({ session });

    // 4. Record the Movement Ledger
    const movement = await StockMovement.create([{
      organizationId,
      itemId,
      actor: req.user._id,
      type,
      quantity: parsedQuantity,
      projectId,
      notes
    }], { session });

    // 5. Commit the transaction (Lock it in DB)
    await session.commitTransaction();

    // 6. Async Audit Logging (Outside the transaction to keep it fast)
    logAudit({
      organizationId,
      actor: req.user._id,
      module: "INVENTORY",
      action: `STOCK_${type}`, // "STOCK_IN" or "STOCK_OUT"
      targetModel: "Item",
      targetId: item._id,
      metadata: { 
        itemName: item.name, 
        quantityChanged: parsedQuantity,
        newTotal: item.currentQuantity
      },
      diff: { before: { quantity: previousQuantity }, after: { quantity: item.currentQuantity } }
    });

    res.status(200).json({ message: "MOVEMENT_RECORDED", currentQuantity: item.currentQuantity });

  } catch (error) {
    // If ANYTHING fails, abort everything. Ghost data is prevented.
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message);
  } finally {
    session.endSession();
  }
});*/


/**
 * @desc    Record a stock IN or OUT (Dev Mode: Transactions Bypassed)
 * @route   POST /api/inventory/movement
 */
export const recordStockMovement = asyncHandler(async (req, res) => {
  const { organizationId, itemId, type, quantity, projectId, notes } = req.body;
  
  // 1. Find the item (No session)
  const item = await Item.findById(itemId);
  if (!item) throw new Error("ITEM_NOT_FOUND");

  // 2. Validate math
  const parsedQuantity = Math.abs(Number(quantity));
  if (type === "OUT" && item.currentQuantity < parsedQuantity) {
    res.status(400);
    throw new Error(`INSUFFICIENT_STOCK: Only ${item.currentQuantity} available.`);
  }

  // 3. Update Item Quantity
  const previousQuantity = item.currentQuantity;
  if (type === "IN") item.currentQuantity += parsedQuantity;
  if (type === "OUT") item.currentQuantity -= parsedQuantity;
  await item.save(); // Save without session

  // 4. Record the Movement Ledger
  const movement = await StockMovement.create({
    organizationId,
    itemId,
    actor: req.user._id,
    type,
    quantity: parsedQuantity,
    projectId,
    notes
  }); // Create without session array

  // 5. Async Audit Logging
  logAudit({
    organizationId,
    actor: req.user._id,
    module: "INVENTORY",
    action: `STOCK_${type}`,
    targetModel: "Item",
    targetId: item._id,
    metadata: { 
      itemName: item.name, 
      quantityChanged: parsedQuantity,
      newTotal: item.currentQuantity
    },
    diff: { before: { quantity: previousQuantity }, after: { quantity: item.currentQuantity } }
  });

  res.status(200).json({ message: "MOVEMENT_RECORDED", currentQuantity: item.currentQuantity });
});

