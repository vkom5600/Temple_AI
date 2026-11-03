
import express from "express";

import {
  checkIn,
  checkOut,
  getAttendance,
  markAbsent
} from "../controllers/attendanceController.js";

import {
  authenticateToken,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Staff and volunteers
router.post(
  "/check-in",
  authorizeRoles("staff", "volunteer"),
  checkIn
);

router.patch(
  "/check-out",
  authorizeRoles("staff", "volunteer"),
  checkOut
);

// All authenticated users can view permitted records
router.get("/", getAttendance);

// Chairman and Committee can record absence
router.post(
  "/mark-absent",
  authorizeRoles("chairman", "committee"),
  markAbsent
);

export default router;
