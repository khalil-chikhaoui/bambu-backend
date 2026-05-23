import asyncHandler from "express-async-handler";
import Reservation from "../../models/Reservation.js";
import { logAudit } from "../../middlewares/audit.service.js";
import Resource from "../../models/Resource.js";

/**
 * @desc    Create a reservation (Checks for overlaps)
 * @route   POST /api/reservations
 */
export const createReservation = asyncHandler(async (req, res) => {
  const { organizationId, resourceId, startTime, endTime, purpose } = req.body;
  const resource = await Resource.findById(resourceId); 
  
  const overlapping = await Reservation.findOne({
    resourceId,
    status: { $in: ["PENDING", "APPROVED"] },
    $or: [
      { startTime: { $lt: endTime, $gte: startTime } },
      { endTime: { $gt: startTime, $lte: endTime } },
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    ]
  });

  if (overlapping) {
    res.status(400);
    throw new Error("RESOURCE_ALREADY_BOOKED_FOR_THESE_DATES");
  }

  const reservation = await Reservation.create({
    organizationId,
    resourceId,
    userId: req.user._id,
    startTime,
    endTime,
    purpose,
  });

  await logAudit({
    organizationId,
    actor: req.user._id,
    module: "RESERVATIONS",
    action: "RESERVATION_REQUESTED",
    targetModel: "Reservation",
    targetId: reservation._id,
    metadata: { 
      resourceName: resource.name 
    }
  });

  res.status(201).json(reservation);
});

/**
 * @desc    Get all reservations (Global or for a specific resource/user) with filters
 * @route   GET /api/reservations
 */
export const getReservations = asyncHandler(async (req, res) => {
  const { organizationId, page = 1, limit = 10, resourceId, userId, status, startDate, endDate } = req.query;
  const skip = (page - 1) * limit;

  const query = { organizationId };
  if (resourceId) query.resourceId = resourceId;
  if (userId) query.userId = userId; 
  if (status) query.status = status;

  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }

  const totalItems = await Reservation.countDocuments(query);
  const reservations = await Reservation.find(query)
    .populate("resourceId", "name type details")
    .populate("userId", "firstName lastName email profileImage")
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    data: reservations,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit: Number(limit),
    },
  });
});

/**
 * @desc    Get a single reservation by ID
 * @route   GET /api/reservations/:id
 */
export const getReservationById = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate("resourceId", "name type details")
    .populate("userId", "firstName lastName email profileImage");

  if (!reservation) {
    res.status(404);
    throw new Error("RESERVATION_NOT_FOUND");
  }

  res.json(reservation);
});

/**
 * @desc    Manage reservation status (Accept/Reject)
 * @route   PATCH /api/reservations/:id/status
 */
export const updateReservationStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const reservation = await Reservation.findById(req.params.id).populate("resourceId");

  if (!reservation) {
    res.status(404);
    throw new Error("RESERVATION_NOT_FOUND");
  }

  const oldStatus = reservation.status;
  reservation.status = status;
  if (adminNotes) reservation.adminNotes = adminNotes;

  await reservation.save();

  await logAudit({
    organizationId: reservation.organizationId,
    actor: req.user._id,
    module: "RESERVATIONS",
    action: `RESERVATION_${status}`,
    targetModel: "Reservation",
    targetId: reservation._id,
    diff: { before: { status: oldStatus }, after: { status } },
    metadata: { 
      adminNotes, 
      resourceName: reservation.resourceId.name 
    },
  });

  res.json(reservation);
});


/**
 * @desc    Get the count of pending reservations
 * @route   GET /api/reservations/pending-count
 */
export const getPendingReservationsCount = asyncHandler(async (req, res) => {
  const { organizationId } = req.query;

  if (!organizationId) {
    res.status(400);
    throw new Error("L'ID de l'organisation est requis");
  }

  const count = await Reservation.countDocuments({
    organizationId,
    status: "PENDING"
  });

  res.json({ count });
});