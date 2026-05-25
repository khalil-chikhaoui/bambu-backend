// src/controllers/inventory/items.controller.js
import asyncHandler from "express-async-handler";
import Item from "../../models/Item.js";
import StockMovement from "../../models/StockMovement.js";

/**
 * @desc    Get all items for an organization
 * @route   GET /api/inventory/items
 */
export const getItems = asyncHandler(async (req, res) => {
  const { organizationId, search, category } = req.query;

  const query = { organizationId };
  if (search) {
    query.$or = [
      { name: new RegExp(search, "i") },
      { sku: new RegExp(search, "i") },
    ];
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
  const { organizationId, name, sku, category, minThreshold } = req.body;

  const item = await Item.create({
    organizationId,
    name,
    sku,
    category,
    minThreshold,
    currentQuantity: 0,
  });

  await StockMovement.create({
    organizationId: item.organizationId,
    itemId: item._id,
    actor: req.user._id,
    type: "CREATED",
    quantity: 0,
    notes: "Création de l'article",
  });

  res.status(201).json(item);
});

/**
 * @desc    Update an inventory item
 * @route   PUT /api/inventory/items/:id
 */
export const updateItem = asyncHandler(async (req, res) => {
  const { name, category, minThreshold } = req.body;
  const item = await Item.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error("ITEM_NOT_FOUND");
  }

  const diff = { before: {}, after: {} };
  let hasChanges = false;

  const fieldsToCheck = ["name", "category", "minThreshold"];
  fieldsToCheck.forEach((key) => {
    const newVal = req.body[key];
    if (newVal !== undefined && newVal !== item[key]) {
      diff.before[key] = item[key];
      diff.after[key] = newVal;
      item[key] = newVal;
      hasChanges = true;
    }
  });

  const updatedItem = await item.save();

  if (hasChanges) {
    await StockMovement.create({
      organizationId: item.organizationId,
      itemId: item._id,
      actor: req.user._id,
      type: "UPDATED",
      quantity: 0,
      diff: diff,
    });
  }

  res.status(200).json(updatedItem);
});
