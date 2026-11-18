import express from "express";

import {
  approveBooking,
  askAboutBooking,
  cancelBooking,
  checkAvailability,
  createBooking,
  declineBooking,
  getBooking,
  getBookings,
  getSchedule
} from "../controllers/bookingController.js";

import {
  authenticateToken,
  authorizeRoles,
  ADMIN_ROLES
} from "../middleware/authMiddleware.js";

// Phase 3 bookings. Everyone signed in can request; the chairman and committee decide.
const router = express.Router();

router.use(authenticateToken);

router.get("/", getBookings);                       // admins: all; others: their own
router.get("/schedule", getSchedule);               // confirmed bookings for a day (everyone)
router.post("/check", checkAvailability);           // is the space free?
router.post("/", createBooking);                    // mobile request, or desk booking for admins
router.get("/:id", getBooking);
router.patch("/:id/approve", authorizeRoles(...ADMIN_ROLES), approveBooking);
router.patch("/:id/decline", authorizeRoles(...ADMIN_ROLES), declineBooking);
router.post("/:id/ask", authorizeRoles(...ADMIN_ROLES), askAboutBooking);
router.patch("/:id/cancel", cancelBooking);         // requester (own) or admin

export default router;
