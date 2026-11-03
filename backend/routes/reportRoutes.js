import express from "express";

import {
  generateReport,
  getDailyReports,
  getDailyReportByDate,
  generateAISummary
} from "../controllers/reportController.js";

import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Only chairman and committee can access reports.
const allowManagementRoles = (req, res, next) => {
  if (!req.user || !["chairman", "committee"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only chairman and committee can access reports."
    });
  }

  next();
};

router.use(allowManagementRoles);

router.post("/generate", generateReport);

router.get("/", getDailyReports);

router.get("/:date", getDailyReportByDate);

router.post("/:date/ai-summary", generateAISummary);

export default router;