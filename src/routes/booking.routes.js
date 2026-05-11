import express from "express";
import { protect } from "../middlewares/auth.js";
import { createResource, getResources, createBooking, getBookings } from "../controllers/booking.controller.js";

const router = express.Router();

// The Resources Endpoints
router.route("/resources")
  .get(protect, getResources)  
  .post(protect, createResource);

// The Bookings Endpoints
router.route("/")
    .get(protect, getBookings)
  .post(protect, createBooking);

export default router;