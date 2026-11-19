import express from "express";
import pool from "../config/db.js";
import { requireAccess } from "../middleware/access.js";

import {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    approveUser,
    rejectUser,
    deactivateUser,
    activateUser,
    removeUser,
    updateAccess
} from "../controllers/userController.js";

import {
    authenticateToken,
    authorizeRoles,
    ADMIN_ROLES
} from "../middleware/authMiddleware.js";

const router = express.Router();

// A committee member managing people looks after staff and volunteers only:
// not the chairman, not other committee members, and can't make someone committee.
const staffAndVolunteersOnly = async (req, res, next) => {
    if (req.user.role !== "committee") return next();
    const no = (message) => res.status(403).json({ success: false, message });
    if (req.body?.role && !["staff", "volunteer"].includes(req.body.role)) return no("Only the chairman can add or change committee members");
    if (req.params.id) {
        const target = (await pool.query("SELECT role FROM users WHERE id = $1", [Number(req.params.id)])).rows[0];
        if (target && !["staff", "volunteer"].includes(target.role)) return no("Only the chairman can change committee members");
    }
    next();
};

router.use(authenticateToken);

// Chairman and committee can see everyone
router.get("/", authorizeRoles(...ADMIN_ROLES), getUsers);
router.get("/:id", authorizeRoles(...ADMIN_ROLES), getUserById);

// The chairman, or a committee member with People: Manage (staff and volunteers only),
// adds, edits, approves or (de)activates people. Removing people and setting
// committee access stay with the chairman.
const manage = [authorizeRoles(...ADMIN_ROLES), requireAccess("people", "manage"), staffAndVolunteersOnly];
router.post("/", ...manage, createUser);
router.put("/:id", ...manage, updateUser);
router.patch("/:id/approve", ...manage, approveUser);
router.patch("/:id/reject", ...manage, rejectUser);
router.patch("/:id/deactivate", ...manage, deactivateUser);
router.patch("/:id/activate", ...manage, activateUser);
router.delete("/:id", authorizeRoles("chairman"), removeUser);
router.put("/:id/access", authorizeRoles("chairman"), updateAccess);

export default router;
