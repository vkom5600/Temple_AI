import express from "express";

import {
    getMine,
    checkIn,
    undoCheckIn,
    leave,
    back,
    getDay,
    upsertRecord,
    deleteRecord
} from "../controllers/attendanceController.js";

import {
    authenticateToken,
    authorizeRoles,
    ADMIN_ROLES
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Your own attendance (staff and volunteers; chairman/committee when helping on site)
router.get("/me", getMine);
router.post("/check-in", checkIn);
router.post("/undo-check-in", undoCheckIn);
router.post("/leave", leave);
router.post("/back", back);

// Chairman and committee: Who's On, mark absent, correct any record
router.get("/", authorizeRoles(...ADMIN_ROLES), getDay);
router.put("/:userId/:date", authorizeRoles(...ADMIN_ROLES), upsertRecord);
router.delete("/:userId/:date", authorizeRoles(...ADMIN_ROLES), deleteRecord);

export default router;
