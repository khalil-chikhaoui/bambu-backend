import asyncHandler from "express-async-handler";
import Resource from "../models/Resource.js";
import Booking from "../models/Booking.js";
import { logAudit } from "../middlewares/audit.service.js"; // Ensure this path matches your setup

/**
 * @desc    Get all resources for an organization
 * @route   GET /api/bookings/resources
 */
export const getResources = asyncHandler(async (req, res) => {
  const { organizationId, type } = req.query; // Extracted from query

  const query = { organizationId };
  if (type) query.type = type;

  const resources = await Resource.find(query).sort({ createdAt: -1 });
  res.json(resources);
});

/**
 * @desc    Create a bookable resource
 * @route   POST /api/bookings/resources
 */
export const createResource = asyncHandler(async (req, res) => {
  // FIX: Extract organizationId from req.body!
  const { organizationId, name, type, capacity } = req.body;
  
  const resource = await Resource.create({
    organizationId, // Now it correctly maps to the DB!
    name, 
    type, 
    capacity
  });

  logAudit({
    organizationId: resource.organizationId,
    actor: req.user._id,
    module: "LOGISTICS",
    action: "RESOURCE_CREATED",
    targetModel: "Resource",
    targetId: resource._id,
    metadata: { resourceName: resource.name, type: resource.type }
  });

  res.status(201).json(resource);
});

/**
 * @desc    Create a reservation with Collision Detection
 * @route   POST /api/bookings
 */
export const createBooking = asyncHandler(async (req, res) => {
  // FIX: Extract organizationId from req.body!
  const { organizationId, resourceId, startTime, endTime, purpose } = req.body;
  
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    res.status(400);
    throw new Error("INVALID_TIME_RANGE: End time must be after start time.");
  }

  const resource = await Resource.findById(resourceId);
  if (!resource || resource.status !== "ACTIVE") {
    res.status(400);
    throw new Error("RESOURCE_UNAVAILABLE");
  }

  // --- COLLISION DETECTION ALGORITHM ---
  const overlappingBooking = await Booking.findOne({
    resourceId,
    status: { $ne: "CANCELLED" },
    startTime: { $lt: end },
    endTime: { $gt: start }
  });

  if (overlappingBooking) {
    res.status(409); 
    throw new Error("RESOURCE_ALREADY_BOOKED_FOR_THIS_TIMEFRAME");
  }

  const booking = await Booking.create({
    organizationId,
    resourceId,
    userId: req.user._id,
    startTime: start,
    endTime: end,
    purpose
  });

  logAudit({
    organizationId,
    actor: req.user._id,
    module: "LOGISTICS",
    action: "BOOKING_CREATED",
    targetModel: "Booking",
    targetId: booking._id,
    metadata: { 
      resourceName: resource.name, 
      startTime: start.toISOString(), 
      endTime: end.toISOString() 
    }
  });

  res.status(201).json(booking);
});


/**
 * @desc    Get all bookings for an organization
 * @route   GET /api/bookings
 */
export const getBookings = asyncHandler(async (req, res) => {
  const { organizationId, resourceId, startDate, endDate } = req.query;

  const query = { organizationId, status: { $ne: "CANCELLED" } }; // Don't show cancelled bookings
  
  if (resourceId) query.resourceId = resourceId;
  
  // Optional date filtering
  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }

  const bookings = await Booking.find(query)
    .populate("userId", "name email") // Get the user's name
    .sort({ startTime: 1 });

  res.json(bookings);
});