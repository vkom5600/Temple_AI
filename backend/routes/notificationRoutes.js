
import express from "express";
import { requireAccess, requireFlag } from "../middleware/access.js";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from "../controllers/notificationController.js";

import {
  authenticateToken,
  authorizeRoles,
  ADMIN_ROLES
} from "../middleware/authMiddleware.js";
import { sendBroadcast } from "../controllers/broadcastController.js";

const router = express.Router();

router.use(authenticateToken);

// H3 Broadcast: chairman and committee message staff / volunteer phones
router.post("/broadcast", authorizeRoles(...ADMIN_ROLES), requireFlag("broadcast"), sendBroadcast);

// Get all notifications for the logged-in user
router.get("/", getNotifications);

// Get unread notification count
router.get("/unread-count", getUnreadNotificationCount);

// Mark all notifications as read
router.patch("/read-all", markAllNotificationsAsRead);

// Mark one notification as read
router.patch("/:id/read", markNotificationAsRead);

// Delete one notification
router.delete("/:id", deleteNotification);

export default router;
