
import express from "express";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from "../controllers/notificationController.js";

import {
  authenticateToken
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

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
