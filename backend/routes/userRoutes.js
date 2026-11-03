import express from "express";

import {
    createUser,
    getUsers,
    updateUser,
    deactivateUser
} from "../controllers/userController.js";

import {
    authenticateToken,
    authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Only Chairman can manage user accounts
router.use(authenticateToken);
router.use(authorizeRoles("chairman"));

router.post("/", createUser);
router.get("/", getUsers);
router.put("/:id", updateUser);
router.patch("/:id/deactivate", deactivateUser);

export default router;