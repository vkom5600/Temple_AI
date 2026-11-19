import express from "express";

import {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    approveUser,
    rejectUser,
    deactivateUser,
    activateUser,
    removeUser
} from "../controllers/userController.js";

import {
    authenticateToken,
    authorizeRoles,
    ADMIN_ROLES
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Chairman and committee can see everyone
router.get("/", authorizeRoles(...ADMIN_ROLES), getUsers);
router.get("/:id", authorizeRoles(...ADMIN_ROLES), getUserById);

// Only the chairman adds, edits, approves or (de)activates people
router.post("/", authorizeRoles("chairman"), createUser);
router.put("/:id", authorizeRoles("chairman"), updateUser);
router.patch("/:id/approve", authorizeRoles("chairman"), approveUser);
router.patch("/:id/reject", authorizeRoles("chairman"), rejectUser);
router.patch("/:id/deactivate", authorizeRoles("chairman"), deactivateUser);
router.patch("/:id/activate", authorizeRoles("chairman"), activateUser);
router.delete("/:id", authorizeRoles("chairman"), removeUser);

export default router;
