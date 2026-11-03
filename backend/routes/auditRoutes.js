
import express from "express";

import { getAuditLogs } from "../controllers/auditController.js";

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
  getAuditLogs
);

export default router;
