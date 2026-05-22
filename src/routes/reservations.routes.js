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
  updateReservationStatus,
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
  .get(getReservations) // Pass userId=? in query for "My Reservations"
  .post(createReservation);

router.route("/:id/status")
  .patch(updateReservationStatus);

export default router;