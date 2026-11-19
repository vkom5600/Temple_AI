import express from "express";
import { requireAccess, requireFlag } from "../middleware/access.js";
import { confirm, draft } from "../controllers/planController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

// AI2 Plan with AI (chairman and committee)
const router = express.Router();
router.use(authenticateToken, authorizeRoles(...ADMIN_ROLES));
router.post("/draft", requireFlag("ai"), draft);
router.post("/confirm", requireFlag("ai"), requireAccess("calendar", "manage"), requireAccess("tasks", "manage"), confirm);
export default router;
