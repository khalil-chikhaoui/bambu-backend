// src/controllers/inventory/stock.controller.js
import asyncHandler from "express-async-handler";
import Item from "../../models/Item.js";
import StockMovement from "../../models/StockMovement.js";

/**
 * @desc    Record a stock IN or OUT
 * @route   POST /api/inventory/movement
 */
export const recordStockMovement = asyncHandler(async (req, res) => {
  const { organizationId, itemId, type, quantity, projectId, notes } = req.body;

  const item = await Item.findById(itemId);
  if (!item) throw new Error("ITEM_NOT_FOUND");

  const parsedQuantity = Math.abs(Number(quantity));
  if (type === "OUT" && item.currentQuantity < parsedQuantity) {
    res.status(400);
    throw new Error(
      `INSUFFICIENT_STOCK: Only ${item.currentQuantity} available.`,
    );
  }

  if (type === "IN") item.currentQuantity += parsedQuantity;
  if (type === "OUT") item.currentQuantity -= parsedQuantity;
  await item.save();

  // Record the Movement Ledger
  await StockMovement.create({
    organizationId,
    itemId,
    actor: req.user._id,
    type,
    quantity: parsedQuantity,
    projectId,
    notes,
  });
  res
    .status(200)
    .json({
      message: "MOVEMENT_RECORDED",
      currentQuantity: item.currentQuantity,
    });
});

/**
 * @desc    Get inventory history directly from Stock Movements
 * @route   GET /api/inventory/history
 */
export const getInventoryLedger = asyncHandler(async (req, res) => {
  const {
    organizationId,
    page = 1,
    limit = 10,
    itemId,
    action,
    search,
  } = req.query;
  const skip = (page - 1) * limit;

  const query = { organizationId };
  if (itemId) query.itemId = itemId;
  if (action) query.type = action; 

  if (search) {
    const searchRegex = new RegExp(search, "i");

    const matchedItems = await Item.find({
      organizationId,
      $or: [{ name: searchRegex }, { sku: searchRegex }],
    }).select("_id");

    const matchedItemIds = matchedItems.map((item) => item._id);

    query.$or = [{ itemId: { $in: matchedItemIds } }, { notes: searchRegex }];
  }

  const totalItems = await StockMovement.countDocuments(query);

  const history = await StockMovement.find(query)
    .populate("actor", "firstName lastName email")
    .populate("itemId", "name sku category")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    data: history,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit: Number(limit),
    },
  });
});
