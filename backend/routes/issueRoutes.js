import express from "express";

import {
    getIssues,
    reportIssue,
    resolveIssue,
    convertIssue
} from "../controllers/issueController.js";

import {
    authenticateToken,
    authorizeRoles,
    ADMIN_ROLES
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Anyone can report a problem
router.post("/", reportIssue);

// Chairman and committee handle them
router.get("/", authorizeRoles(...ADMIN_ROLES), getIssues);
router.patch("/:id/resolve", authorizeRoles(...ADMIN_ROLES), resolveIssue);
router.post("/:id/convert", authorizeRoles(...ADMIN_ROLES), convertIssue);

export default router;
