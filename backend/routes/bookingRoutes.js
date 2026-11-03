
import express from "express";

import {
  createBooking,
  getBookings,
  reviewBooking,
  cancelBooking
} from "../controllers/bookingController.js";

import {
  authenticateToken,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", createBooking);
router.get("/", getBookings);

router.patch(
  "/:id/review",
  authorizeRoles("chairman", "committee"),
  reviewBooking
);

router.patch("/:id/cancel", cancelBooking);

export default router;
