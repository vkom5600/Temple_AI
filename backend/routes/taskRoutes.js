
import express from "express";

import {
  createTask,
  getTasks,
  submitTask,
  verifyTask
} from "../controllers/taskController.js";

import {
  authenticateToken,
  authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Chairman and Committee can create tasks
router.post(
  "/",
  authorizeRoles("chairman", "committee"),
  createTask
);

// All authenticated users can view permitted tasks
router.get("/", getTasks);

// Staff and volunteers can submit their own tasks
router.patch(
  "/:id/submit",
  authorizeRoles("staff", "volunteer"),
  submitTask
);

// Chairman and Committee can verify tasks
router.patch(
  "/:id/verify",
  authorizeRoles("chairman", "committee"),
  verifyTask
);

export default router;
