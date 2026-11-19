import express from "express";
import { requireAccess, requireFlag } from "../middleware/access.js";

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
router.get("/", requireAccess("tasks", "view"), getTasks);
router.get("/summary", authorizeRoles(...ADMIN_ROLES), getSummary);
router.get("/signoffs", authorizeRoles(...SIGNOFF_ROLES), getSignoffs);
router.get("/:id", requireAccess("tasks", "view"), getTaskById);

// Chairman and committee manage tasks
router.post("/", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "manage"), createTasks);
router.put("/:id", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "manage"), updateTask);
router.patch("/:id/reopen", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "manage"), reopenTask);
router.patch("/:id/cancel", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "manage"), cancelTask);
router.post("/:id/remind", authorizeRoles(...ADMIN_ROLES), requireAccess("tasks", "manage"), remindTask);

// Doing the work (the controller checks the task is yours)
router.patch("/:id/complete", completeTask);
router.patch("/:id/undo", undoTask);
router.patch("/:id/flag", flagTask);
router.post("/:id/comments", requireAccess("tasks", "view"), addTaskComment);

// Second-person sign-off of safety tasks (never your own)
router.patch("/:id/verify", authorizeRoles(...SIGNOFF_ROLES), requireAccess("tasks", "manage"), verifyTask);
router.patch("/:id/send-back", authorizeRoles(...SIGNOFF_ROLES), requireAccess("tasks", "manage"), sendBackTask);

export default router;
