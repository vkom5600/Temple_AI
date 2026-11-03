
import pool from "../config/db.js";

// Get notifications belonging to the logged-in user
export const getNotifications = async (req, res) => {
  try {
    const { unread_only } = req.query;

    let query = `
      SELECT id, title, message, is_read, created_at
      FROM notifications
      WHERE user_id = $1
    `;

    const values = [req.user.id];

    if (unread_only === "true") {
      query += " AND is_read = FALSE";
    }

    query += " ORDER BY created_at DESC, id DESC LIMIT 100";

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rowCount,
      notifications: result.rows
    });

  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve notifications"
    });
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({
      success: true,
      unreadCount: result.rows[0].unread_count
    });

  } catch (error) {
    console.error("Unread notification count error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve unread notification count"
    });
  }
};

// Mark one notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      notification: result.rows[0]
    });

  } catch (error) {
    console.error("Mark notification read error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update notification"
    });
  }
};

// Mark all notifications as read for the logged-in user
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: result.rowCount
    });

  } catch (error) {
    console.error("Mark all notifications read error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update notifications"
    });
  }
};

// Delete one notification belonging to the logged-in user
export const deleteNotification = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully"
    });

  } catch (error) {
    console.error("Delete notification error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete notification"
    });
  }
};
