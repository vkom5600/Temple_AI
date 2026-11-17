import express from "express";

import {
    getTasks,
    getSummary,
    getSignoffs,
    getTaskById,
    createTasks,
    updateTask,
    reopenTask,
    cancelTask,
    remindTask,
    completeTask,
    undoTask,
    verifyTask,
    sendBackTask,
    flagTask,
    addTaskComment
} from "../controllers/taskController.js";

import {
    authenticateToken,
    authorizeRoles,
    ADMIN_ROLES
} from "../middleware/authMiddleware.js";
import { SIGNOFF_ROLES } from "../services/taskService.js";

const router = express.Router();

router.use(authenticateToken);

// Reading (the controller limits staff/volunteers to their own tasks)
router.get("/", getTasks);
router.get("/summary", authorizeRoles(...ADMIN_ROLES), getSummary);
router.get("/signoffs", authorizeRoles(...SIGNOFF_ROLES), getSignoffs);
router.get("/:id", getTaskById);

// Chairman and committee manage tasks
router.post("/", authorizeRoles(...ADMIN_ROLES), createTasks);
router.put("/:id", authorizeRoles(...ADMIN_ROLES), updateTask);
router.patch("/:id/reopen", authorizeRoles(...ADMIN_ROLES), reopenTask);
router.patch("/:id/cancel", authorizeRoles(...ADMIN_ROLES), cancelTask);
router.post("/:id/remind", authorizeRoles(...ADMIN_ROLES), remindTask);

// Doing the work (the controller checks the task is yours)
router.patch("/:id/complete", completeTask);
router.patch("/:id/undo", undoTask);
router.patch("/:id/flag", flagTask);
router.post("/:id/comments", addTaskComment);

// Second-person sign-off of safety tasks (never your own)
router.patch("/:id/verify", authorizeRoles(...SIGNOFF_ROLES), verifyTask);
router.patch("/:id/send-back", authorizeRoles(...SIGNOFF_ROLES), sendBackTask);

export default router;
