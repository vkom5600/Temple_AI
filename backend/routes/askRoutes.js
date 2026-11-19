import express from "express";
import { ask, status } from "../controllers/askController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

// AI1 Ask AI backed by Claude (chairman and committee)
const router = express.Router();
router.use(authenticateToken, authorizeRoles(...ADMIN_ROLES));
router.get("/status", status);
router.post("/ask", ask);
export default router;
