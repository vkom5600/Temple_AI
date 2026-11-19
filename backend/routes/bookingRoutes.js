import express from "express";
import { requireAccess, requireFlag } from "../middleware/access.js";

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

router.get("/", requireAccess("calendar", "view"), getBookings);                       // admins: all; others: their own
router.get("/schedule", getSchedule);               // confirmed bookings for a day (everyone)
router.post("/check", checkAvailability);           // is the space free?
router.post("/", requireAccess("calendar", "manage"), createBooking);                    // mobile request, or desk booking for admins
router.get("/:id", requireAccess("calendar", "view"), getBooking);
router.patch("/:id/approve", authorizeRoles(...ADMIN_ROLES), requireAccess("calendar", "manage"), approveBooking);
router.patch("/:id/decline", authorizeRoles(...ADMIN_ROLES), requireAccess("calendar", "manage"), declineBooking);
router.post("/:id/ask", authorizeRoles(...ADMIN_ROLES), requireAccess("calendar", "manage"), askAboutBooking);
router.patch("/:id/cancel", requireAccess("calendar", "manage"), cancelBooking);         // requester (own) or admin

export default router;
