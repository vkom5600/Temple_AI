import express from "express";
import { requireAccess, requireFlag } from "../middleware/access.js";
import { getDaily, makeDaily } from "../controllers/reportController.js";
import { authenticateToken, authorizeRoles, ADMIN_ROLES } from "../middleware/authMiddleware.js";

// R1 nightly report (chairman and committee)
const router = express.Router();
router.use(authenticateToken, authorizeRoles(...ADMIN_ROLES), requireAccess("reports", "view"));
router.get("/daily/:date", getDaily);
router.post("/daily/:date", makeDaily);
export default router;
