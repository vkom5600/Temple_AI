import express from "express";
import { confirm, draft } from "../controllers/planController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

// AI2 Plan with AI (chairman and committee)
const router = express.Router();
router.use(authenticateToken, authorizeRoles(...ADMIN_ROLES));
router.post("/draft", draft);
router.post("/confirm", confirm);
export default router;
