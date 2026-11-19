import express from "express";

import {
    login,
    register,
    registrationStatus,
    getProfile,
    templeRules
} from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { authRateLimit } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Public
router.get("/registration-status", registrationStatus);
router.get("/temple-rules", templeRules);
router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);

// Signed in
router.get("/profile", authenticateToken, getProfile);

export default router;
