import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  getResources,
  createResource,
  updateResource,
} from "../controllers/reservations/resources.controller.js";
import {
  createReservation,
  getReservations,
  getReservationById,
  updateReservationStatus,
  getPendingReservationsCount,
} from "../controllers/reservations/reservations.controller.js";

const router = express.Router();

router.use(protect);

// --- Resources ---
router.route("/resources")
  .get(getResources)
  .post(createResource);

router.route("/resources/:id")
  .put(updateResource);

// --- Reservations ---
router.route("/")
  .get(getReservations) 
  .post(createReservation);

router.route("/pending-count")
  .get(getPendingReservationsCount);

// --- Single Reservation Routes ---
router.route("/:id")
  .get(getReservationById);

router.route("/:id/status")
  .patch(updateReservationStatus);

export default router;