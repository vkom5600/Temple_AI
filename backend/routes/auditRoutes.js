
import express from "express";

import { getAuditLogs } from "../controllers/auditController.js";
import { requireAccess } from "../middleware/access.js";

import {
  authenticateToken,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Only Chairman and Committee can view audit records
router.get(
  "/",
  authorizeRoles("chairman", "committee"),
  requireAccess("reports", "view"),
  getAuditLogs
);

export default router;
